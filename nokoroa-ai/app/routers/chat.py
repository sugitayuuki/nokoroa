from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.main import settings
from app.services.gemini_service import GeminiService

router = APIRouter()

gemini_service = GeminiService(api_key=settings.gemini_api_key)


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[Message] | None = None


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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    def generate():
        try:
            history = None
            if request.history:
                history = [{"role": msg.role, "content": msg.content} for msg in request.history]

            for chunk in gemini_service.chat_stream(
                message=request.message,
                history=history,
            ):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"

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
