from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ChatProviderName = Literal["gemini", "claude"]
EmbeddingProviderName = Literal["gemini", "openai"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    # チャットと埋め込みを別々に選ぶ。Claude には embeddings API が無く、
    # 1 つの設定では「チャットは Claude・検索は別」という構成を表せないため。
    #   gemini … Google検索グラウンディングが使える唯一の経路
    #   claude … 検索グラウンディングは使えないが、指示追従と日本語の質で優る
    chat_provider: ChatProviderName = "gemini"
    #   openai … text-embedding-3-small。dimensions で 768 に合わせられる
    embedding_provider: EmbeddingProviderName = "gemini"

    cors_origins: str = "http://localhost:3000,http://localhost:4000"
    internal_ai_token: str = ""

    # 使うプロバイダのぶんだけ必須。下の model_validator で検証する。
    gemini_api_key: str = ""
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # Geminiのモデルは定期的にshutdownされるため、コードへ固定せず差し替え可能にする。
    # 既定値の失効状況は https://ai.google.dev/gemini-api/docs/deprecations を参照。
    chat_model: str = "gemini-3.8-flash"
    embedding_model: str = "gemini-embedding-001"
    # pgvectorのHNSWインデックスは2000次元までのため、埋め込み次元は768に固定する。
    # post_embedding.embedding の vector(768) と一致させること。
    embedding_dim: int = 768

    anthropic_base_url: str = "https://api.anthropic.com"
    claude_model: str = "claude-sonnet-4-5-20250929"

    openai_base_url: str = "https://api.openai.com"
    # dimensions 指定に対応したモデルであること。未対応のモデルだと
    # 1536 次元が返り、embeddings ルーターの次元チェックで弾かれる。
    openai_embedding_model: str = "text-embedding-3-small"

    @model_validator(mode="after")
    def _require_keys_for_selected_providers(self) -> "Settings":
        # 鍵を任意フィールドにした代わりに、選んだプロバイダのぶんだけ
        # 起動時に必須化する。未設定のまま起動すると、全リクエストが
        # 実行時に落ちるまで誰も気づかないため。
        required = {
            "gemini": ("gemini_api_key", "GEMINI_API_KEY"),
            "claude": ("anthropic_api_key", "ANTHROPIC_API_KEY"),
            "openai": ("openai_api_key", "OPENAI_API_KEY"),
        }
        for provider in (self.chat_provider, self.embedding_provider):
            if provider not in required:
                continue
            attr, env_name = required[provider]
            if not getattr(self, attr):
                raise ValueError(f"{env_name} is required for provider '{provider}'")
        return self


settings = Settings()
