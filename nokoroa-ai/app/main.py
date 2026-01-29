from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gemini_api_key: str
    cors_origins: str = "http://localhost:3000,http://localhost:4000"

    class Config:
        env_file = ".env"


settings = Settings()

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


from app.routers import chat

app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
