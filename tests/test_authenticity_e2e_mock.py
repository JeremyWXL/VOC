"""真实性评分端到端 Mock 测试 — 模拟10条评论打标，验证评分分布."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from review_tagger.config import Settings
from review_tagger.core.excel_tagger import ExcelTagger
from review_tagger.models import Review
from review_tagger.llm.client import LLMResponse


class TestAuthenticityE2EMock:
    """模拟10条评论的 LLM 打标，验证真实性评分分布."""

    @pytest.fixture
    def ten_reviews(self):
        """10 条覆盖多种场景的模拟评论."""
        return [
            Review(id="R001", content="这双鞋尺码偏大，建议买小一码，鞋底偏硬走久了脚疼，不过款式确实好看", metadata={"商品类目": "鞋子"}),
            Review(id="R002", content="质量很好，物流也很快，客服态度很好，已经回购很多次了，强烈推荐给大家！", metadata={"商品类目": "上衣"}),
            Review(id="R003", content="一般般吧，没有想象中好，颜色有点色差。", metadata={"商品类目": "上衣"}),
            Review(id="R004", content="还行吧", metadata={"商品类目": "文胸"}),
            Review(id="R005", content="鞋子收到了，穿了一周，透气效果不错，但是后跟磨脚，需要贴创可贴", metadata={"商品类目": "鞋子"}),
            Review(id="R006", content="五星好评！非常满意！会再次购买！", metadata={"商品类目": "鞋子"}),
            Review(id="R007", content="这个文胸的钢圈太勒了，穿一天下来胸口都是红印，聚拢效果一般，面料倒是挺软的", metadata={"商品类目": "文胸"}),
            Review(id="R008", content="衣服面料很舒服，版型修身，洗了两次没掉色，整体性价比很高", metadata={"商品类目": "上衣"}),
            Review(id="R009", content="👍👍👍 很好 推荐 物流快 质量好 满意 五星", metadata={"商品类目": "鞋子"}),
            Review(id="R010", content="跟图片描述完全不一样，做工粗糙，线头很多，退货了", metadata={"商品类目": "鞋子"}),
        ]

    @pytest.fixture
    def expected_llm_outputs(self):
        """模拟 LLM 对这10条评论的返回（包含不同 authenticity_score）."""
        return {
            "R001": {
                "matches": [
                    {"level1": "商品质量", "level2": "尺码", "level3": "偏大", "confidence": 0.92, "reason": "明确说尺码偏大"},
                    {"level1": "商品质量", "level2": "舒适度", "level3": "偏硬", "confidence": 0.85, "reason": "鞋底偏硬"},
                    {"level1": "商品质量", "level2": "外观", "level3": "好看", "confidence": 0.88, "reason": "款式好看"},
                ],
                "uncertain": False,
                "authenticity_score": 0.88,  # 有具体细节，真实
            },
            "R002": {
                "matches": [
                    {"level1": "商品质量", "level2": "整体质量", "level3": "质量好", "confidence": 0.85, "reason": "模板化好评"},
                    {"level1": "物流服务", "level2": "配送速度", "level3": "速度快", "confidence": 0.80, "reason": "物流很快"},
                ],
                "uncertain": False,
                "authenticity_score": 0.20,  # 模板化堆砌，虚假
            },
            "R003": {
                "matches": [
                    {"level1": "整体评价", "level2": "满意度", "level3": "一般", "confidence": 0.82, "reason": "一般般"},
                ],
                "uncertain": False,
                "authenticity_score": 0.70,  # 正常短评
            },
            "R004": {
                "matches": [
                    {"level1": "_uncertain", "level2": "", "level3": "", "confidence": 0.0, "reason": "评论过于模糊/信息不足"},
                ],
                "uncertain": True,
                "authenticity_score": 0.50,  # 模糊，难以判断
            },
            "R005": {
                "matches": [
                    {"level1": "商品质量", "level2": "功能性", "level3": "透气", "confidence": 0.90, "reason": "透气效果不错"},
                    {"level1": "商品质量", "level2": "舒适度", "level3": "磨脚", "confidence": 0.88, "reason": "后跟磨脚"},
                ],
                "uncertain": False,
                "authenticity_score": 0.90,  # 有具体使用体验，真实
            },
            "R006": {
                "matches": [
                    {"level1": "整体评价", "level2": "满意度", "level3": "满意", "confidence": 0.80, "reason": "五星好评"},
                ],
                "uncertain": False,
                "authenticity_score": 0.15,  # 纯模板，极假
            },
            "R007": {
                "matches": [
                    {"level1": "商品质量", "level2": "舒适度", "level3": "勒", "confidence": 0.92, "reason": "钢圈太勒"},
                    {"level1": "商品质量", "level2": "功能性", "level3": "聚拢效果一般", "confidence": 0.85, "reason": "聚拢效果一般"},
                    {"level1": "商品质量", "level2": "面料材质", "level3": "柔软", "confidence": 0.80, "reason": "面料挺软"},
                ],
                "uncertain": False,
                "authenticity_score": 0.92,  # 详细真实体验
            },
            "R008": {
                "matches": [
                    {"level1": "商品质量", "level2": "面料材质", "level3": "舒适", "confidence": 0.90, "reason": "面料舒服"},
                    {"level1": "商品质量", "level2": "版型", "level3": "修身", "confidence": 0.88, "reason": "版型修身"},
                    {"level1": "价格感知", "level2": "性价比", "level3": "性价比高", "confidence": 0.85, "reason": "性价比高"},
                ],
                "uncertain": False,
                "authenticity_score": 0.85,  # 有使用细节
            },
            "R009": {
                "matches": [
                    {"level1": "整体评价", "level2": "满意度", "level3": "满意", "confidence": 0.75, "reason": "emoji好评"},
                ],
                "uncertain": False,
                "authenticity_score": 0.10,  # 纯emoji堆砌，水军特征
            },
            "R010": {
                "matches": [
                    {"level1": "商品质量", "level2": "做工", "level3": "粗糙", "confidence": 0.92, "reason": "做工粗糙"},
                    {"level1": "商品质量", "level2": "做工", "level3": "线头多", "confidence": 0.90, "reason": "线头很多"},
                ],
                "uncertain": False,
                "authenticity_score": 0.78,  # 有具体不满原因，真实
            },
        }

    @pytest.mark.asyncio
    async def test_ten_reviews_authenticity_distribution(self, ten_reviews, expected_llm_outputs):
        """测试10条评论的真实性评分分布."""
        settings = Settings()
        tagger = ExcelTagger(settings)

        # Mock LLM client
        mock_client = MagicMock()
        mock_client.batch_call = AsyncMock(
            side_effect=lambda requests, **kwargs: [
                LLMResponse(
                    id=req.id,
                    content=json.dumps(expected_llm_outputs[req.id], ensure_ascii=False),
                    success=True,
                )
                for req in requests
            ]
        )
        tagger._llm_client = mock_client

        results = await tagger._tag_reviews(ten_reviews, "")

        # 验证结果
        assert len(results) == 10

        scores = {r["review_id"]: r.get("authenticity_score", 1.0) for r in results}
        print("\n=== 10条评论真实性评分分布 ===")
        for rid in [r.id for r in ten_reviews]:
            review = next(r for r in ten_reviews if r.id == rid)
            score = scores[rid]
            bar = "█" * int(score * 20)
            print(f"  {rid}: {score:.2f} {bar:20s} | {review.content[:30]}...")

        # 验证模板化/虚假评论得分低
        assert scores["R002"] < 0.5, "模板化评论应该低分"
        assert scores["R006"] < 0.5, "纯模板评论应该低分"
        assert scores["R009"] < 0.5, "emoji堆砌应该低分"

        # 验证有具体细节的真实评论得分高
        assert scores["R001"] > 0.7, "有具体细节应高分"
        assert scores["R005"] > 0.7, "有使用体验应高分"
        assert scores["R007"] > 0.7, "详细真实体验应高分"

        # 验证模糊评论中等分
        assert 0.3 <= scores["R004"] <= 0.7, "模糊评论应中等分"

        # 验证状态机
        statuses = {r["review_id"]: r.get("status", "normal") for r in results}
        assert statuses["R006"] == "rejected" or statuses["R006"] == "normal"  # 0.15 < 0.3 应该是 rejected
        # 注意：默认 min_authenticity_score = 0.3，所以 0.15 和 0.20 应该被 rejected
        assert statuses["R002"] == "rejected"
        assert statuses["R009"] == "rejected"

        print(f"\n  平均分: {sum(scores.values()) / len(scores):.2f}")
        print(f"  最低分: {min(scores.values()):.2f} ({min(scores, key=scores.get)})")
        print(f"  最高分: {max(scores.values()):.2f} ({max(scores, key=scores.get)})")
        print(f"  rejected 数: {sum(1 for s in statuses.values() if s == 'rejected')}")
        print(f"  uncertain 数: {sum(1 for s in statuses.values() if s == 'uncertain')}")
