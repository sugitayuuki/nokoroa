from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    gemini_api_key: str
    cors_origins: str = "http://localhost:3000,http://localhost:4000"
    internal_ai_token: str = ""

    # Geminiのモデルは定期的にshutdownされるため、コードへ固定せず差し替え可能にする。
    # 既定値の失効状況は https://ai.google.dev/gemini-api/docs/deprecations を参照。
    chat_model: str = "gemini-3.8-flash"
    embedding_model: str = "gemini-embedding-001"
    # pgvectorのHNSWインデックスは2000次元までのため、埋め込み次元は768に固定する。
    # post_embedding.embedding の vector(768) と一致させること。
    embedding_dim: int = 768


settings = Settings()
