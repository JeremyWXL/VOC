"""测试增量打标核心逻辑."""

import json
import pytest
import pandas as pd
from pathlib import Path

from review_tagger.core.incremental import IncrementalTagger
from review_tagger.models import Review


class TestExtractMatchesFromRow:
    def test_from_json_column(self):
        tagger = IncrementalTagger()
        row = pd.Series({
            "标签详情(JSON)": json.dumps([{"level1": "质量", "level2": "面料"}]),
        })
        matches = tagger._extract_matches_from_row(row)
        assert len(matches) == 1
        assert matches[0]["level1"] == "质量"

    def test_from_json_invalid(self):
        tagger = IncrementalTagger()
        row = pd.Series({"标签详情(JSON)": "invalid json"})
        matches = tagger._extract_matches_from_row(row)
        assert matches == []

    def test_from_level_columns(self):
        tagger = IncrementalTagger()
        row = pd.Series({
            "一级标签": "质量",
            "二级标签": "面料",
            "三级标签": "",
            "四级标签": "",
        })
        matches = tagger._extract_matches_from_row(row)
        assert len(matches) == 1
        assert matches[0]["level1"] == "质量"
        assert matches[0]["level2"] == "面料"

    def test_empty_row(self):
        tagger = IncrementalTagger()
        row = pd.Series({})
        matches = tagger._extract_matches_from_row(row)
        assert matches == []


class TestExtractMatchesFromRows:
    def test_multi_rows(self):
        tagger = IncrementalTagger()
        df = pd.DataFrame({
            "一级标签": ["质量", "物流"],
            "二级标签": ["面料", "速度"],
        })
        matches = tagger._extract_matches_from_rows(df)
        assert len(matches) == 2


class TestMergeResults:
    def test_merge_new_and_existing(self):
        tagger = IncrementalTagger()
        reviews = [
            Review(id="r1", content="旧评论"),
            Review(id="r2", content="新评论"),
        ]
        existing_map = {
            "r1": {"matches": [{"level1": "质量"}]},
        }
        new_results = [
            {"review_id": "r2", "matches": [{"level1": "物流"}]},
        ]
        merged = tagger._merge_results(reviews, existing_map, new_results)
        assert len(merged) == 2
        assert merged[0]["review_id"] == "r1"
        assert merged[0]["matches"][0]["level1"] == "质量"
        assert merged[1]["review_id"] == "r2"
        assert merged[1]["matches"][0]["level1"] == "物流"

    def test_merge_no_existing_no_new(self):
        tagger = IncrementalTagger()
        reviews = [Review(id="r1", content="评论")]
        merged = tagger._merge_results(reviews, {}, [])
        assert len(merged) == 1
        assert merged[0]["matches"] == []

    def test_merge_by_content_hash(self):
        tagger = IncrementalTagger()
        reviews = [Review(id="r3", content="评论A")]
        from review_tagger.utils import compute_content_hash
        h = compute_content_hash("评论A")
        existing_map = {
            h: {"matches": [{"level1": "服务"}]},
        }
        merged = tagger._merge_results(reviews, existing_map, [])
        assert len(merged) == 1
        assert merged[0]["matches"][0]["level1"] == "服务"

    def test_merge_preserves_order(self):
        tagger = IncrementalTagger()
        reviews = [
            Review(id="c", content="c"),
            Review(id="a", content="a"),
            Review(id="b", content="b"),
        ]
        new_results = [
            {"review_id": "c", "matches": []},
            {"review_id": "a", "matches": []},
            {"review_id": "b", "matches": []},
        ]
        merged = tagger._merge_results(reviews, {}, new_results)
        assert [m["review_id"] for m in merged] == ["c", "a", "b"]
