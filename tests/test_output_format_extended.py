"""测试新输出列."""

import json
import tempfile
from pathlib import Path

import pandas as pd
import pytest

from review_tagger.loaders import save_tagged_excel


class TestOutputFormatExtended:
    def test_wide_format_has_new_columns(self):
        df = pd.DataFrame({"评论ID": ["R001"], "评论内容": ["质量好"]})
        results = [
            {
                "review_id": "R001",
                "matches": [
                    {"level1": "商品质量", "level2": "整体质量", "level3": "质量好", "confidence": 0.95}
                ],
                "uncertain": False,
                "authenticity_score": 0.95,
                "status": "normal",
            }
        ]
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "output.csv"
            save_tagged_excel(df, results, str(path), review_id_column="评论ID", output_format="wide")
            out_df = pd.read_csv(path)
            assert "是否模糊" in out_df.columns
            assert "真实性评分" in out_df.columns
            assert "评论状态" in out_df.columns
            assert out_df["是否模糊"][0] == 0
            assert out_df["真实性评分"][0] == 0.95
            assert out_df["评论状态"][0] == "normal"

    def test_wide_format_uncertain(self):
        df = pd.DataFrame({"评论ID": ["R001"], "评论内容": ["还行吧"]})
        results = [
            {
                "review_id": "R001",
                "matches": [
                    {"level1": "_uncertain", "level2": "", "level3": "", "confidence": 0.0, "reason": "评论过于模糊/信息不足"}
                ],
                "uncertain": True,
                "authenticity_score": 0.6,
                "status": "uncertain",
            }
        ]
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "output.csv"
            save_tagged_excel(df, results, str(path), review_id_column="评论ID", output_format="wide")
            out_df = pd.read_csv(path)
            assert out_df["一级标签"][0] == "_uncertain"
            assert out_df["是否模糊"][0] == 1
            assert out_df["真实性评分"][0] == 0.6
            assert out_df["评论状态"][0] == "uncertain"

    def test_wide_format_rejected(self):
        df = pd.DataFrame({"评论ID": ["R001"], "评论内容": ["模板好评"]})
        results = [
            {
                "review_id": "R001",
                "matches": [
                    {"level1": "商品质量", "confidence": 0.8}
                ],
                "uncertain": False,
                "authenticity_score": 0.2,
                "status": "rejected",
            }
        ]
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "output.csv"
            save_tagged_excel(df, results, str(path), review_id_column="评论ID", output_format="wide")
            out_df = pd.read_csv(path)
            assert out_df["是否模糊"][0] == 0
            assert out_df["真实性评分"][0] == 0.2
            assert out_df["评论状态"][0] == "rejected"

    def test_long_format_has_new_columns(self):
        df = pd.DataFrame({"评论ID": ["R001"], "评论内容": ["质量好"]})
        results = [
            {
                "review_id": "R001",
                "matches": [
                    {"level1": "商品质量", "level2": "整体质量", "level3": "质量好", "confidence": 0.95},
                    {"level1": "物流服务", "level2": "配送速度", "level3": "速度快", "confidence": 0.88},
                ],
                "uncertain": False,
                "authenticity_score": 0.9,
                "status": "normal",
            }
        ]
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "output.csv"
            save_tagged_excel(df, results, str(path), review_id_column="评论ID", output_format="long")
            out_df = pd.read_csv(path)
            assert "是否模糊" in out_df.columns
            assert "真实性评分" in out_df.columns
            assert "评论状态" in out_df.columns
            assert len(out_df) == 2
            assert out_df["是否模糊"][0] == 0
            assert out_df["真实性评分"][1] == 0.9
            assert out_df["评论状态"][0] == "normal"

    def test_long_format_no_matches_has_new_columns(self):
        df = pd.DataFrame({"评论ID": ["R001"], "评论内容": ["质量好"]})
        results = [
            {
                "review_id": "R001",
                "matches": [],
                "uncertain": True,
                "authenticity_score": 0.5,
                "status": "uncertain",
            }
        ]
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "output.csv"
            save_tagged_excel(df, results, str(path), review_id_column="评论ID", output_format="long")
            out_df = pd.read_csv(path)
            assert len(out_df) == 1
            assert out_df["是否模糊"][0] == 1
            assert out_df["真实性评分"][0] == 0.5
            assert out_df["评论状态"][0] == "uncertain"
