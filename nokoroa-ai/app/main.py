import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import chat, embeddings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    # ローカル推論は初回だけモデルのロードに数十秒かかり、backend の
    # タイムアウト(埋め込み 10 秒)に必ず掛かる。起動直後に裏で読み込ませて
    # 「最初の 1 通だけ失敗する」のを避ける。
    # await せず投げっぱなしにするのは、ヘルスチェックを待たせないため。
    if settings.ai_provider != "ollama":
        yield
        return

    from app.deps import get_ai_service

    service = get_ai_service()
    # 参照を保持しないとタスクが GC される可能性がある
    app.state.warmup_task = asyncio.create_task(asyncio.to_thread(service.warmup))

    try:
        yield
    finally:
        # 先読みが走っている最中の終了では、スレッドを待たずに接続だけ畳む。
        # to_thread のスレッドはキャンセルできないため、待つと終了が最大
        # OLLAMA_WARMUP_TIMEOUT_S ぶん伸びる。
        app.state.warmup_task.cancel()
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
