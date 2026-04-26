"""分片并行打标引擎 — 将大量评论数据分片，多子任务并行处理."""

import asyncio
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from loguru import logger

from review_tagger.config import Settings
from review_tagger.models import Review
from review_tagger.llm.client import LLMClient, LLMRequest
from review_tagger.llm.provider import LLMProvider
from review_tagger.llm.providers import OpenAIProvider, DeepSeekProvider, DashScopeProvider


@dataclass
class ShardResult:
    """单个子任务（分片）的执行结果."""
    shard_id: int
    status: str  # "pending" | "running" | "completed" | "failed"
    reviews: List[Review] = field(default_factory=list)
    results: List[Dict[str, Any]] = field(default_factory=list)
    error: Optional[str] = None
    progress_done: int = 0
    progress_total: int = 0


@dataclass
class ShardProgress:
    """子任务进度事件."""
    shard_id: int
    done: int
    total: int
    status: str


class ShardWorker:
    """单个分片工作器 — 处理一批评论的 LLM 打标."""

    def __init__(
        self,
        shard_id: int,
        llm_client: LLMClient,
        tag_tree_text: str,
        few_shot: Optional[List[Dict[str, Any]]] = None,
        progress_callback: Optional[Callable[[ShardProgress], None]] = None,
    ):
        self.shard_id = shard_id
        self.llm_client = llm_client
        self.tag_tree_text = tag_tree_text
        self.few_shot = few_shot or []
        self._progress_cb = progress_callback

    async def run(
        self,
        reviews: List[Review],
        parse_fn: Callable[[List[Review], List[Any]], List[Dict[str, Any]]],
    ) -> ShardResult:
        """执行分片打标."""
        result = ShardResult(
            shard_id=self.shard_id,
            status="running",
            reviews=reviews,
            progress_total=len(reviews),
        )

        try:
            requests = self._build_requests(reviews)

            def _progress(done: int, total: int) -> None:
                result.progress_done = done
                result.progress_total = total
                if self._progress_cb:
                    self._progress_cb(
                        ShardProgress(
                            shard_id=self.shard_id,
                            done=done,
                            total=total,
                            status="running",
                        )
                    )

            responses = await self.llm_client.batch_call(requests, progress_callback=_progress)
            result.results = parse_fn(reviews, responses)
            result.status = "completed"
            result.progress_done = len(reviews)

            if self._progress_cb:
                self._progress_cb(
                    ShardProgress(
                        shard_id=self.shard_id,
                        done=result.progress_done,
                        total=result.progress_total,
                        status="completed",
                    )
                )

        except Exception as e:
            logger.error(f"Shard {self.shard_id} failed: {e}")
            result.status = "failed"
            result.error = str(e)
            if self._progress_cb:
                self._progress_cb(
                    ShardProgress(
                        shard_id=self.shard_id,
                        done=0,
                        total=len(reviews),
                        status="failed",
                    )
                )

        return result

    def _build_requests(self, reviews: List[Review]) -> List[LLMRequest]:
        """为分片内的评论构建 LLMRequest."""
        from review_tagger.prompts.templates import build_tagging_prompt

        requests = []
        for r in reviews:
            messages = build_tagging_prompt(
                review_content=r.content,
                tag_tree_text=self.tag_tree_text,
                few_shot=self.few_shot,
                product_name=r.product_name,
                rating=r.rating,
            )
            requests.append(
                LLMRequest(
                    id=r.id or "",
                    messages=messages,
                    metadata={"shard_id": self.shard_id},
                )
            )
        return requests


class ShardingEngine:
    """分片并行调度引擎."""

    def __init__(
        self,
        settings: Settings,
        shard_size: int = 200,
        max_shards: int = 10,
        progress_callback: Optional[Callable[[int, int, List[ShardProgress]], None]] = None,
    ):
        self.settings = settings
        self.shard_size = shard_size
        self.max_shards = max_shards
        self._progress_cb = progress_callback
        self._shard_progress: Dict[int, ShardProgress] = {}

    def split(self, reviews: List[Review]) -> List[List[Review]]:
        """将评论列表分片."""
        if len(reviews) <= self.shard_size:
            return [reviews]

        # 计算分片数：不超过 max_shards，每片不超过 shard_size
        num_shards = min(self.max_shards, (len(reviews) + self.shard_size - 1) // self.shard_size)
        shard_size = (len(reviews) + num_shards - 1) // num_shards

        shards: List[List[Review]] = []
        for i in range(0, len(reviews), shard_size):
            shards.append(reviews[i : i + shard_size])

        logger.info(f"评论分片: {len(reviews)} 条 → {len(shards)} 个子任务, 每片约 {shard_size} 条")
        return shards

    def create_llm_client(self) -> LLMClient:
        """创建 LLMClient 实例（每个 worker 共享同一个 provider，但各自独立 client 以隔离限流）."""
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
            concurrency=self.settings.llm.concurrency,
            batch_size=self.settings.llm.batch_size,
            max_retries=self.settings.llm.max_retries,
        )

    async def run(
        self,
        reviews: List[Review],
        tag_tree_text: str,
        parse_fn: Callable[[List[Review], List[Any]], List[Dict[str, Any]]],
    ) -> List[ShardResult]:
        """执行分片并行打标.

        1. 将 reviews 分片
        2. 为每片创建 ShardWorker
        3. 所有分片并行执行
        4. 合并结果
        """
        shards = self.split(reviews)
        if len(shards) == 1:
            # 只有一片时退化到单 worker 模式
            worker = ShardWorker(
                shard_id=0,
                llm_client=self.create_llm_client(),
                tag_tree_text=tag_tree_text,
                progress_callback=self._on_shard_progress,
            )
            return [await worker.run(shards[0], parse_fn)]

        # 多片并行：为每片创建独立的 LLMClient（隔离限流）
        workers: List[ShardWorker] = []
        for idx, shard_reviews in enumerate(shards):
            worker = ShardWorker(
                shard_id=idx,
                llm_client=self.create_llm_client(),
                tag_tree_text=tag_tree_text,
                progress_callback=self._on_shard_progress,
            )
            workers.append(worker)

        # 启动所有 worker（并行）
        tasks = [
            worker.run(shard, parse_fn)
            for worker, shard in zip(workers, shards)
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        shard_results: List[ShardResult] = []
        for i, res in enumerate(results):
            if isinstance(res, Exception):
                logger.error(f"Shard {i} 抛出异常: {res}")
                shard_results.append(
                    ShardResult(
                        shard_id=i,
                        status="failed",
                        reviews=shards[i],
                        error=str(res),
                        progress_total=len(shards[i]),
                    )
                )
            else:
                shard_results.append(res)

        return shard_results

    def _on_shard_progress(self, progress: ShardProgress) -> None:
        self._shard_progress[progress.shard_id] = progress
        if self._progress_cb:
            total_done = sum(p.done for p in self._shard_progress.values())
            total = sum(p.total for p in self._shard_progress.values())
            self._progress_cb(total_done, total, list(self._shard_progress.values()))

    @staticmethod
    def merge_results(
        reviews: List[Review],
        shard_results: List[ShardResult],
    ) -> List[Dict[str, Any]]:
        """将多个分片的结果按原始评论顺序合并."""
        result_map: Dict[str, Dict[str, Any]] = {}
        for sr in shard_results:
            for r in sr.results:
                rid = str(r.get("review_id", ""))
                if rid:
                    result_map[rid] = r

        # 保持原始顺序
        merged = []
        for r in reviews:
            merged.append(
                result_map.get(
                    r.id or "",
                    {
                        "review_id": r.id,
                        "matches": [],
                        "raw": "",
                        "uncertain": False,
                        "authenticity_score": 1.0,
                        "status": "normal",
                    },
                )
            )
        return merged
