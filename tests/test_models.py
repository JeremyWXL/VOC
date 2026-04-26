"""测试数据模型."""

import pytest
from review_tagger.models import Review, Tag, TagResult, Sentiment, TagCategory, TagSystem, TagSystemCreate


class TestReview:
    def test_create_review(self):
        r = Review(id="R001", content="质量很好", rating=5)
        assert r.id == "R001"
        assert r.content == "质量很好"
        assert r.rating == 5

    def test_review_rating_bounds(self):
        with pytest.raises(Exception):
            Review(content="test", rating=6)
        with pytest.raises(Exception):
            Review(content="test", rating=0)

    def test_review_requires_content(self):
        with pytest.raises(Exception):
            Review(id="R001", content="")


class TestTag:
    def test_create_tag(self):
        t = Tag(category=TagCategory.QUALITY, name="质量好", confidence=0.9)
        assert t.confidence == 0.9
        assert t.source == "llm"

    def test_tag_confidence_bounds(self):
        with pytest.raises(Exception):
            Tag(category=TagCategory.QUALITY, name="test", confidence=1.5)
        with pytest.raises(Exception):
            Tag(category=TagCategory.QUALITY, name="test", confidence=-0.1)


class TestTagResult:
    def test_create_result(self):
        r = TagResult(content="质量很好", tags=[Tag(category=TagCategory.QUALITY, name="质量好")])
        assert r.review_id is None
        assert len(r.tags) == 1
        assert r.source_engine == "llm"

    def test_to_dict(self):
        r = TagResult(content="test")
        d = r.to_dict()
        assert "content" in d
        assert "processed_at" in d


class TestTagSystem:
    def test_create_tag_system(self):
        ts = TagSystem(id="ts_123", name="测试", csv_content="a,b\n1,2\n")
        assert ts.name == "测试"
        assert ts.is_preset == False
        assert ts.scene_type == ""

    def test_tag_system_defaults(self):
        ts = TagSystem(id="ts_456", name="预设", csv_content="x,y\n", is_preset=True)
        assert ts.is_preset == True

    def test_tag_system_create_payload(self):
        payload = TagSystemCreate(name="新建", csv_content="a,b\n")
        assert payload.name == "新建"
        assert payload.scene_type == ""
