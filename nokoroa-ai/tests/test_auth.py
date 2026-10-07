"""内部トークン認証。

このサービスは Gemini への従量課金リクエストを発行するため、認証が外れると
課金を増幅できる。ルーター単位の依存だけで全経路が守られていることを確認する。
"""

import pytest

PROTECTED_PATHS = [
    "/api/chat/",
    "/api/chat/stream",
    "/api/chat/suggestions",
    "/api/chat/related-keywords",
    "/api/embeddings/",
]


@pytest.mark.parametrize("path", PROTECTED_PATHS)
def test_requires_token(client, path):
    assert client.post(path, json={}).status_code == 401


@pytest.mark.parametrize("path", PROTECTED_PATHS)
def test_rejects_wrong_token(client, path):
    response = client.post(path, json={}, headers={"X-Internal-Token": "wrong"})
    assert response.status_code == 401


@pytest.mark.parametrize("path", PROTECTED_PATHS)
def test_rejects_non_ascii_token_without_crashing(client, path):
    """非 ASCII のトークンでも 401 を返すこと (500 にしない)。

    Starlette はヘッダを latin-1 でデコードするため 0x80-0xFF のバイトは
    非 ASCII 文字になる。str 同士の hmac.compare_digest は ASCII のみを
    受け付けるので、正規化せずに渡すと TypeError → 未捕捉の 500 になり、
    認証前の段階で誰でもエラーログを膨らませられる。
    """
    # httpx は str のヘッダ値を ascii で encode するため、実クライアントと同じく
    # 生バイトで渡す。Starlette 側が latin-1 でデコードして非 ASCII 文字になる。
    response = client.post(path, json={}, headers={"X-Internal-Token": b"\xe9"})
    assert response.status_code == 401


def test_health_is_public(client):
    """ECS の healthCheck がコンテナ内から叩くため無認証である必要がある。"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_missing_configured_token_fails_closed(client, monkeypatch):
    """INTERNAL_AI_TOKEN 未設定時は通さず 503 にする (fail-closed)。"""
    from app import deps

    monkeypatch.setattr(deps.settings, "internal_ai_token", "")
    response = client.post("/api/chat/", json={"message": "x"})
    assert response.status_code == 503
