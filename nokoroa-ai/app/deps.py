"""FastAPI の依存関係。

認証と GeminiService の提供をここへ集約する。GeminiService をモジュール
レベルで生成するとインポート時に API キーが必須になりテストが書けないため、
必ずこの provider 経由で取得する。
"""

import hmac
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Header, HTTPException

from app.config import settings
from app.services.gemini_service import GeminiService


def verify_internal_token(
    x_internal_token: str | None = Header(default=None),
) -> None:
    """backendからの内部呼び出しであることを検証する。

    このサービスはGemini APIへの従量課金リクエストを発行するため、
    chat / embeddings の両ルーターで必須にする
    (片方だけ保護すると、保護していない側から課金を増幅できる)。
    """
    expected = settings.internal_ai_token
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="INTERNAL_AI_TOKEN is not configured",
        )
    if not hmac.compare_digest(expected, x_internal_token or ""):
        raise HTTPException(status_code=401, detail="invalid internal token")


@lru_cache
def get_gemini_service() -> GeminiService:
    """GeminiService を 1 インスタンスだけ生成して使い回す。

    ルーターごとに生成すると HTTP 接続プールが分裂するため、
    chat / embeddings の双方がこの provider を使う。
    """
    return GeminiService(api_key=settings.gemini_api_key)


# ルーター側は引数デフォルトに Depends を書かず、この別名を型注釈として使う
# (FastAPI が推奨する形式。可変デフォルト引数の警告も避けられる)。
GeminiDep = Annotated[GeminiService, Depends(get_gemini_service)]
