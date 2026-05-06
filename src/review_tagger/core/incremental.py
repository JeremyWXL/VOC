"""增量打标核心 — 复用 ExcelTagger，仅对新增评论调用 LLM."""

import hashlib
import json
from typing import Any, Dict, List, Optional

import pandas as pd
from loguru import logger

from review_tagger.core.excel_tagger import ExcelTagger
from review_tagger.utils import compute_content_hash
from review_tagger.loaders import (
    _read_file,
    load_reviews_from_excel,
    save_tagged_excel,
)
from review_tagger.models import Review


class IncrementalTagger(ExcelTagger):
    """支持增量打标的标签器."""

    async def tag_excel_incremental(
        self,
        review_path: str,
        tag_hierarchy_path: str,
        output_path: str,
        previous_output_path: Optional[str] = None,
        content_column: str = "评论内容",
        id_column: Optional[str] = None,
        sheet_name: Optional[str] = None,
        output_format: str = "wide",
        strategy: str = "skip_existing",
    ) -> dict:
        """增量打标主流程.

        1. 加载新评论数据
        2. 如果提供了 previous_output_path，读取已有结果
        3. 通过 review_id 或 content_hash 匹配，找出未打标的评论
        4. 仅对未打标评论调用 LLM
        5. 合并新旧结果，输出完整文件
        6. 返回统计信息 {"total": x, "new": x, "skipped": x, "failed": x, "results": [...]}
        """
        from review_tagger.loaders import format_tag_tree, load_tag_hierarchy

        reviews, df = load_reviews_from_excel(
            review_path,
            content_column=content_column,
            id_column=id_column,
            sheet_name=sheet_name,
        )
        if not reviews:
            raise ValueError("没有加载到任何评论")

        tag_tree = load_tag_hierarchy(tag_hierarchy_path)
        tag_tree_text = format_tag_tree(tag_tree)

        existing_map: Dict[str, Dict[str, Any]] = {}
        if previous_output_path and strategy == "skip_existing":
            from pathlib import Path as _Path

            if _Path(previous_output_path).exists():
                existing_map = self._load_previous_output(
                    previous_output_path,
                    id_column=id_column,
                    content_column=content_column,
                )
                logger.info(f"加载已有结果: {len(existing_map)} 条唯一记录")

        if strategy == "re_tag_all":
            reviews_to_tag = reviews
            skipped = 0
        else:
            reviews_to_tag = []
            for r in reviews:
                key = r.id if r.id else ""
                if key and key in existing_map:
                    continue
                content_hash = compute_content_hash(r.content)
                if content_hash in existing_map:
                    continue
                reviews_to_tag.append(r)
            skipped = len(reviews) - len(reviews_to_tag)

        logger.info(f"增量打标: 总计 {len(reviews)}, 需打标 {len(reviews_to_tag)}, 跳过 {skipped}")

        failed = 0
        new_results: List[Dict[str, Any]] = []
        if reviews_to_tag:
            requests = self._build_requests(reviews_to_tag, tag_tree_text)
            cb = self._external_progress_cb or self._progress_cb
            responses = await self._get_llm_client().batch_call(requests, progress_callback=cb)
            new_results = self._parse_responses(reviews_to_tag, responses)
            for res in new_results:
                if res.get("error"):
                    failed += 1

        merged_results = self._merge_results(reviews, existing_map, new_results)
        save_tagged_excel(
            df,
            merged_results,
            output_path,
            review_id_column=id_column,
            output_format=output_format,
        )

        return {
            "total": len(reviews),
            "new": len(reviews_to_tag),
            "skipped": skipped,
            "failed": failed,
            "output_path": output_path,
            "results": merged_results,
        }

    def _load_previous_output(
        self,
        path: str,
        id_column: Optional[str],
        content_column: str,
    ) -> Dict[str, Dict[str, Any]]:
        """读取已有打标结果，建立 id / content_hash -> result 映射."""
        df = _read_file(path)
        existing: Dict[str, Dict[str, Any]] = {}

        id_col = id_column if id_column and id_column in df.columns else None
        content_col = content_column if content_column in df.columns else None

        # 判断是否为 long 格式（存在重复 ID 或内容）
        is_long = False
        if id_col and df[id_col].duplicated().any():
            is_long = True
        elif content_col and df[content_col].duplicated().any():
            is_long = True

        if is_long and (id_col or content_col):
            group_col = id_col if id_col else content_col
            for gid, group in df.groupby(group_col, sort=False):
                matches = self._extract_matches_from_rows(group)
                result = {"matches": matches}
                existing[str(gid)] = result
                if content_col:
                    content = str(gid).strip()
                    if content:
                        h = compute_content_hash(content)
                        existing[h] = result
        else:
            for idx, row in df.iterrows():
                rid = str(row[id_col]) if id_col and pd.notna(row[id_col]) else str(idx)
                content = (
                    str(row[content_col]).strip()
                    if content_col and pd.notna(row[content_col])
                    else ""
                )
                result = self._extract_matches_from_row(row)
                existing[rid] = result
                if content:
                    h = compute_content_hash(content)
                    existing[h] = result

        return existing

    def _extract_matches_from_row(self, row: pd.Series) -> List[Dict[str, Any]]:
        """从单行提取标签匹配."""
        if "标签详情(JSON)" in row.index and pd.notna(row["标签详情(JSON)"]):
            try:
                matches = json.loads(str(row["标签详情(JSON)"]))
                if isinstance(matches, list):
                    return matches
            except Exception:
                pass

        matches = []
        l1 = str(row["一级标签"]) if "一级标签" in row.index and pd.notna(row["一级标签"]) else ""
        l2 = str(row["二级标签"]) if "二级标签" in row.index and pd.notna(row["二级标签"]) else ""
        l3 = str(row["三级标签"]) if "三级标签" in row.index and pd.notna(row["三级标签"]) else ""
        l4 = str(row["四级标签"]) if "四级标签" in row.index and pd.notna(row["四级标签"]) else ""
        conf = row["置信度"] if "置信度" in row.index and pd.notna(row["置信度"]) else 1.0
        reason = (
            str(row["匹配原因"])
            if "匹配原因" in row.index and pd.notna(row["匹配原因"])
            else "已有结果导入"
        )

        if l1 or l2 or l3 or l4:
            matches.append(
                {
                    "level1": l1,
                    "level2": l2,
                    "level3": l3,
                    "level4": l4,
                    "confidence": float(conf) if isinstance(conf, (int, float)) else 1.0,
                    "reason": reason,
                }
            )
        return matches

    def _extract_matches_from_rows(self, group: pd.DataFrame) -> List[Dict[str, Any]]:
        """从多行（long 格式）提取标签匹配."""
        matches: List[Dict[str, Any]] = []
        for _, row in group.iterrows():
            matches.extend(self._extract_matches_from_row(row))
        return matches

    def _merge_results(
        self,
        reviews: List[Review],
        existing_map: Dict[str, Dict[str, Any]],
        new_results: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """合并新旧结果，保持与原始评论相同的顺序."""
        new_map = {r.get("review_id", ""): r for r in new_results}
        merged: List[Dict[str, Any]] = []

        for r in reviews:
            rid = r.id or ""
            res = new_map.get(rid)
            if not res:
                content_hash = compute_content_hash(r.content)
                res = existing_map.get(rid) or existing_map.get(content_hash)
            if not res:
                res = {"review_id": rid, "matches": []}
            else:
                res = dict(res)
                res["review_id"] = rid
            merged.append(res)

        return merged
