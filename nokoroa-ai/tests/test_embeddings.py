"""埋め込み生成の挙動。"""

import threading

from app.schemas import MAX_EMBEDDING_TEXT_LENGTH
from app.services.gemini_service import EMBEDDING_DIM

MAIN_THREAD = threading.current_thread().name


def test_returns_vector_with_expected_dimension(client, auth, models):
    models.embed_values = [0.5] * EMBEDDING_DIM
    body = client.post("/api/embeddings/", json={"text": "京都"}, headers=auth).json()
    assert body["dim"] == EMBEDDING_DIM
    assert len(body["embedding"]) == EMBEDDING_DIM


def test_rejects_wrong_dimension(client, auth, models):
    """次元が合わないベクトルを DB (vector(768)) へ入れると検索結果が壊れる。"""
    models.embed_values = [0.5] * 512
    response = client.post("/api/embeddings/", json={"text": "京都"}, headers=auth)
    assert response.status_code == 502


def test_maps_upstream_failure_to_502(client, auth, models):
    models.embed_error = RuntimeError("quota exceeded")
    response = client.post("/api/embeddings/", json={"text": "京都"}, headers=auth)
    assert response.status_code == 502
    assert "quota" not in response.text


def test_rejects_empty_text(client, auth):
    assert client.post("/api/embeddings/", json={"text": ""}, headers=auth).status_code == 422


def test_rejects_text_over_limit(client, auth):
    long_text = "あ" * (MAX_EMBEDDING_TEXT_LENGTH + 1)
    response = client.post("/api/embeddings/", json={"text": long_text}, headers=auth)
    assert response.status_code == 422


def test_rejects_unknown_task_type(client, auth):
    response = client.post(
        "/api/embeddings/", json={"text": "京都", "task_type": "BOGUS"}, headers=auth
    )
    assert response.status_code == 422


def test_runs_blocking_sdk_call_off_the_event_loop(client, auth, models):
    models.threads.clear()
    client.post("/api/embeddings/", json={"text": "京都"}, headers=auth)
    assert models.threads - {MAIN_THREAD}
