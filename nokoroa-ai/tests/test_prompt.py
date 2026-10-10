"""system prompt の契約。

関連投稿カードの絞り込み (chat.service.ts の relatedPostsEvent) は、AI が
申告マーカーを出すことが前提になっている。ガイドラインが消えたり文言が
崩れたりすると、AI はマーカーを出さなくなり常時フォールバック(全件表示)へ
静かに退化する。他のどのテストも green のままなので、ここで固定する。
"""

import pytest

from app.routers.chat import _USED_POSTS_RE
from app.services.prompt import (
    SYSTEM_PROMPT,
    SYSTEM_PROMPT_WITHOUT_SEARCH,
    USED_POSTS_CLOSE,
    USED_POSTS_OPEN,
)

# gemini 経路 / claude 経路。片方だけに入っていると、その経路だけ無効化される。
ALL_SYSTEM_PROMPTS = [SYSTEM_PROMPT, SYSTEM_PROMPT_WITHOUT_SEARCH]


@pytest.mark.parametrize("prompt", ALL_SYSTEM_PROMPTS)
def test_system_prompt_instructs_the_citation_marker(prompt):
    assert USED_POSTS_OPEN in prompt
    assert USED_POSTS_CLOSE in prompt
    # 候補行の [id:N] と申告の対応を AI の推測任せにしない
    assert "[id:N]" in prompt


@pytest.mark.parametrize("prompt", ALL_SYSTEM_PROMPTS)
def test_system_prompt_marker_example_uses_no_real_id(prompt):
    """書式例に実在しうる id を書かない。

    例をそのまま真似た出力が候補と一致すると、本文が触れていない投稿の
    カードが出る (候補外 id のときのフォールバックも効かない)。
    """
    for match in _USED_POSTS_RE.finditer(prompt):
        assert not any(char.isdigit() for char in match.group(1))
