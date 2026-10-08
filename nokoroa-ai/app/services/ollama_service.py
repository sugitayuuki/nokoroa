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
# 上限に対応させる。
OLLAMA_REQUEST_TIMEOUT_S = 15.0
# backend の AI_STREAM_TIMEOUT_MS = 60s に対応。read はチャンク1つあたりの
# 上限なので、流れ続ける限りここでは打ち切られない(全体の打ち切りは backend)。
OLLAMA_STREAM_TIMEOUT_S = 60.0
OLLAMA_CONNECT_TIMEOUT_S = 5.0
# モデルをメモリへ読み込む初回だけは桁違いに遅い(実測: nomic-embed-text で
# 約 31 秒、以降は 0.1 秒)。warmup 専用の上限を別に持つ。通常経路でこの長さを
# 許すと、backend が諦めた後もスレッドを占有し続ける。
OLLAMA_WARMUP_TIMEOUT_S = 180.0

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

# Gemini 経路の 2048 より小さくしている。ローカル推論は実測で毎秒 13 文字程度と
# 遅く、backend のストリーム上限 60 秒に収める必要があるため
# (実測: 2048 で 48 秒、1024 では上限到達で 53 秒)。
# これは安全網であって主たる制御ではない。ここで切ると文が途中で切れるので、
# 自然に収まるよう下の _FORMAT_REMINDER で字数も指示する。
OLLAMA_NUM_PREDICT = 768

# システムプロンプトにも同じ制約があるが、小型モデルは冒頭の指示を取りこぼし、
# 直近の指示には従いやすい。末尾で再掲しないと ### 見出しが混ざり、
# プレーンテキスト前提のフロントにそのまま表示される(実測で発生した)。
_FORMAT_REMINDER = (
    "\n\n【出力形式の厳守】マークダウンは一切使わないこと。"
    "# や ## や ### による見出し、** による強調、``` は禁止。"
    "見出しを付けたい場合は「■ 1日目」のように記号を使う。"
    "回答は全体で500字以内にまとめること。"
)


class OllamaService:
    def __init__(
        self,
        base_url: str,
        chat_model: str,
        embedding_model: str,
        embedding_dim: int,
        keep_alive: str = "30m",
    ) -> None:
        self.chat_model = chat_model
        self.embedding_model = embedding_model
        self.embedding_dim = embedding_dim
        # Ollama は既定で 5 分アイドルするとモデルをメモリから降ろす。降ろされると
        # 次のリクエストが再び約 31 秒かかり、backend の 10 秒で打ち切られて
        # ベクトル検索が無言でキーワード検索へ退化する。常駐させて防ぐ。
        self.keep_alive = keep_alive
        # httpx.Client はスレッドセーフ。chat_stream は threadpool から、
        # generate_suggestions は to_thread から呼ばれるため使い回してよい。
        self.client = httpx.Client(
            base_url=base_url.rstrip("/"),
            timeout=httpx.Timeout(
                OLLAMA_REQUEST_TIMEOUT_S,
                connect=OLLAMA_CONNECT_TIMEOUT_S,
            ),
        )

    def warmup(self) -> None:
        """チャット用と埋め込み用のモデルをメモリへ先読みする。

        初回ロードは約 31 秒かかる一方、backend は埋め込みを 10 秒・ストリームを
        60 秒で打ち切る。先読みしないと「サービス起動後の最初の 1 通だけ必ず
        失敗する」挙動になるため、起動時に裏で済ませておく。
        空の入力を送るのが Ollama のモデル常駐のやり方。
        """
        for path, payload in (
            ("/api/embed", {"model": self.embedding_model, "input": ""}),
            ("/api/chat", {"model": self.chat_model, "messages": []}),
        ):
            try:
                self.client.post(
                    path,
                    json={**payload, "keep_alive": self.keep_alive},
                    timeout=httpx.Timeout(
                        OLLAMA_WARMUP_TIMEOUT_S,
                        connect=OLLAMA_CONNECT_TIMEOUT_S,
                    ),
                )
            except Exception:
                # 先読みは最適化でしかない。失敗しても通常経路は動くので
                # 起動自体は続行する(Ollama 未起動でも API は上がる)。
                logger.warning("ollama warmup failed for %s", payload["model"], exc_info=True)
            else:
                logger.info("ollama warmup done: %s", payload["model"])

    def close(self) -> None:
        """保持している HTTP 接続を解放する。アプリ終了時に呼ばれる。"""
        self.client.close()

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
                "keep_alive": self.keep_alive,
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
                "keep_alive": self.keep_alive,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.95,
                    "num_predict": OLLAMA_NUM_PREDICT,
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
                    "keep_alive": self.keep_alive,
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

        # 形式の再掲はユーザー入力より後ろに置く。前に置くと投稿や質問の本文に
        # 押し流されて効かない(末尾に置くからこそ効く)。
        messages.append(
            {
                "role": "user",
                "content": build_user_text(message, context_posts) + _FORMAT_REMINDER,
            }
        )
        return messages


def create_ollama_service() -> OllamaService:
    return OllamaService(
        base_url=settings.ollama_base_url,
        chat_model=settings.ollama_chat_model,
        embedding_model=settings.ollama_embedding_model,
        embedding_dim=settings.embedding_dim,
        keep_alive=settings.ollama_keep_alive,
    )
