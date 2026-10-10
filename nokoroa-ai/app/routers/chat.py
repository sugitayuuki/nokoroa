import json
import logging
import re
from collections.abc import Iterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.deps import ChatServiceDep, verify_internal_token
from app.schemas import (
    ChatRequest,
    FollowUpRequest,
    SuggestionsResponse,
)
from app.services.prompt import USED_POSTS_CLOSE, USED_POSTS_OPEN

logger = logging.getLogger(__name__)

# プロンプトを自由に流し込める内部APIのため、全エンドポイントで内部認証を必須にする
router = APIRouter(dependencies=[Depends(verify_internal_token)])

# frontend が data 行の文字列一致で解釈する番兵
# (useChatStream.ts の `data === '[DONE]'` / `data.startsWith('[ERROR]')`)。
# 値を変える場合は nokoroa-frontend/src/hooks/useChatStream.ts と同時に変更すること。
DONE_SENTINEL = "[DONE]"
ERROR_SENTINEL = "[ERROR] chat stream failed"


def _sse_event(payload: str) -> str:
    """SSEの1イベントとして送出する。

    SSEはイベント内の各行に data: を必要とする。生成テキストには改行が含まれる
    ため、そのまま流すとクライアント側のイベント分割で本文が欠落する。
    """
    body = "\n".join(f"data: {line}" for line in payload.split("\n"))
    return f"{body}\n\n"


# 本文に触れた投稿の id をAIが申告するマーカー (prompt.py のガイドライン)。
# 本文としては表示しないので、送出前にここで取り除く。
_USED_POSTS_RE = re.compile(
    re.escape(USED_POSTS_OPEN) + r"([0-9,、\s]*)" + re.escape(USED_POSTS_CLOSE)
)
# 閉じタグが来ないまま終わった場合の後始末。開きタグ以降は丸ごと捨てる
# (閉じタグが途中まで届いている `<used_posts>1</used_` のような形も含む)。
_USED_POSTS_DANGLING_RE = re.compile(re.escape(USED_POSTS_OPEN) + r"[\s\S]*$")
# 開きタグの一部だけで終わった場合 (`...本文<used_p`) も本文として出さない。
# 長い接頭辞から並べるのは、短い方が先に一致して残りが漏れるのを防ぐため。
_USED_POSTS_PARTIAL_RE = re.compile(
    "(?:"
    + "|".join(re.escape(USED_POSTS_OPEN[:n]) for n in range(len(USED_POSTS_OPEN) - 1, 0, -1))
    + ")$"
)
# 申告された id の採用上限。MAX_CONTEXT_POSTS より多い申告は壊れた出力とみなす。
MAX_USED_POSTS = 10


def _extract_used_posts(text: str) -> tuple[str, list[int]]:
    """本文からマーカーを取り除き、申告された id を返す。"""
    ids: list[int] = []

    def collect(match: re.Match[str]) -> str:
        for token in re.split(r"[,、\s]+", match.group(1)):
            if token.isdigit() and len(ids) < MAX_USED_POSTS:
                ids.append(int(token))
        return ""

    return _USED_POSTS_RE.sub(collect, text), ids


def _safe_emit_length(pending: str) -> int:
    """pending のうち、マーカーを分断せずに送出できる長さを返す。

    マーカーは複数チャンクに割れて届く。開きタグを送出してしまうと、閉じタグが
    後から来ても取り除けず本文として画面に出る。そこで「マーカーになりうる末尾」
    だけを残し、それ以外は即座に送る (逐次配信を遅らせないため、一定量を
    無条件に保持する方式は採らない)。
    """
    # 完全なマーカーは _extract_used_posts が除去済み。ここに残る開きタグは
    # 閉じタグ待ちなので、そこから先は送らない。
    opened = pending.find(USED_POSTS_OPEN)
    if opened != -1:
        return opened

    # 開きタグの一部だけが届いている場合も、残りが来るまで送らない。
    for length in range(min(len(USED_POSTS_OPEN) - 1, len(pending)), 0, -1):
        if pending.endswith(USED_POSTS_OPEN[:length]):
            return len(pending) - length
    return len(pending)


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    ai: ChatServiceDep,
) -> StreamingResponse:
    def generate() -> Iterator[str]:
        used_post_ids: list[int] = []
        pending = ""
        try:
            for chunk in ai.chat_stream(
                message=request.message,
                history=request.history,
                context_posts=request.context_posts,
            ):
                pending += chunk
                pending, ids = _extract_used_posts(pending)
                used_post_ids.extend(ids)

                emit_length = _safe_emit_length(pending)
                if emit_length > 0:
                    emit, pending = pending[:emit_length], pending[emit_length:]
                    yield _sse_event(emit)

            pending, ids = _extract_used_posts(pending)
            used_post_ids.extend(ids)
            # 閉じタグが来ないまま終わったマーカーを本文として出さない
            pending = _USED_POSTS_PARTIAL_RE.sub("", _USED_POSTS_DANGLING_RE.sub("", pending))
            if pending:
                yield _sse_event(pending)

            # backend が関連投稿カードを絞るのに使う。本文ではないので
            # 専用の type を付けた JSON として送る (frontend は無視する)。
            if used_post_ids:
                yield _sse_event(
                    json.dumps(
                        {"type": "used_posts", "ids": used_post_ids},
                        ensure_ascii=False,
                    )
                )
            yield _sse_event(DONE_SENTINEL)
        except Exception:
            # ヘッダは送出済みでステータスを変えられないため、本文でエラーを伝える
            logger.exception("chat stream failed")
            # 送り残しがあれば本文として流しておく (エラー直前までの回答は有効)
            pending = _USED_POSTS_PARTIAL_RE.sub("", _USED_POSTS_DANGLING_RE.sub("", pending))
            if pending:
                yield _sse_event(pending)
            yield _sse_event(ERROR_SENTINEL)

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
    ai: ChatServiceDep,
) -> SuggestionsResponse:
    # サジェストは補助機能であり、失敗してもチャット本体は成立するため空配列に倒す
    suggestions = await ai.generate_suggestions(
        user_message=request.message,
        ai_response=request.ai_response,
    )
    return SuggestionsResponse(suggestions=suggestions)
