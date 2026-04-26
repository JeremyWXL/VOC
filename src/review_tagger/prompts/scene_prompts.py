"""场景识别与标签生成 Prompt."""

import json
from typing import List, Dict, Any


SCENE_CATALOG = """
可用场景列表：
- ecommerce_clothing: 服装电商（衣服、鞋子、包包等时尚类）
- ecommerce_electronics: 数码电商（手机、电脑、家电等）
- ecommerce_food: 食品电商（零食、生鲜、饮料等）
- ecommerce_beauty: 美妆电商（化妆品、护肤品、香水等）
- ecommerce_home: 家居电商（家具、家纺、厨具等）
- ecommerce_baby: 母婴电商（奶粉、尿布、童装等）
- food_catering: 餐饮到店（餐厅、快餐、咖啡店等）
- hotel: 酒店住宿
- travel: 旅游出行（景点、旅行社、机票酒店等）
- education: 教育培训（课程、培训机构、在线教育等）
- healthcare: 医疗健康（医院、体检、药品等）
- entertainment: 娱乐休闲（电影、KTV、健身房、游乐园等）
- general: 通用/其他（无法归入以上场景）
""".strip()


def build_scene_detection_prompt(sample_reviews: List[str]) -> List[Dict[str, str]]:
    """构建场景识别 Prompt."""
    reviews_text = "\n---\n".join([f"{i+1}. {r}" for i, r in enumerate(sample_reviews)])

    system = f"""你是一名业务场景分析专家。请根据提供的用户评论样本，识别出这些评论所属的业务场景。

{SCENE_CATALOG}

## 分析要求
1. 仔细阅读评论样本，提取关键词和主题
2. 从上述场景列表中选择最匹配的一个
3. 给出置信度（0.0~1.0）和简要说明
4. 如果无法确定，选择 "general"

## 输出格式
必须严格输出 JSON，不要任何 markdown 代码块：
{{
  "scene_type": "ecommerce_clothing",
  "confidence": 0.95,
  "description": "评论主要涉及服装尺码、面料、物流等，属于服装电商场景",
  "keywords": ["尺码", "面料", "物流"]
}}
"""

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": f"请分析以下评论样本所属场景：\n\n{reviews_text}"},
    ]


def build_tag_generation_prompt(
    scene_type: str,
    scene_description: str,
    sample_reviews: List[str],
) -> List[Dict[str, str]]:
    """构建标签体系生成 Prompt."""
    reviews_text = "\n---\n".join([f"{i+1}. {r}" for i, r in enumerate(sample_reviews)])

    system = f"""你是一名评论标签体系设计专家。请为「{scene_type}」场景设计一套完整的三级标签体系，用于对评论进行结构化分析。

## 场景描述
{scene_description}

## 设计要求
1. 设计 5~10 个一级标签，覆盖该场景的核心分析维度
2. 每个一级标签下设计 2~5 个二级标签
3. 每个二级标签下设计 2~6 个三级标签（具体 sentiment/attribute）
4. 标签名称简洁（2~6 字），语义明确
5. 必须包含正负双向标签（如"质量好"和"质量差"）
6. 必须包含一个"整体评价"一级标签，下设"满意度"等二级标签
7. 如果场景涉及服务交互，必须包含"服务态度"相关标签

## 输出格式
必须严格输出 JSON 数组，不要任何 markdown 代码块。每条记录表示一个标签路径：
[
  {{"level1": "商品质量", "level2": "整体质量", "level3": "质量好"}},
  {{"level1": "商品质量", "level2": "整体质量", "level3": "质量差"}},
  {{"level1": "物流服务", "level2": "配送速度", "level3": "速度快"}},
  ...
]

只输出 JSON 数组，不要其他内容。
"""

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": f"请根据以下评论样本，生成贴合实际的标签体系：\n\n{reviews_text}"},
    ]


# Few-shot 示例（用于标签生成微调）
TAG_GENERATION_EXAMPLES = [
    {
        "scene": "ecommerce_clothing",
        "sample": "衣服面料很舒服，版型修身，洗了两次没掉色。",
        "output": [
            {"level1": "商品质量", "level2": "面料材质", "level3": "舒适"},
            {"level1": "商品质量", "level2": "版型尺寸", "level3": "合身"},
            {"level1": "商品质量", "level2": "面料材质", "level3": "不掉色"},
        ],
    },
    {
        "scene": "food_catering",
        "sample": "味道不错，但是上菜太慢了，等了一个小时。",
        "output": [
            {"level1": "口味口感", "level2": "整体味道", "level3": "好吃"},
            {"level1": "上菜速度", "level2": "等待时间", "level3": "慢"},
        ],
    },
]
