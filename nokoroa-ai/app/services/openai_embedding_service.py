"""OpenAI を使う埋め込みプロバイダ。

Claude には embeddings API が無いため、チャットを Claude にした構成では
検索側をここが担当する。text-embedding-3-small は dimensions で出力次元を
指定でき、DB スキーマ vector(768) にそのまま合わせられる。
"""

import logging

import httpx

from app.config import settings
from app.schemas import TaskType

logger = logging.getLogger(__name__)

# backend は 10 秒で abort する
OPENAI_REQUEST_TIMEOUT_S = 15.0
OPENAI_CONNECT_TIMEOUT_S = 5.0


class OpenAIEmbeddingService:
    def __init__(self, api_key: str, model: str, dimensions: int, base_url: str) -> None:
        self.model = model
        self.dimensions = dimensions
        self.client = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=httpx.Timeout(
                OPENAI_REQUEST_TIMEOUT_S,
                connect=OPENAI_CONNECT_TIMEOUT_S,
            ),
        )

    def close(self) -> None:
        """保持している HTTP 接続を解放する。アプリ終了時に呼ばれる。"""
        self.client.close()

    def embed(self, text: str, task_type: TaskType = "RETRIEVAL_DOCUMENT") -> list[float]:
        # OpenAI の埋め込みは用途の区別を持たない (Gemini の task_type や
        # nomic の接頭辞に相当するものが無い)。同じ空間にクエリも文書も載るため、
        # 引数は互換のために受け取るだけで使わない。
        response = self.client.post(
            "/v1/embeddings",
            json={
                "model": self.model,
                "input": text,
                # 既定は 1536 次元。pgvector の列 vector(768) に合わせて縮約する。
                "dimensions": self.dimensions,
            },
        )
        response.raise_for_status()
        data = response.json().get("data") or []
        if not data:
            # 呼び出し元(embeddings ルーター)は次元チェックで弾くが、
            # 空リストだと「0 次元」という紛らわしい報告になるため先に落とす。
            raise ValueError("openai returned no embeddings")
        return [float(v) for v in data[0]["embedding"]]


def create_openai_embedding_service() -> OpenAIEmbeddingService:
    return OpenAIEmbeddingService(
        api_key=settings.openai_api_key,
        model=settings.openai_embedding_model,
        dimensions=settings.embedding_dim,
        base_url=settings.openai_base_url,
    )
