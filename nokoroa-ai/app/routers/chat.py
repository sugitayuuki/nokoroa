import json
import logging
import re
import unicodedata
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

# backend が関連投稿カードを絞るのに使うコメント行の名前。
# 値を変える場合は nokoroa-backend/src/chat/chat.service.ts と同時に変更すること。
USED_POSTS_COMMENT = "used_posts"


def _sse_event(payload: str) -> str:
    """SSEの1イベントとして送出する。

    SSEはイベント内の各行に data: を必要とする。生成テキストには改行が含まれる
    ため、そのまま流すとクライアント側のイベント分割で本文が欠落する。
    """
    body = "\n".join(f"data: {line}" for line in payload.split("\n"))
    return f"{body}\n\n"


def _sse_comment(name: str, payload: str) -> str:
    """backend 向けの制御情報を、SSE のコメント行として送出する。

    コメント行 (`:` 始まり) は data 行を持たないので、仕様上どのクライアントも
    本文として扱わない。これにより (1) 旧い frontend にも生の JSON が表示されず、
    (2) 生成テキストは全行に `data: ` が付くため、本文が制御情報を名乗ることが
    構造的に不可能になる。
    """
    return f":{name} {payload}\n\n"


# 申告された id の採用上限。候補は MAX_CONTEXT_POSTS 件なのでそれ以上は壊れた出力。
MAX_USED_POSTS = 10
# マーカーの中身として許す長さ。これを超えたら「閉じタグは来ない」と判断して
# 本文として流す。上限が無いと、書式が少し崩れただけで回答の残りが丸ごと
# 消える (開きタグ以降を保持し続け、最後に破棄してしまう)。
MAX_MARKER_BODY = 200
_MAX_MARKER_SPAN = len(USED_POSTS_OPEN) + MAX_MARKER_BODY + len(USED_POSTS_CLOSE)

# タグは空白混じり (`< used_posts >`) も許容する。抽出だけ厳格にすると、
# 綴りが揺れたときに「タグは消えるが中身の id 列は本文として画面に出る」
# という一番悪い形になる。
_OPEN_PATTERN = r"<\s*used_posts\s*>"
_CLOSE_PATTERN = r"<\s*/\s*used_posts\s*>"

# 本文に触れた投稿の id をAIが申告するマーカー (prompt.py のガイドライン)。
# 本文としては表示しないので、送出前にここで取り除く。
# 中身を数字限定にしないのは、`[1,2]` や `id:1` のような書式ゆれで一致しなくなると
# 上の「回答が消える」経路へ落ちるため。数字は後で取り出す。
_USED_POSTS_RE = re.compile(
    _OPEN_PATTERN + r"(.{0," + str(MAX_MARKER_BODY) + r"}?)" + _CLOSE_PATTERN,
    re.DOTALL,
)
_DIGITS_RE = re.compile(r"\d+")
# 閉じタグが来なかった申告。中身が id 列らしい範囲だけ捨てる。末尾に限定しない:
# 限定すると `<used_posts>1,2` の後ろに本文が続いた場合に `1,2` だけが残り、
# 回答に無関係な数字が画面に出る。
_MARKER_IDS_RE = re.compile(_OPEN_PATTERN + r"[\d,、，\s]{0,40}")
# 単独で残った開きタグ / 閉じタグ。本文として画面に出さない。
_MARKER_REMNANT_RE = re.compile(_OPEN_PATTERN + "|" + _CLOSE_PATTERN)
# 開きタグの後ろが「まだ申告になりうる」形か。id 列、またはその後に続く
# 閉じタグの断片だけを許す。これ以外が来たらマーカーではないので保留を解く
# (解かないと、未閉鎖の開きタグ1つで以降の逐次配信が数百文字ぶん止まる)。
_MARKER_PENDING_RE = re.compile(r"^[\d,、，\s]*(?:<[^>]{0,20}>?)?$")
# 開きタグの一部だけで終わった場合 (`...本文<used_p`) も本文として出さない。
# 長い接頭辞から並べるのは、短い方が先に一致して残りが漏れるのを防ぐため。
# 1 文字 ("<") を含めないのは、不等号で終わる本文の末尾を削ってしまうため。
_USED_POSTS_PARTIAL_RE = re.compile(
    "(?:"
    + "|".join(re.escape(USED_POSTS_OPEN[:n]) for n in range(len(USED_POSTS_OPEN) - 1, 1, -1))
    + ")$"
)


def _extract_used_posts(text: str) -> tuple[str, list[int] | None]:
    """本文からマーカーを取り除き、申告された id を返す。

    マーカーが無ければ None。「マーカーはあったが id が無い」(= 該当なしの申告)と
    区別できないと、途中の申告を末尾で撤回できなくなる。

    マーカーが複数あれば最後のものだけを採る。投稿本文の復唱などで本文途中に
    マーカーが現れても、末尾の正規の申告に上書きされるようにするため。
    """
    declared: list[int] | None = None

    def collect(match: re.Match[str]) -> str:
        nonlocal declared
        # 全角数字でも拾えるよう NFKC で寄せてから数字列を取り出す
        normalized = unicodedata.normalize("NFKC", match.group(1))
        declared = [int(n) for n in _DIGITS_RE.findall(normalized)[:MAX_USED_POSTS]]
        return ""

    return _USED_POSTS_RE.sub(collect, text), declared


def _safe_emit_length(pending: str) -> int:
    """pending のうち、マーカーを分断せずに送出できる長さを返す。

    マーカーは複数チャンクに割れて届く。開きタグを送出してしまうと、閉じタグが
    後から来ても取り除けず本文として画面に出る。そこで「マーカーになりうる末尾」
    だけを残し、それ以外は即座に送る (逐次配信を遅らせないため、一定量を
    無条件に保持する方式は採らない)。
    """
    # 完全なマーカーは _extract_used_posts が除去済み。ここに残る開きタグは
    # 閉じタグ待ち。ただし「中身が id 列として成立しなくなった」または
    # 「マーカーにしては長くなった」時点で、閉じタグは来ないものと判断して
    # 本文として流す (保持し続けると回答が出ず、逐次配信も止まる)。
    opening = re.search(_OPEN_PATTERN, pending)
    if opening is not None:
        after = pending[opening.end() :]
        if len(after) <= _MAX_MARKER_SPAN and _MARKER_PENDING_RE.match(after):
            return opening.start()
        return len(pending)

    # 開きタグの一部だけが届いている場合も、残りが来るまで送らない。
    # **1 文字の "<" も保留する。** 本番の claude 経路はトークン単位で delta を
    # 返すため "<" が単独チャンクになるのは普通に起きる。ここで送ってしまうと
    # 開きタグが本文として確定し、後続の "used_posts>1,2" が画面に漏れたうえ
    # 申告も失われる。「末尾の < を本文として残す」要件は、保留を解く最終
    # フラッシュ側 (_as_body) だけで満たす。
    for length in range(min(len(USED_POSTS_OPEN) - 1, len(pending)), 0, -1):
        if pending.endswith(USED_POSTS_OPEN[:length]):
            return len(pending) - length
    return len(pending)


def _as_body(text: str) -> str:
    """送出するテキストからマーカーの残骸を落とす。

    捨てるのは「閉じタグの来なかった申告」とタグの文字列だけにする。開きタグ以降を
    一律に捨てると、閉じタグが落ちた(max_tokens での打ち切り・上流切断)ときに
    回答の残りが丸ごと消え、利用者には理由不明の尻切れに見える。
    """
    return _USED_POSTS_PARTIAL_RE.sub("", _MARKER_REMNANT_RE.sub("", _MARKER_IDS_RE.sub("", text)))


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    ai: ChatServiceDep,
) -> StreamingResponse:
    def generate() -> Iterator[str]:
        used_post_ids: list[int] = []
        pending = ""

        def used_posts_comment() -> str | None:
            if not used_post_ids:
                return None
            return _sse_comment(
                USED_POSTS_COMMENT,
                json.dumps({"ids": used_post_ids}, ensure_ascii=False),
            )

        try:
            for chunk in ai.chat_stream(
                message=request.message,
                history=request.history,
                context_posts=request.context_posts,
            ):
                pending += chunk
                pending, declared = _extract_used_posts(pending)
                # 申告は最後のものだけを採る (_extract_used_posts と同じ理由)。
                # 空の申告 = 「該当なし」なので、直前の申告を撤回できる。
                if declared is not None:
                    used_post_ids = declared

                emit_length = _safe_emit_length(pending)
                if emit_length > 0:
                    emit, pending = pending[:emit_length], pending[emit_length:]
                    if body := _as_body(emit):
                        yield _sse_event(body)

            pending, declared = _extract_used_posts(pending)
            if declared is not None:
                used_post_ids = declared
            if body := _as_body(pending):
                yield _sse_event(body)
            # 二重送出を防ぐ。この後に例外が出ても except 節で再度流さない。
            pending = ""

            if comment := used_posts_comment():
                yield comment
            yield _sse_event(DONE_SENTINEL)
        except Exception:
            # ヘッダは送出済みでステータスを変えられないため、本文でエラーを伝える
            logger.exception("chat stream failed")
            # 送り残しがあれば本文として流しておく (エラー直前までの回答は有効)。
            # 申告も同じ理由で送る。捨てると、途中まで出た本文は特定の投稿だけを
            # 語っているのにカードは全件、という食い違いになる。
            if body := _as_body(pending):
                yield _sse_event(body)
            if comment := used_posts_comment():
                yield comment
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
