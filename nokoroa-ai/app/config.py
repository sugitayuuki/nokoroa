from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    # gemini: 外部APIへ従量課金。Google検索グラウンディングが使える。
    # ollama: ローカル推論で課金ゼロ。検索グラウンディングは使えない。
    ai_provider: Literal["gemini", "ollama"] = "gemini"

    # ollama 運用では不要なので必須にしない。gemini を選んだときだけ
    # 下の model_validator で必須化する。
    gemini_api_key: str = ""
    cors_origins: str = "http://localhost:3000,http://localhost:4000"
    internal_ai_token: str = ""

    # Geminiのモデルは定期的にshutdownされるため、コードへ固定せず差し替え可能にする。
    # 既定値の失効状況は https://ai.google.dev/gemini-api/docs/deprecations を参照。
    chat_model: str = "gemini-3.8-flash"
    embedding_model: str = "gemini-embedding-001"
    # pgvectorのHNSWインデックスは2000次元までのため、埋め込み次元は768に固定する。
    # post_embedding.embedding の vector(768) と一致させること。
    embedding_dim: int = 768

    ollama_base_url: str = "http://localhost:11434"
    # 既定を 7B にしているのは速度のため。backend は 60 秒でストリームを打ち切るので、
    # 大きいモデルほど初回のロードと生成で上限に触れやすい。
    ollama_chat_model: str = "qwen2.5:7b"
    # nomic-embed-text の出力は 768 次元で、embedding_dim とそのまま一致する。
    # 別モデルへ変えると次元が変わり、embeddings ルーターの検証で弾かれる。
    ollama_embedding_model: str = "nomic-embed-text"
    # Ollama がモデルをメモリに保持する時間。既定の 5 分だと、少し放置した後の
    # 1 通目が再ロード(実測 約31秒)で backend のタイムアウトに掛かる。
    ollama_keep_alive: str = "30m"

    @model_validator(mode="after")
    def _require_gemini_key(self) -> "Settings":
        # 以前は gemini_api_key を必須フィールドにして起動時に落としていた。
        # ollama 運用のために任意へ緩めたので、gemini を選んだ場合の保護を
        # ここで復元する(未設定のまま起動すると全リクエストが実行時に落ちる)。
        if self.ai_provider == "gemini" and not self.gemini_api_key:
            raise ValueError("GEMINI_API_KEY is required when AI_PROVIDER=gemini")
        return self


settings = Settings()
