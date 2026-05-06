"""Excel / CSV 数据加载与导出."""

import json
from pathlib import Path
from typing import List, Dict, Any, Optional

import pandas as pd
from loguru import logger

from review_tagger.models import Review


def _read_file(path: str, **kwargs: Any) -> pd.DataFrame:
    """根据扩展名自动选择读取方式."""
    p = Path(path)
    if p.suffix.lower() == ".csv":
        # CSV 不支持 sheet_name 等 Excel 特有参数
        csv_kwargs = {k: v for k, v in kwargs.items() if k != "sheet_name"}
        return pd.read_csv(path, **csv_kwargs)
    return pd.read_excel(path, **kwargs)


def load_reviews_from_excel(
    path: str,
    content_column: str = "评论内容",
    id_column: Optional[str] = None,
    **kwargs: Any,
) -> tuple[List[Review], pd.DataFrame]:
    """从 Excel 加载评论，返回 Review 列表和原始 DataFrame."""
    df = _read_file(path, **kwargs)
    if content_column not in df.columns:
        available = ", ".join(f"'{c}'" for c in df.columns)
        raise ValueError(
            f"评论文件缺少列 '{content_column}'\n"
            f"可用列: {available}\n"
            f"提示: 使用 --content-col 参数指定正确的评论内容列名"
        )

    reviews = []
    for idx, row in df.iterrows():
        content = str(row[content_column]) if pd.notna(row[content_column]) else ""
        if not content.strip():
            continue
        rid = str(row[id_column]) if id_column and id_column in df.columns and pd.notna(row[id_column]) else str(idx)
        reviews.append(Review(id=rid, content=content.strip(), metadata=row.to_dict()))

    logger.info(f"从 {path} 加载 {len(reviews)} 条评论")
    return reviews, df


def load_tag_hierarchy(path: str) -> Dict[str, Any]:
    """从 Excel/CSV 加载三级标签体系.

    格式要求列：一级标签, 二级标签, 三级标签（可选：标签描述）
    返回树形结构: {"质量": {"做工": ["精细", "粗糙"], ...}}
    """
    df = _read_file(path)
    required = {"一级标签", "二级标签", "三级标签"}
    missing = required - set(df.columns)
    if missing:
        available = ", ".join(f"'{c}'" for c in df.columns)
        raise ValueError(
            f"标签体系文件缺少必需列: {', '.join(missing)}\n"
            f"可用列: {available}\n"
            f"提示: 标签体系文件必须包含 '一级标签', '二级标签', '三级标签' 三列"
        )

    tree: Dict[str, Any] = {}
    for _, row in df.iterrows():
        l1 = str(row["一级标签"]).strip() if pd.notna(row["一级标签"]) else ""
        l2 = str(row["二级标签"]).strip() if pd.notna(row["二级标签"]) else ""
        l3 = str(row["三级标签"]).strip() if pd.notna(row["三级标签"]) else ""
        if not l1 or not l2 or not l3:
            continue
        if l1 not in tree:
            tree[l1] = {}
        if l2 not in tree[l1]:
            tree[l1][l2] = []
        if l3 not in tree[l1][l2]:
            tree[l1][l2].append(l3)

    logger.info(f"从 {path} 加载标签体系: {len(tree)} 个一级标签")
    return tree


def format_tag_tree(tree: Dict[str, Any]) -> str:
    """将标签树格式化为文本，用于 Prompt."""
    lines = []
    for l1, l2_dict in tree.items():
        lines.append(f"- {l1}")
        for l2, l3_list in l2_dict.items():
            l3_str = ", ".join(l3_list)
            lines.append(f"  - {l2}: {l3_str}")
    return "\n".join(lines)


def _build_wide_df(
    df: pd.DataFrame,
    tag_map: Dict[str, Dict[str, Any]],
    review_id_column: Optional[str] = None,
) -> pd.DataFrame:
    """构建宽格式 DataFrame（每评论一行，标签逗号分隔）."""
    out_df = df.copy()
    level1_list: List[str] = []
    level2_list: List[str] = []
    level3_list: List[str] = []
    detail_list: List[str] = []
    uncertain_list: List[int] = []
    authenticity_list: List[float] = []
    status_list: List[str] = []

    for idx, row in out_df.iterrows():
        rid = str(row[review_id_column]) if review_id_column and review_id_column in out_df.columns else str(idx)
        res = tag_map.get(rid, {})
        matches = res.get("matches", [])
        l1_set = set()
        l2_set = set()
        l3_set = set()
        for m in matches:
            if m.get("level1"):
                l1_set.add(m["level1"])
            if m.get("level2"):
                l2_set.add(m["level2"])
            if m.get("level3"):
                l3_set.add(m["level3"])

        level1_list.append(", ".join(sorted(l1_set)) if l1_set else "")
        level2_list.append(", ".join(sorted(l2_set)) if l2_set else "")
        level3_list.append(", ".join(sorted(l3_set)) if l3_set else "")
        detail_list.append(json.dumps(matches, ensure_ascii=False) if matches else "")
        uncertain_list.append(1 if res.get("uncertain") else 0)
        authenticity_list.append(res.get("authenticity_score", 1.0))
        status_list.append(res.get("status", "normal"))

    out_df["一级标签"] = level1_list
    out_df["二级标签"] = level2_list
    out_df["三级标签"] = level3_list
    out_df["标签详情(JSON)"] = detail_list
    out_df["是否模糊"] = uncertain_list
    out_df["真实性评分"] = authenticity_list
    out_df["评论状态"] = status_list
    return out_df


def _build_long_df(
    df: pd.DataFrame,
    tag_map: Dict[str, Dict[str, Any]],
    review_id_column: Optional[str] = None,
) -> pd.DataFrame:
    """构建长格式 DataFrame（每标签匹配一行）."""
    rows: List[Dict[str, Any]] = []
    df_cols = list(df.columns)

    for idx, row in df.iterrows():
        rid = str(row[review_id_column]) if review_id_column and review_id_column in df.columns else str(idx)
        res = tag_map.get(rid, {})
        matches = res.get("matches", [])
        uncertain = 1 if res.get("uncertain") else 0
        authenticity_score = res.get("authenticity_score", 1.0)
        status = res.get("status", "normal")

        base_row = {col: row[col] for col in df_cols}

        if not matches:
            # 无匹配时保留一行，标签列为空
            base_row["一级标签"] = ""
            base_row["二级标签"] = ""
            base_row["三级标签"] = ""
            base_row["置信度"] = ""
            base_row["匹配原因"] = ""
            base_row["是否模糊"] = uncertain
            base_row["真实性评分"] = authenticity_score
            base_row["评论状态"] = status
            rows.append(base_row)
        else:
            for m in matches:
                match_row = base_row.copy()
                match_row["一级标签"] = m.get("level1", "")
                match_row["二级标签"] = m.get("level2", "")
                match_row["三级标签"] = m.get("level3", "")
                match_row["置信度"] = m.get("confidence", "")
                match_row["匹配原因"] = m.get("reason", "")
                match_row["是否模糊"] = uncertain
                match_row["真实性评分"] = authenticity_score
                match_row["评论状态"] = status
                rows.append(match_row)

    long_df = pd.DataFrame(rows)
    # 调整列顺序：原表列在前，标签列在后
    tag_cols = ["一级标签", "二级标签", "三级标签", "置信度", "匹配原因", "是否模糊", "真实性评分", "评论状态"]
    ordered_cols = df_cols + [c for c in tag_cols if c in long_df.columns]
    return long_df[ordered_cols]


def save_tagged_excel(
    df: pd.DataFrame,
    results: List[Dict[str, Any]],
    output_path: str,
    review_id_column: Optional[str] = None,
    output_format: str = "wide",
) -> None:
    """将打标结果合并回 DataFrame 并保存为 Excel/CSV.

    results 中每条需包含 review_id 和标签字段.
    output_format: wide（每评论一行，标签逗号分隔）或 long（每标签匹配一行）.
    """
    # 建立 id -> 标签的映射
    tag_map: Dict[str, Dict[str, Any]] = {}
    for r in results:
        rid = str(r.get("review_id", ""))
        tag_map[rid] = r

    if output_format == "long":
        out_df = _build_long_df(df, tag_map, review_id_column=review_id_column)
    else:
        out_df = _build_wide_df(df, tag_map, review_id_column=review_id_column)

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    suffix = Path(output_path).suffix.lower()
    if suffix == ".csv":
        out_df.to_csv(output_path, index=False, encoding="utf-8-sig")
    else:
        out_df.to_excel(output_path, index=False)
    logger.info(f"结果已保存至: {output_path} ({output_format} 格式)")
