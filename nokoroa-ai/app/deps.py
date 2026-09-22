import hmac

from fastapi import Header, HTTPException

from app.config import settings


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
