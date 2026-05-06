"""通用工具函数."""

import hashlib
import re


def strip_markdown_code_blocks(text: str) -> str:
    """去除 LLM 响应中的 markdown 代码块标记."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def compute_content_hash(text: str) -> str:
    """计算文本的 MD5 哈希（用于评论去重/增量）."""
    return hashlib.md5(text.strip().encode("utf-8")).hexdigest()
