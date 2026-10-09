import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import chat, embeddings
from app.services.base import Closable

logger = logging.getLogger(__name__)


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    from app.deps import get_chat_service, get_embedding_service

    # チャットと埋め込みが同じプロバイダなら同一インスタンスが返るため、
    # 二重に close しないよう id で畳む。
    services = {id(s): s for s in (get_chat_service(), get_embedding_service())}.values()

    try:
        yield
    finally:
        # HTTP 接続を張りっぱなしにしない。GeminiService は SDK が管理するため
        # close を持たない。
        for service in services:
            if isinstance(service, Closable):
                service.close()


def create_app() -> FastAPI:
    """アプリを組み立てる。

    ファクトリにしているのは、テストから設定を差し替えた状態で
    生成し直せるようにするため。
    """
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    app = FastAPI(
        title="Nokoroa AI",
        description="AI-powered travel assistant for Nokoroa",
        version="0.1.0",
        lifespan=_lifespan,
    )

    # backend からのサーバー間呼び出し専用サービスだが、ローカル開発でブラウザから
    # 直接叩けるよう CORS は残す。認証は X-Internal-Token ヘッダで行い Cookie は
    # 使わないため allow_credentials は有効にしない
    # (有効だと origin 設定ミスが即座に資格情報の露出になる)。
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-Internal-Token"],
    )

    # ECS の healthCheck が叩くため無認証。外部へは ALB 経由で公開していない。
    @app.get("/health")
    async def health_check() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
    app.include_router(embeddings.router, prefix="/api/embeddings", tags=["embeddings"])
    return app


app = create_app()
