#!/usr/bin/env python3
"""端到端测试：使用我（AI）生成的 Mock LLM 响应，验证完整数据链路."""

import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from review_tagger.loaders import (
    load_reviews_from_excel,
    load_tag_hierarchy,
    format_tag_tree,
    save_tagged_excel,
)
from review_tagger.core.excel_tagger import ExcelTagger
from review_tagger.config import Settings

# 1. 加载评论和标签体系
reviews, df = load_reviews_from_excel(
    "data/samples/reviews.csv",
    content_column="评论内容",
    id_column="评论ID",
)
tree = load_tag_hierarchy("data/samples/tag_hierarchy.csv")
tree_text = format_tag_tree(tree)

print("=" * 60)
print("步骤 1: 数据加载")
print(f"  评论数: {len(reviews)}")
print(f"  标签体系: {len(tree)} 个一级分类")
print("=" * 60)

# 2. 展示 Prompt（模拟 LLM 输入）
print("\n步骤 2: Prompt 预览（每条评论的 LLM 输入）")
tagger = ExcelTagger(Settings())
for r in reviews[:2]:
    messages = tagger._build_requests([r], tree_text)[0].messages
    print(f"\n--- 评论 [{r.id}] ---")
    print(f"System: {messages[0]['content'][:200]}...")
    print(f"User: {messages[-1]['content']}")

print("\n" + "=" * 60)
print("步骤 3: Mock LLM 响应（由 AI 生成）")
print("=" * 60)

# 3. 读取 Mock LLM 响应
mock_path = Path("data/mock/llm_responses.jsonl")
mock_map = {}
with open(mock_path, "r", encoding="utf-8") as f:
    for line in f:
        obj = json.loads(line)
        mock_map[obj["review_id"]] = obj["raw"]

print(f"  加载 {len(mock_map)} 条 mock 响应")
for rid, raw in mock_map.items():
    parsed = json.loads(raw)
    matches = parsed.get("matches", [])
    print(f"\n  [{rid}] -> {len(matches)} 个标签")
    for m in matches:
        print(f"      {m['level1']} / {m['level2']} / {m['level3']} (conf={m['confidence']})")

# 4. 模拟解析流程（跳过真实 LLM 调用）
print("\n" + "=" * 60)
print("步骤 4: 解析 Mock 响应并生成结果")
print("=" * 60)

results = []
for r in reviews:
    rid = r.id or ""
    raw = mock_map.get(rid, "{}")
    matches = tagger._extract_json_matches(raw)
    results.append({
        "review_id": rid,
        "matches": matches,
        "raw": raw,
    })
    print(f"  [{rid}] 解析出 {len(matches)} 个标签")

# 5. 输出到 CSV
output_path = "data/mock/tagged_output.csv"
save_tagged_excel(df, results, output_path, review_id_column="评论ID")

# 6. 读取并展示最终结果
print("\n" + "=" * 60)
print("步骤 5: 最终结果")
print("=" * 60)

import pandas as pd
out_df = pd.read_csv(output_path)
print(f"\n输出文件: {output_path}")
print(f"总列数: {len(out_df.columns)}")
print(f"新增标签列: 一级标签, 二级标签, 三级标签, 标签详情(JSON)")

print("\n" + "-" * 80)
display_cols = ["评论ID", "评论内容", "评分", "一级标签", "二级标签", "三级标签"]
print(out_df[display_cols].to_string(index=False))
print("-" * 80)

print("\n✅ 端到端验证完成！")
