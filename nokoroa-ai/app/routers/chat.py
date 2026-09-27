import logging
from collections.abc import Iterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.deps import GeminiDep, verify_internal_token
from app.schemas import (
    ChatRequest,
    ChatResponse,
    FollowUpRequest,
    RelatedKeywordsResponse,
    SuggestionsResponse,
)

logger = logging.getLogger(__name__)

# Gemini APIへの課金リクエストを発行するため、全エンドポイントで内部認証を必須にする
router = APIRouter(dependencies=[Depends(verify_internal_token)])

DONE_EVENT = "[DONE]"
ERROR_EVENT = "[ERROR] chat stream failed"


def _sse_event(payload: str) -> str:
    """SSEの1イベントとして送出する。

    SSEはイベント内の各行に data: を必要とする。生成テキストには改行が含まれる
    ため、そのまま流すとクライアント側のイベント分割で本文が欠落する。
    """
    body = "\n".join(f"data: {line}" for line in payload.split("\n"))
    return f"{body}\n\n"


@router.post("/", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    gemini: GeminiDep,
) -> ChatResponse:
    try:
        text, grounding = await gemini.chat(
            message=request.message,
            history=request.history,
        )
    except Exception:
        # 例外文字列にはモデル名やリクエストURLが含まれうるため外部へ返さない
        logger.exception("chat failed")
        raise HTTPException(status_code=502, detail="chat failed") from None
    return ChatResponse(response=text, grounding_metadata=grounding)


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    gemini: GeminiDep,
) -> StreamingResponse:
    def generate() -> Iterator[str]:
        try:
            for chunk in gemini.chat_stream(
                message=request.message,
                history=request.history,
                context_posts=request.context_posts,
            ):
                yield _sse_event(chunk)
            yield _sse_event(DONE_EVENT)
        except Exception:
            # ヘッダは送出済みでステータスを変えられないため、本文でエラーを伝える
            logger.exception("chat stream failed")
            yield _sse_event(ERROR_EVENT)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # ALB / リバースプロキシでのバッファリングを抑止し、逐次配信を保つ
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/suggestions", response_model=SuggestionsResponse)
async def get_suggestions(
    request: FollowUpRequest,
    gemini: GeminiDep,
) -> SuggestionsResponse:
    # サジェストは補助機能であり、失敗してもチャット本体は成立するため空配列に倒す
    suggestions = await gemini.generate_suggestions(
        user_message=request.message,
        ai_response=request.ai_response,
    )
    return SuggestionsResponse(suggestions=suggestions)


@router.post("/related-keywords", response_model=RelatedKeywordsResponse)
async def get_related_keywords(
    request: FollowUpRequest,
    gemini: GeminiDep,
) -> RelatedKeywordsResponse:
    # 関連投稿の検索キーも補助機能のため、失敗時は None に倒す
    keywords = await gemini.extract_search_keywords(
        user_message=request.message,
        ai_response=request.ai_response,
    )
    return RelatedKeywordsResponse(keywords=keywords)
