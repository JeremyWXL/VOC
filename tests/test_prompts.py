"""测试 Prompt 构建."""

import json

from review_tagger.prompts.templates import build_system_prompt, build_tagging_prompt


class TestBuildSystemPrompt:
    def test_contains_tag_tree(self):
        prompt = build_system_prompt("- 质量\n  - 做工: 精细")
        assert "标签体系" in prompt
        assert "- 质量" in prompt
        assert "confidence >= 0.7" in prompt

    def test_custom_instructions(self):
        prompt = build_system_prompt("tree", custom_instructions="只输出一个标签")
        assert "额外指令" in prompt
        assert "只输出一个标签" in prompt


class TestBuildTaggingPrompt:
    def test_basic_structure(self):
        messages = build_tagging_prompt("质量很好", "- 质量\n  - 做工: 精细")
        assert len(messages) == 2
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"
        assert "质量很好" in messages[1]["content"]

    def test_with_product_and_rating(self):
        messages = build_tagging_prompt("test", "tree", product_name="T恤", rating=4)
        last_msg = messages[-1]["content"]
        assert "【商品：T恤】" in last_msg
        assert "【评分：4星】" in last_msg

    def test_few_shot_examples(self):
        examples = [
            {
                "content": "质量好",
                "output": {"matches": [{"level1": "质量", "level2": "做工", "level3": "精细", "confidence": 0.9}]},
            }
        ]
        messages = build_tagging_prompt("test", "tree", few_shot=examples)
        # system + user + assistant + current user = 4
        assert len(messages) == 4
        assert messages[1]["role"] == "user"
        assert messages[2]["role"] == "assistant"
