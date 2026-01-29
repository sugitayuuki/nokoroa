from google import genai
from google.genai import types

SYSTEM_PROMPT = """あなたは「Sora AI」です。Nokoroaの旅行アシスタントAIです。
Nokoroaは旅行体験を共有するSNSプラットフォームです。

あなたの役割:
- ユーザーの旅行相談に親身に対応する
- 目的地、日数、予算、好みに応じた旅行プランを提案する
- 最新の観光情報、営業時間、料金、イベント情報を提供する
- 季節や時期に応じた提案をする（桜の開花、紅葉、祭りなど）

回答のガイドライン:
- 簡潔で分かりやすい日本語で回答する
- 具体的な場所やスポット名を挙げる
- 可能であれば予算の目安も伝える
- 不確かな情報は「最新情報をご確認ください」と添える
- マークダウン記法（*、**、#、```など）は一切使わないこと。プレーンテキストのみで回答する
- 箇条書きには「・」や「→」などの記号を使う
"""

GOOGLE_SEARCH_TOOL = types.Tool(
    google_search=types.GoogleSearch()
)


class GeminiService:
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)
        self.model = "gemini-2.0-flash"
        self.config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.7,
            top_p=0.95,
            max_output_tokens=2048,
            tools=[GOOGLE_SEARCH_TOOL],
        )

    async def chat(
        self, message: str, history: list[dict] | None = None
    ) -> dict:
        contents = self._build_contents(message, history)

        response = self.client.models.generate_content(
            model=self.model,
            contents=contents,
            config=self.config,
        )

        grounding_metadata = self._extract_grounding(response)

        return {
            "response": response.text,
            "grounding_metadata": grounding_metadata,
        }

    def chat_stream(
        self, message: str, history: list[dict] | None = None
    ):
        contents = self._build_contents(message, history)

        response = self.client.models.generate_content_stream(
            model=self.model,
            contents=contents,
            config=self.config,
        )

        for chunk in response:
            if chunk.text:
                yield chunk.text

    def extract_search_keywords(
        self, user_message: str, ai_response: str
    ) -> dict | None:
        try:
            prompt = (
                f"ユーザーの質問: {user_message}\n"
                f"AIの回答: {ai_response}\n\n"
                "上記の会話から、旅行に関連する検索キーワードを抽出してください。\n"
                "具体的な地名（都市名、観光地名、温泉名など）が含まれる場合のみ抽出してください。\n"
                "一般的な挨拶や旅行と無関係な会話の場合は「NONE」とだけ出力してください。\n\n"
                "フォーマット（地名がある場合）:\n"
                "location:地名\n"
                "tags:タグ1,タグ2\n"
                "query:検索語\n\n"
                "各行は省略可能です。最低limitでもlocationは必須です。\n"
                "フォーマット以外のテキストは出力しないでください。"
            )
            response = self.client.models.generate_content(
                model=self.model,
                contents=[
                    types.Content(
                        role="user",
                        parts=[types.Part(text=prompt)],
                    )
                ],
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=150,
                ),
            )
            text = response.text.strip() if response.text else ""
            if not text or text == "NONE":
                return None

            result = {}
            for line in text.split("\n"):
                line = line.strip()
                if line.startswith("location:"):
                    result["location"] = line[len("location:"):].strip()
                elif line.startswith("tags:"):
                    tags_str = line[len("tags:"):].strip()
                    result["tags"] = [
                        t.strip() for t in tags_str.split(",") if t.strip()
                    ]
                elif line.startswith("query:"):
                    result["query"] = line[len("query:"):].strip()

            if "location" not in result:
                return None

            return result
        except Exception:
            return None

    def generate_suggestions(
        self, user_message: str, ai_response: str
    ) -> list[str]:
        try:
            prompt = (
                f"ユーザーの質問: {user_message}\n"
                f"AIの回答: {ai_response}\n\n"
                "上記の会話に基づいて、ユーザーが次に聞きそうな"
                "フォローアップ質問を3つ生成してください。\n"
                "各質問は短く簡潔に（15文字以内）。\n"
                "フォーマット: 質問1|質問2|質問3\n"
                "フォーマット以外のテキストは出力しないでください。"
            )
            response = self.client.models.generate_content(
                model=self.model,
                contents=[
                    types.Content(
                        role="user",
                        parts=[types.Part(text=prompt)],
                    )
                ],
                config=types.GenerateContentConfig(
                    temperature=0.5,
                    max_output_tokens=100,
                ),
            )
            text = response.text.strip() if response.text else ""
            if not text:
                return []
            return [s.strip() for s in text.split("|") if s.strip()]
        except Exception:
            return []

    def _build_contents(
        self, message: str, history: list[dict] | None = None
    ) -> list[types.Content]:
        contents = []
        if history:
            for msg in history:
                role = "user" if msg["role"] == "user" else "model"
                contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part(text=msg["content"])],
                    )
                )
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part(text=message)],
            )
        )
        return contents

    def _extract_grounding(self, response) -> dict | None:
        try:
            candidate = response.candidates[0]
            metadata = candidate.grounding_metadata
            if not metadata:
                return None

            result = {}

            if metadata.search_entry_point:
                result["rendered_content"] = metadata.search_entry_point.rendered_content

            if metadata.grounding_chunks:
                result["sources"] = [
                    {
                        "title": chunk.web.title if chunk.web else None,
                        "uri": chunk.web.uri if chunk.web else None,
                    }
                    for chunk in metadata.grounding_chunks
                ]

            return result if result else None
        except (AttributeError, IndexError):
            return None
