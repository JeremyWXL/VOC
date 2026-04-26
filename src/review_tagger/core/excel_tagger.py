"""Excel 评论打标核心流程."""

import json
import re
from typing import List, Dict, Any, Optional, Callable

from loguru import logger

from review_tagger.config import Settings
from review_tagger.models import Review
from review_tagger.llm.client import LLMClient, LLMRequest
from review_tagger.llm.providers import OpenAIProvider, DeepSeekProvider, DashScopeProvider
from review_tagger.prompts.templates import build_tagging_prompt
from review_tagger.prompts.examples import FEW_SHOT_EXAMPLES
from review_tagger.loaders import (
    load_reviews_from_excel,
    load_tag_hierarchy,
    format_tag_tree,
    save_tagged_excel,
)
from review_tagger.core.sharding import ShardingEngine, ShardProgress


class ExcelTagger:
    """基于 LLM 的 Excel 评论打标器."""

    def __init__(
        self,
        settings: Optional[Settings] = None,
        progress_callback: Optional[Callable[[int, int], None]] = None,
    ):
        self.settings = settings or Settings()
        self._llm_client: Optional[LLMClient] = None
        self.few_shot = FEW_SHOT_EXAMPLES[:2]  # 默认用前2个示例控制 token
        self._external_progress_cb = progress_callback

    def _get_llm_client(self) -> LLMClient:
        if self._llm_client is None:
            self._llm_client = self._create_llm_client()
        return self._llm_client

    def _create_llm_client(self) -> LLMClient:
        cfg = self.settings.llm
        if cfg.provider == "deepseek":
            provider = DeepSeekProvider(
                api_key=cfg.api_key or "", timeout=cfg.timeout, max_retries=cfg.max_retries
            )
        elif cfg.provider == "dashscope":
            provider = DashScopeProvider(
                api_key=cfg.api_key or "", timeout=cfg.timeout, max_retries=cfg.max_retries
            )
        else:
            provider = OpenAIProvider(
                api_key=cfg.api_key or "",
                base_url=cfg.base_url,
                timeout=cfg.timeout,
                max_retries=cfg.max_retries,
            )
        return LLMClient(
            provider=provider,
            concurrency=cfg.concurrency,
            batch_size=cfg.batch_size,
            max_retries=cfg.max_retries,
        )

    async def _tag_reviews(
        self,
        reviews: List[Review],
        tag_tree_text: str,
        progress_callback: Optional[Callable[[int, int], None]] = None,
        sharding_enabled: bool = False,
        shard_size: int = 200,
        max_shards: int = 10,
        shard_progress_callback: Optional[Callable[[int, int, List[ShardProgress]], None]] = None,
    ) -> List[Dict[str, Any]]:
        """对评论列表执行 LLM 打标，返回结构化结果.

        Args:
            sharding_enabled: 是否启用分片并行（大数据量时提升效率）
            shard_size: 每个分片的最大评论数
            max_shards: 最大并行子任务数
            shard_progress_callback: 分片进度回调 (done, total, shard_progress_list)
        """
        if not sharding_enabled or len(reviews) <= shard_size:
            # 不分片：使用原有 batch_call 模式
            requests = self._build_requests(reviews, tag_tree_text)
            logger.info(f"开始调用 LLM，共 {len(requests)} 条，并发 {self.settings.llm.concurrency}")
            cb = progress_callback or self._external_progress_cb or self._progress_cb
            responses = await self._get_llm_client().batch_call(requests, progress_callback=cb)
            return self._parse_responses(reviews, responses)

        # 分片并行模式
        from review_tagger.core.sharding import ShardingEngine

        logger.info(f"启用分片并行: {len(reviews)} 条评论, 分片大小={shard_size}, 最大分片数={max_shards}")
        engine = ShardingEngine(
            settings=self.settings,
            shard_size=shard_size,
            max_shards=max_shards,
            progress_callback=shard_progress_callback,
        )
        shard_results = await engine.run(
            reviews=reviews,
            tag_tree_text=tag_tree_text,
            parse_fn=self._parse_responses,
        )
        # 合并结果并保持原始顺序
        return ShardingEngine.merge_results(reviews, shard_results)

    async def tag_excel(
        self,
        review_path: str,
        tag_hierarchy_path: str,
        output_path: str,
        content_column: str = "评论内容",
        id_column: Optional[str] = None,
        sheet_name: Optional[str] = None,
        output_format: str = "wide",
        progress_callback: Optional[Callable[[int, int], None]] = None,
        sharding_enabled: bool = False,
        shard_size: int = 200,
        max_shards: int = 10,
        shard_progress_callback: Optional[Callable[[int, int, List[ShardProgress]], None]] = None,
    ) -> str:
        """主流程：读取两个 Excel → LLM 打标 → 输出 Excel."""
        # 1. 加载数据
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

        logger.info(f"标签体系文本长度: {len(tag_tree_text)} 字符")

        # 2. 打标
        results = await self._tag_reviews(
            reviews,
            tag_tree_text,
            progress_callback=progress_callback,
            sharding_enabled=sharding_enabled,
            shard_size=shard_size,
            max_shards=max_shards,
            shard_progress_callback=shard_progress_callback,
        )

        # 3. 保存
        save_tagged_excel(
            df,
            results,
            output_path,
            review_id_column=id_column,
            output_format=output_format,
        )
        return output_path

    def _build_requests(self, reviews: List[Review], tag_tree_text: str) -> List[LLMRequest]:
        """为每条评论构建 LLMRequest."""
        requests = []
        for r in reviews:
            messages = build_tagging_prompt(
                review_content=r.content,
                tag_tree_text=tag_tree_text,
                few_shot=self.few_shot,
                product_name=r.product_name,
                rating=r.rating,
            )
            requests.append(
                LLMRequest(
                    id=r.id or "",
                    messages=messages,
                    model=self.settings.llm.model,
                    temperature=self.settings.llm.temperature,
                    max_tokens=self.settings.llm.max_tokens,
                    response_format=(
                        {"type": "json_object"} if self.settings.llm.use_json_mode else None
                    ),
                )
            )
        return requests

    def _parse_responses(self, reviews: List[Review], responses: List[Any]) -> List[Dict[str, Any]]:
        """解析 LLM 响应为结构化结果."""
        results = []
        review_map = {r.id: r for r in reviews}

        for resp in responses:
            rid = resp.id
            review = review_map.get(rid)
            if not review:
                continue

            parsed: Dict[str, Any] = {
                "review_id": rid,
                "matches": [],
                "raw": "",
                "uncertain": False,
                "authenticity_score": 1.0,
                "status": "normal",
            }

            if not resp.success:
                logger.warning(f"[{rid}] LLM 调用失败: {resp.error}")
                parsed["error"] = resp.error
                results.append(parsed)
                continue

            parsed["raw"] = resp.content
            full_result = self._extract_full_result(resp.content)
            matches = full_result.get("matches", [])
            uncertain = full_result.get("uncertain", False)
            authenticity_score = full_result.get("authenticity_score", 1.0)

            parsed["matches"] = matches
            parsed["uncertain"] = uncertain
            parsed["authenticity_score"] = authenticity_score

            if authenticity_score < 0.5:
                logger.warning(f"[{rid}] 评论真实性评分较低: {authenticity_score}")

            min_score = self.settings.tagger.min_authenticity_score
            if authenticity_score < min_score:
                parsed["status"] = "rejected"
            elif uncertain:
                parsed["status"] = "uncertain"
            else:
                parsed["status"] = "normal"

            results.append(parsed)

        return results

    def _extract_full_result(self, text: str) -> Dict[str, Any]:
        """从 LLM 输出中提取完整结果（含 matches、uncertain、authenticity_score）."""
        text = text.strip()
        # 去除 markdown 代码块
        if text.startswith("```"):
            text = re.sub(r"```(?:json)?\s*", "", text)
            text = text.rstrip("`").strip()

        result: Dict[str, Any] = {"matches": [], "uncertain": False, "authenticity_score": 1.0}
        try:
            data = json.loads(text)
            matches = data.get("matches", [])
            result["uncertain"] = data.get("uncertain", False)
            result["authenticity_score"] = data.get("authenticity_score", 1.0)
            # 过滤 confidence，但保留 _uncertain 特殊项
            threshold = self.settings.tagger.confidence_threshold
            result["matches"] = [
                m
                for m in matches
                if m.get("confidence", 1.0) >= threshold or m.get("level1") == "_uncertain"
            ]
            return result
        except json.JSONDecodeError:
            logger.debug(f"JSON 解析失败，尝试正则提取: {text[:200]}")
            try:
                match = re.search(r'"matches"\s*:\s*(\[.*?\])', text, re.DOTALL)
                if match:
                    arr = json.loads(match.group(1))
                    threshold = self.settings.tagger.confidence_threshold
                    result["matches"] = [
                        m
                        for m in arr
                        if m.get("confidence", 1.0) >= threshold or m.get("level1") == "_uncertain"
                    ]
                    # 尝试提取 uncertain 和 authenticity_score
                    uc_match = re.search(r'"uncertain"\s*:\s*(true|false)', text, re.IGNORECASE)
                    if uc_match:
                        result["uncertain"] = uc_match.group(1).lower() == "true"
                    auth_match = re.search(r'"authenticity_score"\s*:\s*([0-9.]+)', text)
                    if auth_match:
                        result["authenticity_score"] = float(auth_match.group(1))
                    return result
            except Exception:
                pass
        return result

    def _extract_json_matches(self, text: str) -> List[Dict[str, Any]]:
        """从 LLM 输出中提取 JSON 匹配结果（容错解析，兼容层）."""
        return self._extract_full_result(text).get("matches", [])

    def _progress_cb(self, done: int, total: int) -> None:
        logger.info(f"进度: {done}/{total} ({done * 100 // total}%)")

    def preview_prompt(self, review_content: str, tag_hierarchy_path: str) -> str:
        """预览某条评论的 Prompt（调试用）."""
        tag_tree = load_tag_hierarchy(tag_hierarchy_path)
        tag_tree_text = format_tag_tree(tag_tree)
        messages = build_tagging_prompt(
            review_content=review_content,
            tag_tree_text=tag_tree_text,
            few_shot=self.few_shot,
        )
        return json.dumps(messages, ensure_ascii=False, indent=2)
