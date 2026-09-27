"""google-genai をフェイクに差し替えたうえでアプリを起動するための共通設定。

実 SDK を入れずにテストできるよう、`google.genai` を sys.modules へ注入する。
差し替えは app のインポートより前に行う必要があるため、conftest のモジュール
レベルで実行している。
"""

import sys
import threading
import types as pytypes
from typing import Any

import pytest

INTERNAL_TOKEN = "test-internal-token"


class FakeResponse:
    def __init__(self, text: str | None = "ok", candidates: list[Any] | None = None):
        self.text = text
        self.candidates = candidates or []


class _FakeEmbedding:
    def __init__(self, values: list[float]):
        self.values = values


class FakeEmbedResponse:
    def __init__(self, values: list[float]):
        self.embeddings = [_FakeEmbedding(values)]


class FakeModels:
    """テストから応答と例外を差し替えられる models スタブ。"""

    def __init__(self) -> None:
        self.generate_content_result = FakeResponse(text="ok")
        self.generate_content_error: Exception | None = None
        self.stream_chunks: list[str] = ["こんにちは"]
        self.stream_error: Exception | None = None
        self.embed_values: list[float] = [0.1] * 768
        self.embed_error: Exception | None = None
        self.prompts: list[str] = []
        self.threads: set[str] = set()

    def _record(self, contents: Any) -> None:
        self.threads.add(threading.current_thread().name)
        for content in contents:
            for part in content.parts:
                self.prompts.append(part.text)

    def generate_content(self, *, model: str, contents: Any, config: Any) -> FakeResponse:
        self._record(contents)
        if self.generate_content_error:
            raise self.generate_content_error
        return self.generate_content_result

    def generate_content_stream(self, *, model: str, contents: Any, config: Any):
        self._record(contents)
        if self.stream_error:
            raise self.stream_error
        for chunk in self.stream_chunks:
            yield FakeResponse(text=chunk)

    def embed_content(self, *, model: str, contents: Any, config: Any) -> FakeEmbedResponse:
        self.threads.add(threading.current_thread().name)
        if self.embed_error:
            raise self.embed_error
        return FakeEmbedResponse(self.embed_values)


class FakeClient:
    last_instance: "FakeClient | None" = None

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key
        self.models = FakeModels()
        FakeClient.last_instance = self


def _install_fake_genai() -> None:
    class _Config:
        def __init__(self, **kwargs: Any):
            self.__dict__.update(kwargs)

    class _Part:
        def __init__(self, text: str = ""):
            self.text = text

    class _Content:
        def __init__(self, role: str = "user", parts: list[Any] | None = None):
            self.role = role
            self.parts = parts or []

    google = pytypes.ModuleType("google")
    google.__path__ = []  # type: ignore[attr-defined]
    genai = pytypes.ModuleType("google.genai")
    gtypes = pytypes.ModuleType("google.genai.types")
    for name, value in [
        ("Tool", _Config),
        ("GoogleSearch", _Config),
        ("GenerateContentConfig", _Config),
        ("EmbedContentConfig", _Config),
        ("Content", _Content),
        ("Part", _Part),
    ]:
        setattr(gtypes, name, value)
    genai.Client = FakeClient  # type: ignore[attr-defined]
    genai.types = gtypes  # type: ignore[attr-defined]
    google.genai = genai  # type: ignore[attr-defined]
    sys.modules.update({"google": google, "google.genai": genai, "google.genai.types": gtypes})


_install_fake_genai()

# Settings は必須項目があるため、app のインポート前に環境変数を用意する
import os  # noqa: E402

os.environ.setdefault("GEMINI_API_KEY", "test-key")
os.environ.setdefault("INTERNAL_AI_TOKEN", INTERNAL_TOKEN)
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")


@pytest.fixture
def models() -> FakeModels:
    """アプリが使う GeminiService のフェイク models を返す。"""
    from app.deps import get_gemini_service

    get_gemini_service.cache_clear()
    service = get_gemini_service()
    return service.client.models


@pytest.fixture
def client(models: FakeModels):
    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture
def auth() -> dict[str, str]:
    return {"X-Internal-Token": INTERNAL_TOKEN}
