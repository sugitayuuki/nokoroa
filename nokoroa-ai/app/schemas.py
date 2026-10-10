"""リクエスト / レスポンスのスキーマと、入力上限の定数。

ルーターから分離しているのは、(1) ルーターをエンドポイント定義だけに保つため、
(2) 上限定数を routers / services / tests の複数箇所から同じ定義で参照するため。
"""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

MAX_MESSAGE_LENGTH = 2000
MAX_HISTORY_ITEMS = 20
# 履歴にはAIの応答も積まれるため、ユーザー入力より緩い上限にする
MAX_HISTORY_CONTENT_LENGTH = 8000
# backend は関連投稿を5件に絞って送る (chat.service.ts の posts.length = 5) が、
# 呼び出し元が壊れた場合に Gemini への課金が青天井にならないよう上限を持つ。
MAX_CONTEXT_POSTS = 10
MAX_CONTEXT_FIELD_LENGTH = 2000
# gemini-embedding-001 の入力上限は 2,048 トークン。backend 側の MAX_TEXT_LEN と揃える。
MAX_EMBEDDING_TEXT_LENGTH = 2000

TaskType = Literal[
    "RETRIEVAL_DOCUMENT",
    "RETRIEVAL_QUERY",
    "SEMANTIC_SIMILARITY",
    "CLASSIFICATION",
    "CLUSTERING",
]


class Message(BaseModel):
    # クライアントが任意のroleを送れると、AIの過去発言を捏造して
    # システム指示を上書きできてしまうため、値を限定する
    role: Literal["user", "model"]
    content: str = Field(..., max_length=MAX_HISTORY_CONTENT_LENGTH)


class ContextPost(BaseModel):
    # AI がどの投稿に触れたかを返すための識別子。backend はこの id を
    # 自分が送った候補と突き合わせてから関連投稿カードを絞る
    # (chat.service.ts の relatedPostsEvent)。候補外の id は採用しない。
    # ローリングデプロイで AI サービスが先に入れ替わっても、旧 backend からの
    # リクエストを 422 で全断させないため既定値を持つ。0 は実在しない id
    # (autoincrement は 1 始まり) なので、候補との突合でも採用されない。
    id: int = 0
    title: str
    content: str
    location: str
    author: str

    # backend は投稿本文を最大 10000 字まで許可し (create-post.dto.ts の MaxLength(10000))、
    # 切り詰めずに送ってくる。max_length で拒否すると長い投稿が 1 件混ざるだけで
    # チャット全体が 422 になるため、切り詰めて受け入れる。
    @field_validator("title", "content", "location", "author", mode="before")
    @classmethod
    def _truncate(cls, value: object) -> object:
        if isinstance(value, str) and len(value) > MAX_CONTEXT_FIELD_LENGTH:
            return value[:MAX_CONTEXT_FIELD_LENGTH]
        return value


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=MAX_MESSAGE_LENGTH)
    history: list[Message] | None = Field(default=None, max_length=MAX_HISTORY_ITEMS)
    context_posts: list[ContextPost] | None = Field(default=None, max_length=MAX_CONTEXT_POSTS)


class FollowUpRequest(BaseModel):
    """/suggestions の入力。"""

    message: str = Field(..., max_length=MAX_MESSAGE_LENGTH)
    # AIの生成結果が入るため、ユーザー入力より緩い上限にする
    ai_response: str = Field(..., max_length=MAX_HISTORY_CONTENT_LENGTH)


class SuggestionsResponse(BaseModel):
    suggestions: list[str]


class EmbeddingRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_EMBEDDING_TEXT_LENGTH)
    task_type: TaskType = "RETRIEVAL_DOCUMENT"


class EmbeddingResponse(BaseModel):
    embedding: list[float]
    dim: int
