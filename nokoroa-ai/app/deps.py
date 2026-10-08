"""FastAPI の依存関係。

認証とプロバイダの提供をここへ集約する。サービスをモジュールレベルで
生成するとインポート時に API キーが必須になりテストが書けないため、
必ずこの provider 経由で取得する。
"""

import hmac
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Header, HTTPException

from app.config import settings
from app.services.base import ChatProvider, EmbeddingProvider


def verify_internal_token(
    x_internal_token: str | None = Header(default=None),
) -> None:
    """backendからの内部呼び出しであることを検証する。

    このサービスは外部AIへの従量課金リクエストを発行するため、
    chat / embeddings の両ルーターで必須にする
    (片方だけ保護すると、保護していない側から課金を増幅できる)。
    """
    expected = settings.internal_ai_token
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="INTERNAL_AI_TOKEN is not configured",
        )
    # str 同士の compare_digest は両方が ASCII のみであることを要求する。
    # Starlette はヘッダを latin-1 でデコードするため 0x80-0xFF のバイトは
    # 非 ASCII 文字になり、そのまま渡すと TypeError が送出される。認証前の
    # 段階なので誰でも到達でき、401 ではなく未捕捉例外の 500 を量産できる。
    # bytes に正規化してから比較する(bytes 同士なら ASCII 制約は無い)。
    if not hmac.compare_digest(
        expected.encode("utf-8"),
        (x_internal_token or "").encode("utf-8"),
    ):
        raise HTTPException(status_code=401, detail="invalid internal token")


# import を関数内に置くのは、選ばれていないプロバイダの依存を
# インポート時に要求しないため。


@lru_cache
def get_chat_service() -> ChatProvider:
    """設定されたチャットプロバイダを 1 インスタンスだけ生成して使い回す。

    ルーターごとに生成すると HTTP 接続プールが分裂する。
    """
    if settings.chat_provider == "claude":
        from app.services.claude_service import create_claude_service

        return create_claude_service()

    from app.services.gemini_service import GeminiService

    return GeminiService(api_key=settings.gemini_api_key)


@lru_cache
def get_embedding_service() -> EmbeddingProvider:
    """設定された埋め込みプロバイダを 1 インスタンスだけ生成して使い回す。

    チャットと同じプロバイダなら同じインスタンスを返し、接続を共有する。
    """
    if settings.embedding_provider == settings.chat_provider:
        service = get_chat_service()
        if isinstance(service, EmbeddingProvider):
            return service

    if settings.embedding_provider == "openai":
        from app.services.openai_embedding_service import create_openai_embedding_service

        return create_openai_embedding_service()

    from app.services.gemini_service import GeminiService

    return GeminiService(api_key=settings.gemini_api_key)


# ルーター側は引数デフォルトに Depends を書かず、この別名を型注釈として使う
# (FastAPI が推奨する形式。可変デフォルト引数の警告も避けられる)。
ChatServiceDep = Annotated[ChatProvider, Depends(get_chat_service)]
EmbeddingServiceDep = Annotated[EmbeddingProvider, Depends(get_embedding_service)]
