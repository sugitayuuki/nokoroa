"""ローカルの Ollama を使うプロバイダ。

Gemini と同じインタフェース (app.services.base.AIService) を満たす。
外部課金が発生しない代わりに Google 検索グラウンディングは使えないため、
システムプロンプトは検索なし版を使う。
"""

import asyncio
import json
import logging
from collections.abc import Iterator

import httpx

from app.config import settings
from app.schemas import ContextPost, Message, TaskType
from app.services.prompt import (
    SUGGESTIONS_PROMPT,
    SYSTEM_PROMPT_WITHOUT_SEARCH,
    build_user_text,
)

logger = logging.getLogger(__name__)

# Ollama への HTTP タイムアウト(秒)。Gemini 経路と同じ考え方で、backend 側の
# 上限に対応させる。ローカル推論は初回にモデルをメモリへ読み込むぶん遅いので、
# 接続は即時・読み取りは長めという非対称な設定にする。
OLLAMA_REQUEST_TIMEOUT_S = 15.0
# backend の AI_STREAM_TIMEOUT_MS = 60s に対応。read はチャンク1つあたりの
# 上限なので、流れ続ける限りここでは打ち切られない(全体の打ち切りは backend)。
OLLAMA_STREAM_TIMEOUT_S = 60.0
OLLAMA_CONNECT_TIMEOUT_S = 5.0

# nomic-embed-text は入力の用途を接頭辞で受け取る。これを付けないと
# クエリと文書が別の空間に落ち、類似度検索の精度が目に見えて落ちる。
# 接頭辞はこのモデル族の仕様なので、他モデルへ差し替えた場合は付けない
# (無関係な文字列が本文として埋め込まれ、かえって精度を落とすため)。
_NOMIC_TASK_PREFIX: dict[str, str] = {
    "RETRIEVAL_DOCUMENT": "search_document: ",
    "RETRIEVAL_QUERY": "search_query: ",
    "SEMANTIC_SIMILARITY": "clustering: ",
    "CLASSIFICATION": "classification: ",
    "CLUSTERING": "clustering: ",
}


class OllamaService:
    def __init__(
        self,
        base_url: str,
        chat_model: str,
        embedding_model: str,
        embedding_dim: int,
    ) -> None:
        self.chat_model = chat_model
        self.embedding_model = embedding_model
        self.embedding_dim = embedding_dim
        # httpx.Client はスレッドセーフ。chat_stream は threadpool から、
        # generate_suggestions は to_thread から呼ばれるため使い回してよい。
        self.client = httpx.Client(
            base_url=base_url.rstrip("/"),
            timeout=httpx.Timeout(
                OLLAMA_REQUEST_TIMEOUT_S,
                connect=OLLAMA_CONNECT_TIMEOUT_S,
            ),
        )

    def _embedding_input(self, text: str, task_type: TaskType) -> str:
        if not self.embedding_model.startswith("nomic-embed-text"):
            return text
        return _NOMIC_TASK_PREFIX.get(task_type, "") + text

    def embed(self, text: str, task_type: TaskType = "RETRIEVAL_DOCUMENT") -> list[float]:
        response = self.client.post(
            "/api/embed",
            json={
                "model": self.embedding_model,
                "input": self._embedding_input(text, task_type),
            },
        )
        response.raise_for_status()
        embeddings = response.json().get("embeddings") or []
        if not embeddings:
            # 呼び出し元(embeddings ルーター)は次元チェックで弾くが、
            # 空リストだと「0 次元」という紛らわしい報告になるため先に落とす。
            raise ValueError("ollama returned no embeddings")
        return [float(v) for v in embeddings[0]]

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
        messages = self._build_messages(message, history, context_posts)

        with self.client.stream(
            "POST",
            "/api/chat",
            json={
                "model": self.chat_model,
                "messages": messages,
                "stream": True,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.95,
                    "num_predict": 2048,
                },
            },
            # 生成が終わるまで接続を保つため、他経路より長い上限を使う
            timeout=httpx.Timeout(
                OLLAMA_STREAM_TIMEOUT_S,
                connect=OLLAMA_CONNECT_TIMEOUT_S,
            ),
        ) as response:
            response.raise_for_status()
            # /api/chat は SSE ではなく NDJSON (1行1オブジェクト) を返す
            for line in response.iter_lines():
                if not line.strip():
                    continue
                try:
                    payload = json.loads(line)
                except json.JSONDecodeError:
                    # 1 行壊れただけで会話全体を落とす必要はない
                    logger.warning("skipped malformed ollama chunk")
                    continue

                # ストリーム途中のエラーは 200 のまま本文で通知される。
                # 無視すると「空の応答が正常終了した」ように見えてしまう。
                if error := payload.get("error"):
                    raise RuntimeError(f"ollama stream error: {error}")

                if chunk := payload.get("message", {}).get("content"):
                    yield chunk

                if payload.get("done"):
                    break

    async def generate_suggestions(self, user_message: str, ai_response: str) -> list[str]:
        text = await asyncio.to_thread(
            self._one_shot,
            SUGGESTIONS_PROMPT.format(user_message=user_message, ai_response=ai_response),
            0.5,
            100,
        )
        return [s.strip() for s in text.split("|") if s.strip()]

    def _one_shot(self, prompt: str, temperature: float, num_predict: int) -> str:
        """履歴もシステム指示も付けない単発生成。失敗時は空文字を返す。

        システム指示を付けないのは、抽出タスクに「Sora AI として振る舞う」指示が
        混ざると出力フォーマットが崩れるため。
        """
        try:
            response = self.client.post(
                "/api/chat",
                json={
                    "model": self.chat_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False,
                    "options": {"temperature": temperature, "num_predict": num_predict},
                },
            )
            response.raise_for_status()
        except Exception:
            # 呼び出し元は既定値へ倒すため、ここで残さないと失敗が痕跡なく消える。
            logger.exception("one-shot generation failed")
            return ""
        return response.json().get("message", {}).get("content", "").strip()

    def _build_messages(
        self,
        message: str,
        history: list[Message] | None = None,
        context_posts: list[ContextPost] | None = None,
    ) -> list[dict[str, str]]:
        messages: list[dict[str, str]] = [
            {"role": "system", "content": SYSTEM_PROMPT_WITHOUT_SEARCH}
        ]
        if history:
            for msg in history:
                # スキーマ上の "model" は Gemini の呼び方。Ollama は "assistant"。
                role = "assistant" if msg.role == "model" else "user"
                messages.append({"role": role, "content": msg.content})

        messages.append({"role": "user", "content": build_user_text(message, context_posts)})
        return messages


def create_ollama_service() -> OllamaService:
    return OllamaService(
        base_url=settings.ollama_base_url,
        chat_model=settings.ollama_chat_model,
        embedding_model=settings.ollama_embedding_model,
        embedding_dim=settings.embedding_dim,
    )
