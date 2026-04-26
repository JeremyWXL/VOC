"""测试真实性评分解析."""

import json

import pytest
from unittest.mock import MagicMock, patch

from review_tagger.core.excel_tagger import ExcelTagger
from review_tagger.config import Settings
from review_tagger.models import Review


class TestAuthenticity:
    def test_extract_full_result_parses_authenticity_score(self):
        tagger = ExcelTagger()
        text = json.dumps({
            "matches": [
                {"level1": "质量", "confidence": 0.9},
            ],
            "uncertain": False,
            "authenticity_score": 0.2,
        })
        result = tagger._extract_full_result(text)
        assert result["authenticity_score"] == 0.2

    def test_parse_responses_warns_low_authenticity(self):
        tagger = ExcelTagger()
        review = Review(id="R001", content="非常好的商品，强烈推荐！")
        resp = MagicMock()
        resp.id = "R001"
        resp.success = True
        resp.content = json.dumps({
            "matches": [
                {"level1": "商品质量", "confidence": 0.9},
            ],
            "uncertain": False,
            "authenticity_score": 0.2,
        })
        with patch("review_tagger.core.excel_tagger.logger") as mock_logger:
            results = tagger._parse_responses([review], [resp])
        assert len(results) == 1
        assert results[0]["authenticity_score"] == 0.2
        mock_logger.warning.assert_called_once()
        assert "真实性评分较低" in mock_logger.warning.call_args[0][0]

    def test_parse_responses_rejected_below_min_score(self):
        settings = Settings()
        settings.tagger.min_authenticity_score = 0.3
        tagger = ExcelTagger(settings=settings)
        review = Review(id="R001", content="非常好的商品，强烈推荐！")
        resp = MagicMock()
        resp.id = "R001"
        resp.success = True
        resp.content = json.dumps({
            "matches": [
                {"level1": "商品质量", "confidence": 0.9},
            ],
            "uncertain": False,
            "authenticity_score": 0.2,
        })
        results = tagger._parse_responses([review], [resp])
        assert results[0]["status"] == "rejected"

    def test_parse_responses_normal_above_min_score(self):
        settings = Settings()
        settings.tagger.min_authenticity_score = 0.3
        tagger = ExcelTagger(settings=settings)
        review = Review(id="R001", content="质量很好")
        resp = MagicMock()
        resp.id = "R001"
        resp.success = True
        resp.content = json.dumps({
            "matches": [
                {"level1": "商品质量", "confidence": 0.9},
            ],
            "uncertain": False,
            "authenticity_score": 0.8,
        })
        results = tagger._parse_responses([review], [resp])
        assert results[0]["status"] == "normal"

    def test_custom_min_authenticity_score(self):
        settings = Settings()
        settings.tagger.min_authenticity_score = 0.5
        tagger = ExcelTagger(settings=settings)
        review = Review(id="R001", content="质量很好")
        resp = MagicMock()
        resp.id = "R001"
        resp.success = True
        resp.content = json.dumps({
            "matches": [
                {"level1": "商品质量", "confidence": 0.9},
            ],
            "uncertain": False,
            "authenticity_score": 0.4,
        })
        results = tagger._parse_responses([review], [resp])
        assert results[0]["status"] == "rejected"

    def test_extract_full_result_regex_fallback_for_authenticity(self):
        tagger = ExcelTagger()
        text = 'some text "matches": [{"level1": "质量", "confidence": 0.8}] "uncertain": true "authenticity_score": 0.15 more text'
        result = tagger._extract_full_result(text)
        assert result["uncertain"] is True
        assert result["authenticity_score"] == 0.15
        assert len(result["matches"]) == 1
