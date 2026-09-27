import asyncio
import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from app.config import settings
from app.deps import verify_internal_token
from app.services.gemini_service import GeminiService

logger = logging.getLogger(__name__)

# Gemini APIへの課金リクエストを発行するため、全エンドポイントで内部認証を必須にする
router = APIRouter(dependencies=[Depends(verify_internal_token)])

gemini_service = GeminiService(api_key=settings.gemini_api_key)

MAX_MESSAGE_LENGTH = 2000
MAX_HISTORY_ITEMS = 20
# 履歴にはAIの応答も積まれるため、ユーザー入力より緩い上限にする
MAX_HISTORY_CONTENT_LENGTH = 8000
# backend は関連投稿を5件に絞って送る (chat.service.ts の posts.length = 5) が、
# 呼び出し元が壊れた場合に Gemini への課金が青天井にならないよう上限を持つ。
# 各フィールドは拒否ではなく切り詰め (ContextPost._truncate)。
MAX_CONTEXT_POSTS = 10
MAX_CONTEXT_FIELD_LENGTH = 2000


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
    content: str = Field(..., max_length=MAX_HISTORY_CONTENT_LENGTH)


class ContextPost(BaseModel):
    title: str
    content: str
    location: str
    author: str

    # backend は投稿本文を最大 10000 字まで許可し (create-post.dto.ts の MaxLength(10000))、
    # 切り詰めずに送ってくる。ここで max_length を課すと長い投稿が 1 件混ざるだけで
    # チャット全体が 422 になるため、拒否せず切り詰める。
    # message / history と違い、これは backend 側に対応する上限が存在しない。
    @field_validator("title", "content", "location", "author", mode="before")
    @classmethod
    def _truncate(cls, value: object) -> object:
        if isinstance(value, str) and len(value) > MAX_CONTEXT_FIELD_LENGTH:
            return value[:MAX_CONTEXT_FIELD_LENGTH]
        return value


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=MAX_MESSAGE_LENGTH)
    history: list[Message] | None = Field(default=None, max_length=MAX_HISTORY_ITEMS)
    context_posts: list[ContextPost] | None = Field(
        default=None, max_length=MAX_CONTEXT_POSTS
    )


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
    message: str = Field(..., max_length=MAX_MESSAGE_LENGTH)
    # AIの生成結果が入るため、ユーザー入力より緩い上限にする
    ai_response: str = Field(..., max_length=MAX_HISTORY_CONTENT_LENGTH)


class SuggestionsResponse(BaseModel):
    suggestions: list[str]


class RelatedKeywordsRequest(BaseModel):
    message: str = Field(..., max_length=MAX_MESSAGE_LENGTH)
    ai_response: str = Field(..., max_length=MAX_HISTORY_CONTENT_LENGTH)


class RelatedKeywordsResponse(BaseModel):
    keywords: dict | None = None


@router.post("/suggestions", response_model=SuggestionsResponse)
async def get_suggestions(request: SuggestionsRequest):
    try:
        # generate_suggestions は同期ブロッキングのため別スレッドへ逃がす
        result = await asyncio.to_thread(
            gemini_service.generate_suggestions,
            user_message=request.message,
            ai_response=request.ai_response,
        )
        return SuggestionsResponse(suggestions=result)
    except Exception:
        logger.exception("suggestions generation failed")
        return SuggestionsResponse(suggestions=[])


@router.post("/related-keywords", response_model=RelatedKeywordsResponse)
async def get_related_keywords(request: RelatedKeywordsRequest):
    try:
        # extract_search_keywords は同期ブロッキングのため別スレッドへ逃がす
        result = await asyncio.to_thread(
            gemini_service.extract_search_keywords,
            user_message=request.message,
            ai_response=request.ai_response,
        )
        return RelatedKeywordsResponse(keywords=result)
    except Exception:
        logger.exception("related keywords extraction failed")
        return RelatedKeywordsResponse(keywords=None)
