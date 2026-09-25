import asyncio
import logging
from functools import lru_cache
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.deps import verify_internal_token
from app.services.gemini_service import EMBEDDING_DIM, GeminiService

logger = logging.getLogger(__name__)

# chat 側と同じく router 単位で内部認証を必須にする。関数単位だけにすると、
# 新しいエンドポイントを足したときに既定で無防備になる。
router = APIRouter(dependencies=[Depends(verify_internal_token)])


@lru_cache
def get_gemini_service() -> GeminiService:
    return GeminiService(api_key=settings.gemini_api_key)


TaskType = Literal[
    "RETRIEVAL_DOCUMENT",
    "RETRIEVAL_QUERY",
    "SEMANTIC_SIMILARITY",
    "CLASSIFICATION",
    "CLUSTERING",
]


class EmbeddingRequest(BaseModel):
    # gemini-embedding-001 の入力上限は 2,048 トークン。
    # backend 側の MAX_TEXT_LEN と揃える。
    text: str = Field(..., min_length=1, max_length=2000)
    task_type: TaskType = "RETRIEVAL_DOCUMENT"


class EmbeddingResponse(BaseModel):
    embedding: list[float]
    dim: int


@router.post("/", response_model=EmbeddingResponse)
async def create_embedding(
    request: EmbeddingRequest,
    gemini: GeminiService = Depends(get_gemini_service),
):
    try:
        vector = await asyncio.to_thread(
            gemini.embed, request.text, request.task_type
        )
    except Exception:
        logger.exception("embedding failed")
        raise HTTPException(status_code=502, detail="embedding failed")

    if len(vector) != EMBEDDING_DIM:
        raise HTTPException(
            status_code=500,
            detail=f"unexpected embedding dim: {len(vector)} (expected {EMBEDDING_DIM})",
        )

    return EmbeddingResponse(embedding=vector, dim=EMBEDDING_DIM)
