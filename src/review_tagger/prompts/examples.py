"""少样本示例."""

from typing import List, Dict, Any


FEW_SHOT_EXAMPLES: List[Dict[str, Any]] = [
    {
        "content": "衣服质量很好，面料舒服，但是物流太慢了，等了五天才到。",
        "output": {
            "matches": [
                {"level1": "商品质量", "level2": "整体质量", "level3": "质量好", "confidence": 0.92, "reason": "明确说质量好"},
                {"level1": "商品质量", "level2": "面料材质", "level3": "舒适", "confidence": 0.88, "reason": "面料舒服"},
                {"level1": "物流服务", "level2": "配送速度", "level3": "速度慢", "confidence": 0.90, "reason": "物流太慢"},
            ],
            "uncertain": False,
            "authenticity_score": 0.85,
        },
    },
    {
        "content": "商品质量非常好，物流也很快，客服态度很好，已经回购很多次了，强烈推荐给大家！",
        "output": {
            "matches": [
                {"level1": "商品质量", "level2": "整体质量", "level3": "质量好", "confidence": 0.85, "reason": "模板化好评"},
                {"level1": "物流服务", "level2": "配送速度", "level3": "速度快", "confidence": 0.80, "reason": "物流很快"},
            ],
            "uncertain": False,
            "authenticity_score": 0.25,
        },
    },
    {
        "content": "还行吧",
        "output": {
            "matches": [
                {"level1": "_uncertain", "level2": "", "level3": "", "confidence": 0.0, "reason": "评论过于模糊/信息不足"},
            ],
            "uncertain": True,
            "authenticity_score": 0.55,
        },
    },
    {
        "content": "性价比很高，会回购的！",
        "output": {
            "matches": [
                {"level1": "价格感知", "level2": "性价比", "level3": "性价比高", "confidence": 0.95, "reason": "直接说性价比高"},
                {"level1": "用户行为", "level2": "复购意向", "level3": "会回购", "confidence": 0.93, "reason": "明确说会回购"},
            ],
            "uncertain": False,
            "authenticity_score": 0.80,
        },
    },
    {
        "content": "一般般吧，没有想象中好。",
        "output": {
            "matches": [
                {"level1": "整体评价", "level2": "满意度", "level3": "一般", "confidence": 0.85, "reason": "一般般"},
            ],
            "uncertain": False,
            "authenticity_score": 0.75,
        },
    },
]
