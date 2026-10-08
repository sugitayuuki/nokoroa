"""チャット / 埋め込みプロバイダの共通インタフェース。

ルーターはこの型だけに依存する。実装 (Gemini / Ollama) を直接参照させないのは、
プロバイダを足すたびにルーター側を触らずに済むようにするため。
"""

from collections.abc import Iterator
from typing import Protocol, runtime_checkable

from app.schemas import ContextPost, Message, TaskType


@runtime_checkable
class AIService(Protocol):
    def embed(self, text: str, task_type: TaskType = "RETRIEVAL_DOCUMENT") -> list[float]:
        """text の埋め込みベクトルを返す。長さは settings.embedding_dim と一致すること。"""
        ...

    def chat_stream(
        self,
        message: str,
        history: list[Message] | None = None,
        context_posts: list[ContextPost] | None = None,
    ) -> Iterator[str]:
        """生成テキストを逐次 yield する同期ジェネレータ。

        StreamingResponse は非 async iterable を iterate_in_threadpool で包むため、
        同期のままでもイベントループは塞がない。
        """
        ...

    async def generate_suggestions(self, user_message: str, ai_response: str) -> list[str]:
        """フォローアップ候補を返す。補助機能なので失敗時は空リストに倒す。"""
        ...
