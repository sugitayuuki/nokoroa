"""チャット / 埋め込みプロバイダの共通インタフェース。

チャットと埋め込みを別の Protocol に分けている。両方を備えるプロバイダ
(Gemini) がある一方、Claude は埋め込み API を持たないため、
1 つのインタフェースに押し込むと「実装できないメソッド」が生まれるため。
ルーターはそれぞれ必要な側だけに依存する。
"""

from collections.abc import Iterator
from typing import Protocol, runtime_checkable

from app.schemas import ContextPost, Message, TaskType


@runtime_checkable
class ChatProvider(Protocol):
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


@runtime_checkable
class EmbeddingProvider(Protocol):
    def embed(self, text: str, task_type: TaskType = "RETRIEVAL_DOCUMENT") -> list[float]:
        """text の埋め込みベクトルを返す。長さは settings.embedding_dim と一致すること。"""
        ...


@runtime_checkable
class Closable(Protocol):
    """自前で HTTP 接続を保持するプロバイダ。

    チャット / 埋め込みとは独立した軸なので別の Protocol にする。httpx を直接
    使う Claude / OpenAI は解放が必要だが、Gemini は SDK が接続を管理するため
    close を持たない。アプリ終了時はこの Protocol で判定して呼び分ける。
    """

    def close(self) -> None:
        """保持している HTTP 接続を解放する。"""
        ...
