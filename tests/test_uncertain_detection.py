"""测试模糊评论解析."""

import json

import pytest

from review_tagger.core.excel_tagger import ExcelTagger
from review_tagger.config import Settings


class TestUncertainDetection:
    def test_extract_json_matches_keeps_uncertain(self):
        tagger = ExcelTagger()
        text = json.dumps({
            "matches": [
                {"level1": "_uncertain", "level2": "", "level3": "", "confidence": 0.0, "reason": "评论过于模糊/信息不足"},
            ],
            "uncertain": True,
            "authenticity_score": 0.6,
        })
        matches = tagger._extract_json_matches(text)
        assert len(matches) == 1
        assert matches[0]["level1"] == "_uncertain"

    def test_extract_full_result_parses_uncertain(self):
        tagger = ExcelTagger()
        text = json.dumps({
            "matches": [
                {"level1": "_uncertain", "level2": "", "level3": "", "confidence": 0.0, "reason": "评论过于模糊/信息不足"},
            ],
            "uncertain": True,
            "authenticity_score": 0.6,
        })
        result = tagger._extract_full_result(text)
        assert result["uncertain"] is True
        assert result["authenticity_score"] == 0.6
        assert len(result["matches"]) == 1

    def test_extract_full_result_defaults(self):
        tagger = ExcelTagger()
        text = json.dumps({
            "matches": [
                {"level1": "质量", "confidence": 0.9},
            ]
        })
        result = tagger._extract_full_result(text)
        assert result["uncertain"] is False
        assert result["authenticity_score"] == 1.0

    def test_parse_responses_sets_uncertain_status(self):
        from review_tagger.models import Review
        from unittest.mock import MagicMock

        tagger = ExcelTagger()
        review = Review(id="R001", content="还行吧")
        resp = MagicMock()
        resp.id = "R001"
        resp.success = True
        resp.content = json.dumps({
            "matches": [
                {"level1": "_uncertain", "level2": "", "level3": "", "confidence": 0.0, "reason": "评论过于模糊/信息不足"},
            ],
            "uncertain": True,
            "authenticity_score": 0.6,
        })
        results = tagger._parse_responses([review], [resp])
        assert len(results) == 1
        assert results[0]["uncertain"] is True
        assert results[0]["status"] == "uncertain"
        assert results[0]["authenticity_score"] == 0.6

    def test_parse_responses_empty_matches_but_uncertain_true(self):
        from review_tagger.models import Review
        from unittest.mock import MagicMock

        tagger = ExcelTagger()
        review = Review(id="R001", content="一般")
        resp = MagicMock()
        resp.id = "R001"
        resp.success = True
        resp.content = json.dumps({
            "matches": [],
            "uncertain": True,
            "authenticity_score": 0.6,
        })
        results = tagger._parse_responses([review], [resp])
        assert results[0]["uncertain"] is True
        assert results[0]["status"] == "uncertain"
