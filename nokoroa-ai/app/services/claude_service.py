"""Anthropic Claude を使うチャットプロバイダ。

埋め込みは提供しない。Claude に embeddings API が無いため、RAG の検索側は
別プロバイダ (settings.embedding_provider) が担当する。
Google 検索グラウンディングも使えないため、システムプロンプトは検索なし版。

SDK ではなく httpx を直接使うのは、Ollama 実装と経路を揃えるためと、
依存を 1 つ増やさずに済むため。Messages API のストリーム形式は安定している。
"""

import asyncio
import json
import logging
from collections.abc import Iterator

import httpx

from app.config import settings
from app.schemas import ContextPost, Message
from app.services.prompt import (
    SUGGESTIONS_PROMPT,
    SYSTEM_PROMPT_WITHOUT_SEARCH,
    build_user_text,
)

logger = logging.getLogger(__name__)

ANTHROPIC_VERSION = "2023-06-01"

# backend の AI_REQUEST_TIMEOUT_MS = 10s に対応
CLAUDE_REQUEST_TIMEOUT_S = 15.0
# backend の AI_STREAM_TIMEOUT_MS = 60s に対応。read はチャンク1つあたりの
# 上限なので、流れ続ける限りここでは打ち切られない(全体の打ち切りは backend)。
CLAUDE_STREAM_TIMEOUT_S = 60.0
CLAUDE_CONNECT_TIMEOUT_S = 5.0

CLAUDE_MAX_TOKENS = 2048


def _normalize_messages(
    history: list[Message] | None, user_text: str
) -> list[dict[str, str]]:
    """Messages API が受け付ける形へ整える。

    API は「user で始まり、user と assistant が交互」であることを要求する。
    一方 frontend は直近 N 件を機械的に切り出して送るため、履歴が assistant で
    始まったり、同じ role が連続したりしうる。そのまま渡すと 400 になる。
    - role "model" (Gemini 由来の呼び方) は "assistant" に読み替える
    - 先頭の assistant は落とす
    - 連続した同 role は 1 つに畳む
    """
    normalized: list[dict[str, str]] = []
    for msg in history or []:
        role = "assistant" if msg.role == "model" else "user"
        if not normalized and role == "assistant":
            continue
        if normalized and normalized[-1]["role"] == role:
            normalized[-1]["content"] += "\n\n" + msg.content
            continue
        normalized.append({"role": role, "content": msg.content})

    # 今回の質問は必ず user。直前が user なら畳む(交互の制約を守る)。
    if normalized and normalized[-1]["role"] == "user":
        normalized[-1]["content"] += "\n\n" + user_text
    else:
        normalized.append({"role": "user", "content": user_text})
    return normalized


class ClaudeService:
    def __init__(self, api_key: str, model: str, base_url: str) -> None:
        self.model = model
        self.client = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers={
                "x-api-key": api_key,
                "anthropic-version": ANTHROPIC_VERSION,
                "content-type": "application/json",
            },
            timeout=httpx.Timeout(
                CLAUDE_REQUEST_TIMEOUT_S,
                connect=CLAUDE_CONNECT_TIMEOUT_S,
            ),
        )

    def close(self) -> None:
        """保持している HTTP 接続を解放する。アプリ終了時に呼ばれる。"""
        self.client.close()

    def chat_stream(
        self,
        message: str,
        history: list[Message] | None = None,
        context_posts: list[ContextPost] | None = None,
    ) -> Iterator[str]:
        """同期ジェネレータ。

        StreamingResponse は非 async iterable を iterate_in_threadpool で包むため、
        同期のままでもイベントループは塞がない。
        """
        messages = _normalize_messages(history, build_user_text(message, context_posts))

        with self.client.stream(
            "POST",
            "/v1/messages",
            json={
                "model": self.model,
                "max_tokens": CLAUDE_MAX_TOKENS,
                "system": SYSTEM_PROMPT_WITHOUT_SEARCH,
                "messages": messages,
                "stream": True,
                # temperature と top_p の併用は非推奨なので temperature だけ指定する
                "temperature": 0.7,
            },
            # 生成が終わるまで接続を保つため、他経路より長い上限を使う
            timeout=httpx.Timeout(
                CLAUDE_STREAM_TIMEOUT_S,
                connect=CLAUDE_CONNECT_TIMEOUT_S,
            ),
        ) as response:
            if response.status_code >= 400:
                # ストリーム応答は本文を読むまで中身が無い。読まずに raise すると
                # 原因(認証切れ・クォータ超過)がログに残らない。
                response.read()
                response.raise_for_status()

            for line in response.iter_lines():
                if not line.startswith("data:"):
                    continue
                try:
                    payload = json.loads(line[5:].strip())
                except json.JSONDecodeError:
                    # 1 行壊れただけで会話全体を落とす必要はない
                    logger.warning("skipped malformed claude chunk")
                    continue

                event_type = payload.get("type")
                # ストリーム途中のエラーは 200 のまま event: error で通知される。
                # 無視すると「空の応答が正常終了した」ように見えてしまう。
                if event_type == "error":
                    raise RuntimeError(f"claude stream error: {payload.get('error')}")
                if event_type == "content_block_delta":
                    if text := payload.get("delta", {}).get("text"):
                        yield text
                elif event_type == "message_stop":
                    break

    async def generate_suggestions(self, user_message: str, ai_response: str) -> list[str]:
        text = await asyncio.to_thread(
            self._one_shot,
            SUGGESTIONS_PROMPT.format(user_message=user_message, ai_response=ai_response),
        )
        return [s.strip() for s in text.split("|") if s.strip()]

    def _one_shot(self, prompt: str) -> str:
        """履歴もシステム指示も付けない単発生成。失敗時は空文字を返す。

        システム指示を付けないのは、抽出タスクに「Sora AI として振る舞う」指示が
        混ざると出力フォーマットが崩れるため。
        """
        try:
            response = self.client.post(
                "/v1/messages",
                json={
                    "model": self.model,
                    "max_tokens": 100,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.5,
                },
            )
            response.raise_for_status()
        except Exception:
            # 呼び出し元は既定値へ倒すため、ここで残さないと失敗が痕跡なく消える。
            logger.exception("one-shot generation failed")
            return ""

        blocks = response.json().get("content") or []
        return "".join(b.get("text", "") for b in blocks).strip()


def create_claude_service() -> ClaudeService:
    return ClaudeService(
        api_key=settings.anthropic_api_key,
        model=settings.claude_model,
        base_url=settings.anthropic_base_url,
    )
