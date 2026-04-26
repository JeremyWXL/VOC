"""测试多维度标签体系映射引擎."""

import pytest
from review_tagger.core.tag_mapping import (
    Condition,
    Operator,
    TagProfile,
    TagMappingRule,
    TagMappingConfig,
)


class TestCondition:
    def test_eq_true(self):
        c = Condition(column="类目", op=Operator.EQ, value="鞋子")
        assert c.evaluate({"类目": "鞋子"}) is True

    def test_eq_false(self):
        c = Condition(column="类目", op=Operator.EQ, value="鞋子")
        assert c.evaluate({"类目": "上衣"}) is False

    def test_ne(self):
        c = Condition(column="环节", op=Operator.NE, value="购前")
        assert c.evaluate({"环节": "购后"}) is True
        assert c.evaluate({"环节": "购前"}) is False

    def test_contains(self):
        c = Condition(column="内容", op=Operator.CONTAINS, value="好评")
        assert c.evaluate({"内容": "这是一条好评"}) is True
        assert c.evaluate({"内容": "差评"}) is False

    def test_in(self):
        c = Condition(column="类目", op=Operator.IN, value="鞋子,上衣,文胸")
        assert c.evaluate({"类目": "上衣"}) is True
        assert c.evaluate({"类目": "裤子"}) is False

    def test_starts_with(self):
        c = Condition(column="编号", op=Operator.STARTS_WITH, value="SKU")
        assert c.evaluate({"编号": "SKU123"}) is True
        assert c.evaluate({"编号": "ITEM123"}) is False

    def test_ends_with(self):
        c = Condition(column="编号", op=Operator.ENDS_WITH, value="-A")
        assert c.evaluate({"编号": "123-A"}) is True
        assert c.evaluate({"编号": "123-B"}) is False

    def test_regex(self):
        c = Condition(column="内容", op=Operator.REGEX, value=r"^\d+")
        assert c.evaluate({"内容": "123abc"}) is True
        assert c.evaluate({"内容": "abc123"}) is False

    def test_empty_cell(self):
        c = Condition(column="类目", op=Operator.EQ, value="")
        assert c.evaluate({"类目": ""}) is True
        assert c.evaluate({"类目": "鞋子"}) is False


class TestTagMappingRule:
    def test_single_condition_match(self):
        rule = TagMappingRule(
            id="r1",
            conditions=[Condition(column="类目", op=Operator.EQ, value="鞋子")],
            profile_id="p1",
        )
        assert rule.match({"类目": "鞋子", "环节": "购后"}) is True
        assert rule.match({"类目": "上衣"}) is False

    def test_multiple_conditions_and(self):
        rule = TagMappingRule(
            id="r1",
            conditions=[
                Condition(column="类目", op=Operator.EQ, value="鞋子"),
                Condition(column="环节", op=Operator.EQ, value="购后"),
            ],
            profile_id="p1",
        )
        assert rule.match({"类目": "鞋子", "环节": "购后"}) is True
        assert rule.match({"类目": "鞋子", "环节": "购前"}) is False
        assert rule.match({"类目": "上衣", "环节": "购后"}) is False

    def test_no_conditions(self):
        rule = TagMappingRule(id="r1", conditions=[], profile_id="p1")
        assert rule.match({"类目": "鞋子"}) is False


class TestTagMappingConfig:
    def test_resolve_first_match(self):
        config = TagMappingConfig(
            profiles=[
                TagProfile(id="p1", name="鞋子标签", file_path="/tmp/a.csv"),
                TagProfile(id="p2", name="上衣标签", file_path="/tmp/b.csv"),
            ],
            rules=[
                TagMappingRule(
                    id="r1",
                    conditions=[Condition(column="类目", op=Operator.EQ, value="鞋子")],
                    profile_id="p1",
                    priority=1,
                ),
                TagMappingRule(
                    id="r2",
                    conditions=[Condition(column="类目", op=Operator.EQ, value="上衣")],
                    profile_id="p2",
                    priority=1,
                ),
            ],
        )
        assert config.resolve({"类目": "鞋子"}).id == "p1"
        assert config.resolve({"类目": "上衣"}).id == "p2"

    def test_priority_order(self):
        config = TagMappingConfig(
            profiles=[
                TagProfile(id="p1", name="高优先级", file_path="/tmp/a.csv"),
                TagProfile(id="p2", name="低优先级", file_path="/tmp/b.csv"),
            ],
            rules=[
                TagMappingRule(
                    id="r1",
                    conditions=[Condition(column="类目", op=Operator.EQ, value="鞋子")],
                    profile_id="p2",
                    priority=0,
                ),
                TagMappingRule(
                    id="r2",
                    conditions=[Condition(column="类目", op=Operator.EQ, value="鞋子")],
                    profile_id="p1",
                    priority=10,
                ),
            ],
        )
        # 高优先级优先
        assert config.resolve({"类目": "鞋子"}).id == "p1"

    def test_default_fallback(self):
        config = TagMappingConfig(
            profiles=[
                TagProfile(id="p1", name="默认", file_path="/tmp/a.csv"),
                TagProfile(id="p2", name="专用", file_path="/tmp/b.csv"),
            ],
            rules=[
                TagMappingRule(
                    id="r1",
                    conditions=[Condition(column="类目", op=Operator.EQ, value="鞋子")],
                    profile_id="p2",
                ),
            ],
            default_profile_id="p1",
        )
        assert config.resolve({"类目": "裤子"}).id == "p1"

    def test_no_match_no_default_returns_first(self):
        config = TagMappingConfig(
            profiles=[
                TagProfile(id="p1", name="唯一", file_path="/tmp/a.csv"),
            ],
            rules=[],
        )
        assert config.resolve({"类目": "任意"}).id == "p1"

    def test_no_profiles_returns_none(self):
        config = TagMappingConfig(profiles=[], rules=[])
        assert config.resolve({"类目": "任意"}) is None

    def test_serialize_and_deserialize(self):
        config = TagMappingConfig(
            profiles=[TagProfile(id="p1", name="测试", file_path="/tmp/a.csv")],
            rules=[
                TagMappingRule(
                    id="r1",
                    conditions=[Condition(column="x", op=Operator.EQ, value="y")],
                    profile_id="p1",
                ),
            ],
            default_profile_id="p1",
        )
        d = config.to_dict()
        restored = TagMappingConfig.from_dict(d)
        assert len(restored.profiles) == 1
        assert restored.profiles[0].name == "测试"
        assert restored.resolve({"x": "y"}).id == "p1"
