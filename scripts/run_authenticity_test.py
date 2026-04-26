#!/usr/bin/env python3
"""真实性评分10条评论实测脚本.

用法:
    # OpenAI
    export OPENAI_API_KEY="sk-xxx"
    uv run python scripts/run_authenticity_test.py

    # 观远模型网关
    export OPENAI_API_KEY="your-token"
    export OPENAI_BASE_URL="https://your-gateway/v1"
    uv run python scripts/run_authenticity_test.py

    # DeepSeek
    export OPENAI_API_KEY="sk-xxx"
    export LLM_PROVIDER=deepseek
    uv run python scripts/run_authenticity_test.py
"""

import asyncio
import os
import sys
from pathlib import Path

# 添加 src 到路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from review_tagger.config import Settings
from review_tagger.core.excel_tagger import ExcelTagger

# ============ 配置区 ============
# 数据文件路径
REVIEW_CSV = "/tmp/test_10_reviews.csv"
TAG_CSV = str(Path(__file__).parent.parent / "configs" / "tag_hierarchy.csv")
OUTPUT_CSV = "/tmp/test_10_tagged.csv"

# 列名配置
CONTENT_COL = "评论内容"
ID_COL = "评论ID"

# LLM 配置（环境变量优先）
API_KEY = os.getenv("OPENAI_API_KEY", "")
BASE_URL = os.getenv("OPENAI_BASE_URL", None)
PROVIDER = os.getenv("LLM_PROVIDER", "openai")
MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
# ================================


async def main():
    if not API_KEY:
        print("❌ 请先设置 OPENAI_API_KEY 环境变量")
        print("   export OPENAI_API_KEY='sk-xxx'")
        sys.exit(1)

    if not Path(REVIEW_CSV).exists():
        print(f"❌ 评论文件不存在: {REVIEW_CSV}")
        sys.exit(1)

    settings = Settings()
    settings.llm.provider = PROVIDER
    settings.llm.model = MODEL
    settings.llm.api_key = API_KEY
    if BASE_URL:
        settings.llm.base_url = BASE_URL
    settings.llm.concurrency = 5
    settings.llm.use_json_mode = True

    print(f"🚀 开始打标测试")
    print(f"   提供商: {PROVIDER}")
    print(f"   模型: {MODEL}")
    print(f"   评论数: 10")
    print(f"   标签体系: {TAG_CSV}")
    print()

    tagger = ExcelTagger(settings)

    try:
        result_path = await tagger.tag_excel(
            review_path=REVIEW_CSV,
            tag_hierarchy_path=TAG_CSV,
            output_path=OUTPUT_CSV,
            content_column=CONTENT_COL,
            id_column=ID_COL,
            output_format="wide",
        )
        print(f"✅ 打标完成: {result_path}")
        print()

        # 读取结果并展示真实性评分分布
        import pandas as pd
        df = pd.read_csv(result_path)

        print("=" * 60)
        print("真实性评分分布")
        print("=" * 60)

        for _, row in df.iterrows():
            rid = row[ID_COL]
            content = row[CONTENT_COL]
            score = row.get("真实性评分", 1.0)
            status = row.get("评论状态", "normal")
            uncertain = row.get("是否模糊", 0)

            bar = "█" * int(score * 20)
            status_icon = {
                "normal": "✅",
                "uncertain": "⚠️",
                "rejected": "❌",
            }.get(status, "?")

            print(f"{status_icon} {rid}: {score:.2f} {bar:20s} | {content[:35]}...")

        print()
        print(f"平均分: {df['真实性评分'].mean():.2f}")
        print(f"最低分: {df['真实性评分'].min():.2f} ({df.loc[df['真实性评分'].idxmin(), ID_COL]})")
        print(f"最高分: {df['真实性评分'].max():.2f} ({df.loc[df['真实性评分'].idxmax(), ID_COL]})")
        print(f"rejected 数: {(df['评论状态'] == 'rejected').sum()}")
        print(f"uncertain 数: {(df['评论状态'] == 'uncertain').sum()}")
        print()
        print(f"📁 结果文件: {OUTPUT_CSV}")

    except Exception as e:
        print(f"❌ 打标失败: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
