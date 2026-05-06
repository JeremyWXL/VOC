"""测试多维度标签体系映射打标器."""

import pytest
import tempfile
from pathlib import Path

from review_tagger.core.tag_mapping import (
    TagMappingConfig,
    TagProfile,
    TagMappingRule,
    Condition,
    Operator,
)
from review_tagger.core.multi_tagger import MultiTagger
from review_tagger.models import Review


@pytest.fixture
def sample_mapping_config(tmp_path) -> TagMappingConfig:
    """构造一个包含两个方案的映射配置，使用临时 CSV 文件."""
    p1 = tmp_path / "p1.csv"
    p2 = tmp_path / "p2.csv"
    p1.write_text("一级标签,二级标签,三级标签,四级标签\n质量,面料,柔软,\n", encoding="utf-8")
    p2.write_text("一级标签,二级标签,三级标签,四级标签\n性能,电池,续航,\n", encoding="utf-8")
    return TagMappingConfig(
        profiles=[
            TagProfile(id="p1", name="服装", file_path=str(p1)),
            TagProfile(id="p2", name="数码", file_path=str(p2)),
        ],
        rules=[
            TagMappingRule(
                id="r1",
                name="服装规则",
                conditions=[Condition(column="类目", op=Operator.EQ, value="服装")],
                profile_id="p1",
                priority=10,
            ),
            TagMappingRule(
                id="r2",
                name="数码规则",
                conditions=[Condition(column="类目", op=Operator.EQ, value="数码")],
                profile_id="p2",
                priority=10,
            ),
        ],
        default_profile_id="p1",
    )


class TestGroupReviewsByProfile:
    def test_group_by_matching_rule(self, sample_mapping_config):
        tagger = MultiTagger(sample_mapping_config)
        reviews = [
            Review(id="1", content="质量好", metadata={"类目": "服装"}),
            Review(id="2", content="电池耐用", metadata={"类目": "数码"}),
            Review(id="3", content="尺码合适", metadata={"类目": "服装"}),
        ]
        groups = tagger._group_reviews_by_profile(reviews)

        assert "p1" in groups
        assert "p2" in groups
        assert len(groups["p1"]) == 2
        assert len(groups["p2"]) == 1
        assert groups["p1"][0].id == "1"
        assert groups["p2"][0].id == "2"

    def test_unmatched_fallback_to_default(self, sample_mapping_config):
        tagger = MultiTagger(sample_mapping_config)
        reviews = [
            Review(id="1", content="未知", metadata={"类目": "食品"}),
        ]
        groups = tagger._group_reviews_by_profile(reviews)

        # 未匹配到规则，应 fallback 到 default_profile_id (p1)
        assert "p1" in groups
        assert len(groups["p1"]) == 1
        assert groups["p1"][0].id == "1"

    def test_no_default_no_profiles(self):
        config = TagMappingConfig(profiles=[], rules=[], default_profile_id=None)
        tagger = MultiTagger(config)
        reviews = [Review(id="1", content="test", metadata={})]
        groups = tagger._group_reviews_by_profile(reviews)
        assert groups == {}

    def test_empty_reviews(self, sample_mapping_config):
        tagger = MultiTagger(sample_mapping_config)
        groups = tagger._group_reviews_by_profile([])
        assert groups == {}


class TestTagMappingResolve:
    def test_resolve_with_rules(self, sample_mapping_config):
        row = {"类目": "服装"}
        profile = sample_mapping_config.resolve(row)
        assert profile is not None
        assert profile.id == "p1"

    def test_resolve_fallback(self, sample_mapping_config):
        row = {"类目": "食品"}
        profile = sample_mapping_config.resolve(row)
        assert profile is not None
        assert profile.id == "p1"  # default

    def test_resolve_no_match_no_default(self):
        config = TagMappingConfig(
            profiles=[TagProfile(id="p1", name="A", file_path="/tmp/a.csv")],
            rules=[TagMappingRule(id="r1", name="R", conditions=[Condition(column="x", op=Operator.EQ, value="y")], profile_id="p1")],
            default_profile_id=None,
        )
        row = {"x": "z"}
        profile = config.resolve(row)
        assert profile is not None  # fallback to first profile
        assert profile.id == "p1"


class TestConditionEvaluate:
    def test_eq(self):
        c = Condition(column="status", op=Operator.EQ, value="ok")
        assert c.evaluate({"status": "ok"}) is True
        assert c.evaluate({"status": "fail"}) is False

    def test_ne(self):
        c = Condition(column="status", op=Operator.NE, value="ok")
        assert c.evaluate({"status": "fail"}) is True
        assert c.evaluate({"status": "ok"}) is False

    def test_contains(self):
        c = Condition(column="text", op=Operator.CONTAINS, value="good")
        assert c.evaluate({"text": "very good"}) is True
        assert c.evaluate({"text": "bad"}) is False

    def test_in(self):
        c = Condition(column="cat", op=Operator.IN, value="a,b,c")
        assert c.evaluate({"cat": "b"}) is True
        assert c.evaluate({"cat": "d"}) is False

    def test_starts_with(self):
        c = Condition(column="name", op=Operator.STARTS_WITH, value="pre")
        assert c.evaluate({"name": "prefix"}) is True
        assert c.evaluate({"name": "suffix"}) is False

    def test_ends_with(self):
        c = Condition(column="name", op=Operator.ENDS_WITH, value="fix")
        assert c.evaluate({"name": "suffix"}) is True
        assert c.evaluate({"name": "hello"}) is False

    def test_regex(self):
        c = Condition(column="code", op=Operator.REGEX, value=r"^\d{3}$")
        assert c.evaluate({"code": "123"}) is True
        assert c.evaluate({"code": "abc"}) is False

    def test_regex_invalid(self):
        c = Condition(column="code", op=Operator.REGEX, value="[invalid")
        assert c.evaluate({"code": "123"}) is False  # 不抛异常

    def test_missing_column(self):
        c = Condition(column="missing", op=Operator.EQ, value="x")
        assert c.evaluate({"other": "x"}) is False
