from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

app = FastAPI(
    title="Nokoroa AI",
    description="AI-powered travel assistant for Nokoroa",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


from app.routers import chat, embeddings

app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(embeddings.router, prefix="/api/embeddings", tags=["embeddings"])
