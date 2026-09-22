from fastapi import Header, HTTPException

from app.config import settings


def verify_internal_token(
    x_internal_token: str | None = Header(default=None),
) -> None:
    """backendからの内部呼び出しであることを検証する。

    このサービスはGemini APIへの従量課金リクエストを発行するため、
    すべてのルーターで必須にする(embeddingsだけ保護する状態にしない)。
    """
    expected = settings.internal_api_key
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="INTERNAL_API_KEY is not configured",
        )
    if x_internal_token != expected:
        raise HTTPException(status_code=401, detail="invalid internal token")
