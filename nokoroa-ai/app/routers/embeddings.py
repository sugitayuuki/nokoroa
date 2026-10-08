import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.config import settings
from app.deps import AIServiceDep, verify_internal_token
from app.schemas import EmbeddingRequest, EmbeddingResponse

logger = logging.getLogger(__name__)

# chat 側と同じく router 単位で内部認証を必須にする。関数単位だけにすると、
# 新しいエンドポイントを足したときに既定で無防備になる。
router = APIRouter(dependencies=[Depends(verify_internal_token)])


@router.post("/", response_model=EmbeddingResponse)
async def create_embedding(
    request: EmbeddingRequest,
    ai: AIServiceDep,
) -> EmbeddingResponse:
    try:
        vector = await asyncio.to_thread(ai.embed, request.text, request.task_type)
    except Exception:
        logger.exception("embedding failed")
        raise HTTPException(status_code=502, detail="embedding failed") from None

    # 次元が合わないベクトルを DB (vector(768)) へ入れると検索結果が壊れるため、
    # 保存前にここで弾く。
    if len(vector) != settings.embedding_dim:
        # 自サービスの不変条件違反なので 5xx は 500 (502 は上流起因の意味になる)。
        # 実際の次元は内部情報なのでレスポンスには載せずログへ回す。
        logger.error(
            "unexpected embedding dim: got %d, expected %d",
            len(vector),
            settings.embedding_dim,
        )
        raise HTTPException(status_code=500, detail="unexpected embedding dimension")

    return EmbeddingResponse(embedding=vector, dim=settings.embedding_dim)
