"""Prompt 模板 - 动态注入标签体系."""

import json
from typing import Dict, Any, List, Optional


def build_system_prompt(tag_tree_text: str, custom_instructions: Optional[str] = None) -> str:
    """构建 System Prompt."""
    base = f"""你是一名电商评论分析专家。请根据下方严格定义的三级标签体系，对用户评论进行精准打标。

## 标签体系
{tag_tree_text}

## 任务要求
1. 仔细阅读评论内容，判断其提及了哪些方面的体验
2.  ONLY 从上述标签体系中选择最匹配的标签，禁止创造体系外标签
3. 一条评论可能匹配多个标签（多选），也可能没有匹配（输出空列表）
4. 对每条匹配给出 confidence（0.0-1.0），只保留 confidence >= 0.7 的结果
5. 在 reason 中简要说明匹配依据（10字以内）

## 额外判断要求

1. **模糊评论识别**：如果评论内容过于简短、语义含糊、无法明确对应到任何标签，请在输出中设置 `"uncertain": true`，并在 `matches` 中返回一个特殊项 `{{"level1":"_uncertain","level2":"","level3":"","confidence":0.0,"reason":"评论过于模糊/信息不足"}}`

2. **真实性评分**（⚠️ 必须输出）：请同时评估这条评论看起来是否真实（真实用户评价 vs 刷单/模板/水军）。输出字段 `"authenticity_score"`：0.0~1.0。
   - 1.0 = 非常真实（具体细节、个性化表达、有真实使用场景）
   - 0.5 = 一般（中规中矩，难以判断真假）
   - 0.0 = 明显虚假（模板化堆砌、与商品无关、大量无意义 emoji、纯复制粘贴）
   不要默认给 1.0，请根据评论具体内容认真评估。

## 输出格式
必须严格输出 JSON，不要任何 markdown 代码块标记，格式如下：
{{
  "matches": [
    {{"level1": "一级标签A", "level2": "二级标签X", "level3": "三级标签1", "confidence": 0.95, "reason": "用户明确称赞做工"}}
  ],
  "uncertain": false,
  "authenticity_score": 0.85
}}
"""
    if custom_instructions:
        base += f"\n## 额外指令\n{custom_instructions}\n"
    return base


def build_tagging_prompt(
    review_content: str,
    tag_tree_text: str,
    few_shot: Optional[List[Dict[str, Any]]] = None,
    product_name: Optional[str] = None,
    rating: Optional[int] = None,
) -> List[Dict[str, str]]:
    """构建完整的对话消息列表."""
    messages = [{"role": "system", "content": build_system_prompt(tag_tree_text)}]

    # 少样本示例
    if few_shot:
        for ex in few_shot:
            messages.append({"role": "user", "content": f"评论：{ex['content']}"})
            messages.append({"role": "assistant", "content": json.dumps(ex["output"], ensure_ascii=False)})

    # 当前评论
    header = "评论："
    if product_name:
        header += f"【商品：{product_name}】"
    if rating:
        header += f"【评分：{rating}星】"
    header += f"\n{review_content}"
    messages.append({"role": "user", "content": header})

    return messages
