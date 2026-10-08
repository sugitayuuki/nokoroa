import asyncio
import logging
from collections.abc import Iterator

from google import genai
from google.genai import types

from app.config import settings
from app.schemas import ContextPost, Message, TaskType
from app.services.prompt import SUGGESTIONS_PROMPT, SYSTEM_PROMPT, build_user_text

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = settings.embedding_model
EMBEDDING_DIM = settings.embedding_dim

GOOGLE_SEARCH_TOOL = types.Tool(google_search=types.GoogleSearch())

# Gemini への HTTP タイムアウト(ミリ秒)。未指定だと SDK は無限待ちになり、
# ブロック中のスレッドは切断でもキャンセルできないため枯渇する。
# backend 側の上限に合わせて経路ごとに分ける(一律で長いと、backend が
# 諦めた後もスレッドだけが占有され続ける)。

# backend の AI_REQUEST_TIMEOUT_MS / EMBED_TIMEOUT_MS = 10s に対応
GEMINI_REQUEST_TIMEOUT_MS = 15_000
# backend の AI_STREAM_TIMEOUT_MS = 60s に対応。
# なお requests の timeout はストリームでは 1 read あたりなので、チャンクが
# 流れ続ける限りここでは打ち切られない(全体の打ち切りは backend 側が担う)。
GEMINI_STREAM_TIMEOUT_MS = 60_000


class GeminiService:
    def __init__(self, api_key: str) -> None:
        # クライアント既定も埋めておく。新しい呼び出し箇所がリクエスト単位の
        # 指定を忘れても無限待ちにならないようにするため。
        self.client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=GEMINI_STREAM_TIMEOUT_MS),
        )
        self.model = settings.chat_model
        # ストリームは生成が終わるまで接続を保つため、他経路より長い上限を使う。
        self.stream_config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.7,
            top_p=0.95,
            max_output_tokens=2048,
            http_options=types.HttpOptions(timeout=GEMINI_STREAM_TIMEOUT_MS),
            tools=[GOOGLE_SEARCH_TOOL],
        )

    def embed(self, text: str, task_type: TaskType = "RETRIEVAL_DOCUMENT") -> list[float]:
        # gemini-embedding-001 の既定出力は3072次元。pgvectorのHNSWインデックスは
        # 2000次元までのため、DBスキーマ(vector(768))に合わせて明示的に縮約する。
        result = self.client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=text,
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=EMBEDDING_DIM,
                # backend は 10 秒で abort する。ここで上限を置かないと
                # クライアント既定(ストリーム用の 60 秒)まで
                # スレッドを占有し続ける。
                http_options=types.HttpOptions(timeout=GEMINI_REQUEST_TIMEOUT_MS),
            ),
        )
        return list(result.embeddings[0].values)

    def chat_stream(
        self,
        message: str,
        history: list[Message] | None = None,
        context_posts: list[ContextPost] | None = None,
    ) -> Iterator[str]:
        """同期ジェネレータ。

        StreamingResponse は非 async iterable を iterate_in_threadpool で包むため、
        同期のままでもイベントループは塞がない。
        """
        contents = self._build_contents(message, history, context_posts)

        response = self.client.models.generate_content_stream(
            model=self.model,
            contents=contents,
            # ストリームだけ長めの上限を使う(非ストリームの 15 秒では足りない)
            config=self.stream_config,
        )

        for chunk in response:
            if chunk.text:
                yield chunk.text

    async def generate_suggestions(self, user_message: str, ai_response: str) -> list[str]:
        text = await self._one_shot(
            SUGGESTIONS_PROMPT.format(user_message=user_message, ai_response=ai_response),
            temperature=0.5,
            max_output_tokens=100,
        )
        return [s.strip() for s in text.split("|") if s.strip()]

    async def _one_shot(self, prompt: str, *, temperature: float, max_output_tokens: int) -> str:
        """履歴も検索ツールも使わない単発生成。失敗時は空文字を返す。

        chat_stream と違い system_instruction を付けないのは、抽出タスクに
        「Sora AI として振る舞う」指示が混ざると出力フォーマットが崩れるため。
        """
        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model,
                contents=[types.Content(role="user", parts=[types.Part(text=prompt)])],
                config=types.GenerateContentConfig(
                    temperature=temperature,
                    max_output_tokens=max_output_tokens,
                    # backend は AI_REQUEST_TIMEOUT_MS = 10 秒で abort する
                    http_options=types.HttpOptions(timeout=GEMINI_REQUEST_TIMEOUT_MS),
                ),
            )
        except Exception:
            # 呼び出し元は既定値へ倒すため、ここで残さないと失敗が痕跡なく消える
            # (クォータ超過時の調査が不能になる)。
            logger.exception("one-shot generation failed")
            return ""
        return response.text.strip() if response.text else ""

    def _build_contents(
        self,
        message: str,
        history: list[Message] | None = None,
        context_posts: list[ContextPost] | None = None,
    ) -> list[types.Content]:
        contents = []
        if history:
            for msg in history:
                contents.append(
                    types.Content(
                        role=msg.role,
                        parts=[types.Part(text=msg.content)],
                    )
                )

        contents.append(
            types.Content(
                role="user",
                parts=[types.Part(text=build_user_text(message, context_posts))],
            )
        )
        return contents
