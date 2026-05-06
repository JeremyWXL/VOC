"""测试数据加载与导出."""

import json
import tempfile
from pathlib import Path

import pandas as pd
import pytest

from review_tagger.loaders import (
    load_reviews_from_excel,
    load_tag_hierarchy,
    format_tag_tree,
    save_tagged_excel,
)


class TestLoadReviews:
    def test_load_from_csv(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            f.write("评论ID,评论内容,评分\n")
            f.write("R001,质量很好,5\n")
            f.write("R002,物流慢,3\n")
            f.flush()
            path = f.name

        reviews, df = load_reviews_from_excel(path, content_column="评论内容", id_column="评论ID")
        assert len(reviews) == 2
        assert reviews[0].id == "R001"
        assert reviews[0].content == "质量很好"
        assert reviews[1].id == "R002"
        Path(path).unlink()

    def test_load_missing_column(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            f.write("id,text\n")
            f.write("R001,hello\n")
            f.flush()
            path = f.name

        with pytest.raises(ValueError, match="评论文件缺少列"):
            load_reviews_from_excel(path, content_column="评论内容")
        Path(path).unlink()

    def test_load_empty_content_skipped(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            f.write("评论ID,评论内容\n")
            f.write("R001,质量好\n")
            f.write("R002,\n")
            f.flush()
            path = f.name

        reviews, df = load_reviews_from_excel(path, content_column="评论内容", id_column="评论ID")
        assert len(reviews) == 1
        Path(path).unlink()


class TestLoadTagHierarchy:
    def test_load_from_csv(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            f.write("一级标签,二级标签,三级标签\n")
            f.write("商品质量,整体质量,质量好\n")
            f.write("商品质量,整体质量,质量差\n")
            f.write("物流服务,配送速度,速度快\n")
            f.flush()
            path = f.name

        tree = load_tag_hierarchy(path)
        assert "商品质量" in tree
        assert "整体质量" in tree["商品质量"]
        assert set(tree["商品质量"]["整体质量"]) == {"质量好", "质量差"}
        assert "物流服务" in tree
        Path(path).unlink()

    def test_load_missing_columns(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
            f.write("a,b,c\n")
            f.flush()
            path = f.name

        with pytest.raises(ValueError, match="标签体系文件缺少必需列"):
            load_tag_hierarchy(path)
        Path(path).unlink()


class TestFormatTagTree:
    def test_format(self):
        tree = {"质量": {"做工": ["精细", "粗糙"]}}
        text = format_tag_tree(tree)
        assert "- 质量" in text
        assert "做工: 精细, 粗糙" in text


class TestSaveTaggedExcel:
    def test_save_csv_wide(self):
        df = pd.DataFrame({"评论ID": ["R001"], "评论内容": ["质量好"]})
        results = [
            {
                "review_id": "R001",
                "matches": [
                    {"level1": "商品质量", "level2": "整体质量", "level3": "质量好", "confidence": 0.95}
                ],
            }
        ]
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "output.csv"
            save_tagged_excel(df, results, str(path), review_id_column="评论ID", output_format="wide")
            assert path.exists()
            out_df = pd.read_csv(path)
            assert "一级标签" in out_df.columns
            assert out_df["一级标签"][0] == "商品质量"
            assert out_df["二级标签"][0] == "整体质量"
            assert out_df["三级标签"][0] == "质量好"
            assert json.loads(out_df["标签详情(JSON)"][0])[0]["confidence"] == 0.95

    def test_save_xlsx_wide(self):
        df = pd.DataFrame({"评论ID": ["R001"], "评论内容": ["质量好"]})
        results = [{"review_id": "R001", "matches": []}]
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "output.xlsx"
            save_tagged_excel(df, results, str(path), review_id_column="评论ID", output_format="wide")
            assert path.exists()
            out_df = pd.read_excel(path)
            assert "一级标签" in out_df.columns

    def test_save_csv_long(self):
        df = pd.DataFrame({"评论ID": ["R001"], "评论内容": ["质量好"]})
        results = [
            {
                "review_id": "R001",
                "matches": [
                    {"level1": "商品质量", "level2": "整体质量", "level3": "质量好", "confidence": 0.95, "reason": "明确说质量好"},
                    {"level1": "物流服务", "level2": "配送速度", "level3": "速度快", "confidence": 0.88, "reason": "物流很快"},
                ],
            }
        ]
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "output.csv"
            save_tagged_excel(df, results, str(path), review_id_column="评论ID", output_format="long")
            assert path.exists()
            out_df = pd.read_csv(path)
            assert len(out_df) == 2  # 2 条匹配 = 2 行
            assert out_df["一级标签"][0] == "商品质量"
            assert out_df["一级标签"][1] == "物流服务"
            assert out_df["置信度"][0] == 0.95
            assert out_df["匹配原因"][0] == "明确说质量好"

    def test_save_csv_long_no_matches(self):
        import math
        df = pd.DataFrame({"评论ID": ["R001"], "评论内容": ["质量好"]})
        results = [{"review_id": "R001", "matches": []}]
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "output.csv"
            save_tagged_excel(df, results, str(path), review_id_column="评论ID", output_format="long")
            assert path.exists()
            out_df = pd.read_csv(path)
            assert len(out_df) == 1  # 无匹配也保留一行
            assert out_df["一级标签"][0] == "" or pd.isna(out_df["一级标签"][0])
            assert out_df["置信度"][0] == "" or math.isnan(out_df["置信度"][0])
