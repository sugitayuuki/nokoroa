import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.security import verify_internal_token
from app.services.gemini_service import GeminiService

logger = logging.getLogger(__name__)

# Gemini APIへの課金リクエストを発行するため、全エンドポイントで内部認証を必須にする
router = APIRouter(dependencies=[Depends(verify_internal_token)])

gemini_service = GeminiService(api_key=settings.gemini_api_key)

MAX_MESSAGE_LENGTH = 2000
MAX_HISTORY_ITEMS = 20


def _sse_event(payload: str) -> str:
    """SSEの1イベントとして送出する。

    SSEはイベント内の各行に data: を必要とする。生成テキストには改行が含まれる
    ため、そのまま流すとクライアント側のイベント分割で本文が欠落する。
    """
    body = "\n".join(f"data: {line}" for line in payload.split("\n"))
    return f"{body}\n\n"


class Message(BaseModel):
    # クライアントが任意のroleを送れると、AIの過去発言を捏造して
    # システム指示を上書きできてしまうため、値を限定する
    role: Literal["user", "model"]
    content: str = Field(..., max_length=MAX_MESSAGE_LENGTH)


class ContextPost(BaseModel):
    title: str
    content: str
    location: str
    author: str


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=MAX_MESSAGE_LENGTH)
    history: list[Message] | None = Field(default=None, max_length=MAX_HISTORY_ITEMS)
    context_posts: list[ContextPost] | None = None


class ChatResponse(BaseModel):
    response: str
    grounding_metadata: dict | None = None


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        history = None
        if request.history:
            history = [{"role": msg.role, "content": msg.content} for msg in request.history]

        result = await gemini_service.chat(
            message=request.message,
            history=history,
        )
        return ChatResponse(
            response=result["response"],
            grounding_metadata=result["grounding_metadata"],
        )
    except Exception:
        # 例外文字列にはモデル名やリクエストURLが含まれうるため外部へ返さない
        logger.exception("chat failed")
        raise HTTPException(status_code=502, detail="chat failed")


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    def generate():
        try:
            history = None
            if request.history:
                history = [{"role": msg.role, "content": msg.content} for msg in request.history]

            context_posts = None
            if request.context_posts:
                context_posts = [
                    {"title": p.title, "content": p.content, "location": p.location, "author": p.author}
                    for p in request.context_posts
                ]

            for chunk in gemini_service.chat_stream(
                message=request.message,
                history=history,
                context_posts=context_posts,
            ):
                yield _sse_event(chunk)
            yield _sse_event("[DONE]")
        except Exception:
            logger.exception("chat stream failed")
            yield _sse_event("[ERROR] chat stream failed")

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


class SuggestionsRequest(BaseModel):
    message: str
    ai_response: str


class SuggestionsResponse(BaseModel):
    suggestions: list[str]


class RelatedKeywordsRequest(BaseModel):
    message: str
    ai_response: str


class RelatedKeywordsResponse(BaseModel):
    keywords: dict | None = None


@router.post("/suggestions", response_model=SuggestionsResponse)
async def get_suggestions(request: SuggestionsRequest):
    try:
        result = gemini_service.generate_suggestions(
            user_message=request.message,
            ai_response=request.ai_response,
        )
        return SuggestionsResponse(suggestions=result)
    except Exception:
        return SuggestionsResponse(suggestions=[])


@router.post("/related-keywords", response_model=RelatedKeywordsResponse)
async def get_related_keywords(request: RelatedKeywordsRequest):
    try:
        result = gemini_service.extract_search_keywords(
            user_message=request.message,
            ai_response=request.ai_response,
        )
        return RelatedKeywordsResponse(keywords=result)
    except Exception:
        return RelatedKeywordsResponse(keywords=None)
