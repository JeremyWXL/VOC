"""测试 ExcelTagger 核心流程."""

import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pandas as pd
import pytest

from review_tagger.core.excel_tagger import ExcelTagger
from review_tagger.config import Settings


class TestExcelTagger:
    def test_extract_json_matches_basic(self):
        tagger = ExcelTagger()
        text = json.dumps({
            "matches": [
                {"level1": "质量", "level2": "做工", "level3": "精细", "confidence": 0.9},
                {"level1": "物流", "level2": "速度", "level3": "慢", "confidence": 0.5},
            ]
        })
        matches = tagger._extract_json_matches(text)
        assert len(matches) == 1
        assert matches[0]["level3"] == "精细"

    def test_extract_json_matches_with_markdown(self):
        tagger = ExcelTagger()
        text = "```json\n" + json.dumps({
            "matches": [{"level1": "质量", "confidence": 0.85}]
        }) + "\n```"
        matches = tagger._extract_json_matches(text)
        assert len(matches) == 1

    def test_extract_json_matches_fallback_regex(self):
        tagger = ExcelTagger()
        text = 'some text "matches": [{"level1": "质量", "confidence": 0.8}] more text'
        matches = tagger._extract_json_matches(text)
        assert len(matches) == 1

    def test_extract_json_matches_empty(self):
        tagger = ExcelTagger()
        matches = tagger._extract_json_matches('{"matches": []}')
        assert matches == []

    def test_extract_json_matches_invalid_json(self):
        tagger = ExcelTagger()
        matches = tagger._extract_json_matches("not json at all")
        assert matches == []

    def test_custom_confidence_threshold(self):
        settings = Settings()
        settings.tagger.confidence_threshold = 0.8
        tagger = ExcelTagger(settings=settings)
        text = json.dumps({
            "matches": [
                {"level1": "质量", "confidence": 0.85},
                {"level1": "物流", "confidence": 0.75},
            ]
        })
        matches = tagger._extract_json_matches(text)
        assert len(matches) == 1
        assert matches[0]["level1"] == "质量"

    def test_preview_prompt(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            f.write("一级标签,二级标签,三级标签\n")
            f.write("质量,做工,精细\n")
            f.flush()
            path = f.name

        tagger = ExcelTagger()
        prompt = tagger.preview_prompt("质量很好", path)
        assert "质量很好" in prompt
        assert "标签体系" in prompt
        Path(path).unlink()

    @pytest.mark.asyncio
    async def test_tag_excel_end_to_end(self, monkeypatch):
        """端到端测试，mock LLM 调用."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # 准备评论文件
            review_path = Path(tmpdir) / "reviews.csv"
            pd.DataFrame({
                "评论ID": ["R001"],
                "评论内容": ["质量很好"],
            }).to_csv(review_path, index=False, encoding="utf-8-sig")

            # 准备标签体系文件
            tag_path = Path(tmpdir) / "tags.csv"
            pd.DataFrame({
                "一级标签": ["商品质量"],
                "二级标签": ["整体质量"],
                "三级标签": ["质量好"],
            }).to_csv(tag_path, index=False, encoding="utf-8-sig")

            output_path = Path(tmpdir) / "output.xlsx"

            tagger = ExcelTagger()
            # mock LLM client
            mock_response = MagicMock()
            mock_response.id = "R001"
            mock_response.content = json.dumps({
                "matches": [{"level1": "商品质量", "level2": "整体质量", "level3": "质量好", "confidence": 0.95}]
            })
            mock_response.success = True

            mock_client = MagicMock()
            mock_client.batch_call = AsyncMock(return_value=[mock_response])
            tagger._llm_client = mock_client

            result = await tagger.tag_excel(
                review_path=str(review_path),
                tag_hierarchy_path=str(tag_path),
                output_path=str(output_path),
                content_column="评论内容",
                id_column="评论ID",
                output_format="wide",
            )
            assert result == str(output_path)
            assert output_path.exists()

            df = pd.read_excel(output_path)
            assert df["一级标签"][0] == "商品质量"
            assert df["二级标签"][0] == "整体质量"
            assert df["三级标签"][0] == "质量好"
