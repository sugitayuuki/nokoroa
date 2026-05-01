from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gemini_api_key: str
    cors_origins: str = "http://localhost:3000,http://localhost:4000"
    internal_api_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
