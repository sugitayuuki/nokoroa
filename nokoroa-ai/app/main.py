import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = FastAPI(
    title="Nokoroa AI",
    description="AI-powered travel assistant for Nokoroa",
    version="0.1.0",
)

# backend からのサーバー間呼び出し専用サービスだが、ローカル開発でブラウザから
# 直接叩けるよう CORS は残す。認証は X-Internal-Token ヘッダで行い Cookie は使わないため
# allow_credentials は有効にしない (有効だと origin 設定ミスが即座に資格情報の露出になる)。
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Internal-Token"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


from app.routers import chat, embeddings

app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(embeddings.router, prefix="/api/embeddings", tags=["embeddings"])
