"""多标签体系打标器 — 根据评论元数据动态选择标签体系."""

from typing import Any, Dict, List, Optional, Callable

from loguru import logger

from review_tagger.config import Settings
from review_tagger.models import Review
from review_tagger.core.excel_tagger import ExcelTagger
from review_tagger.core.tag_mapping import TagMappingConfig, TagProfile
from review_tagger.llm.client import LLMRequest


class MultiTagger(ExcelTagger):
    """支持多维度标签体系映射的打标器.

    工作流程：
    1. 加载映射配置（多个标签方案 + 映射规则）
    2. 按评论元数据分组，每组对应一个标签方案
    3. 对每组分别调用 LLM（同组共享同一标签体系 Prompt）
    4. 合并结果输出
    """

    def __init__(
        self,
        mapping_config: TagMappingConfig,
        settings: Optional[Settings] = None,
        progress_callback: Optional[Callable[[int, int], None]] = None,
    ):
        super().__init__(settings=settings, progress_callback=progress_callback)
        self.mapping_config = mapping_config
        self.mapping_config.load_all_profiles()

    def _group_reviews_by_profile(
        self, reviews: List[Review]
    ) -> Dict[str, List[Review]]:
        """按标签方案分组评论."""
        groups: Dict[str, List[Review]] = {}
        unmatched: List[Review] = []

        for r in reviews:
            profile = self.mapping_config.resolve(r.metadata)
            if profile is None:
                unmatched.append(r)
                continue
            if profile.id not in groups:
                groups[profile.id] = []
            groups[profile.id].append(r)

        if unmatched:
            # 未匹配的评论使用第一个可用方案兜底
            fallback_id = self.mapping_config.default_profile_id
            if not fallback_id and self.mapping_config.profiles:
                fallback_id = self.mapping_config.profiles[0].id
            if fallback_id:
                if fallback_id not in groups:
                    groups[fallback_id] = []
                groups[fallback_id].extend(unmatched)
                logger.warning(f"{len(unmatched)} 条评论未匹配到规则，使用默认方案 fallback")
            else:
                logger.error(f"{len(unmatched)} 条评论无法匹配标签方案且无默认方案")

        return groups

    async def _tag_reviews(
        self,
        reviews: List[Review],
        tag_tree_text: str,
        progress_callback: Optional[Callable[[int, int], None]] = None,
        sharding_enabled: bool = False,
        shard_size: int = 200,
        max_shards: int = 10,
        shard_progress_callback: Optional[Callable[[int, int, List[Any]], None]] = None,
    ) -> List[Dict[str, Any]]:
        """重写：忽略传入的 tag_tree_text，使用映射配置动态选择.

        支持分片并行：各方案组之间并行，组内也可分片并行。
        """
        from review_tagger.core.sharding import ShardingEngine

        # 按方案分组
        groups = self._group_reviews_by_profile(reviews)

        total = len(reviews)
        done = 0
        cb = progress_callback or self._external_progress_cb or self._progress_cb

        async def _process_one_group(
            profile_id: str,
            group_reviews: List[Review],
        ) -> List[Dict[str, Any]]:
            profile = self.mapping_config.get_profile(profile_id)
            if not profile or not profile.tag_tree_text:
                logger.warning(f"方案 {profile_id} 未加载，跳过 {len(group_reviews)} 条评论")
                return []

            logger.info(f"方案 [{profile.name}] 处理 {len(group_reviews)} 条评论")

            # 在 system prompt 中注入方案名称
            # 通过临时修改 build_tagging_prompt 的行为来实现
            original_tag_tree = profile.tag_tree_text
            if profile.name:
                profile.tag_tree_text = f"【当前标签方案：{profile.name}】\n{original_tag_tree}"

            try:
                if sharding_enabled and len(group_reviews) > shard_size:
                    engine = ShardingEngine(
                        settings=self.settings,
                        shard_size=shard_size,
                        max_shards=max_shards,
                    )
                    shard_results = await engine.run(
                        reviews=group_reviews,
                        tag_tree_text=profile.tag_tree_text,
                        parse_fn=self._parse_responses,
                    )
                    return ShardingEngine.merge_results(group_reviews, shard_results)
                else:
                    requests = self._build_requests(group_reviews, profile.tag_tree_text)
                    responses = await self._get_llm_client().batch_call(requests)
                    return self._parse_responses(group_reviews, responses)
            finally:
                if profile.name:
                    profile.tag_tree_text = original_tag_tree

        # 所有方案组并行处理
        tasks = [
            _process_one_group(pid, grp)
            for pid, grp in groups.items()
        ]
        group_results_list = await asyncio.gather(*tasks, return_exceptions=True)

        all_results: List[Dict[str, Any]] = []
        for res in group_results_list:
            if isinstance(res, Exception):
                logger.error(f"方案组处理失败: {res}")
                continue
            all_results.extend(res)

        # 保持原始顺序
        result_map = {r["review_id"]: r for r in all_results}
        ordered = []
        for r in reviews:
            ordered.append(result_map.get(r.id or "", {
                "review_id": r.id,
                "matches": [],
                "raw": "",
                "uncertain": False,
                "authenticity_score": 1.0,
                "status": "normal",
            }))
        return ordered

    async def tag_excel_multi(
        self,
        review_path: str,
        output_path: str,
        content_column: str = "评论内容",
        id_column: Optional[str] = None,
        sheet_name: Optional[str] = None,
        output_format: str = "wide",
        progress_callback: Optional[Callable[[int, int], None]] = None,
    ) -> str:
        """主流程：读取评论 → 按方案分组打标 → 输出."""
        from review_tagger.loaders import (
            load_reviews_from_excel,
            save_tagged_excel,
        )

        reviews, df = load_reviews_from_excel(
            review_path,
            content_column=content_column,
            id_column=id_column,
            sheet_name=sheet_name,
        )
        if not reviews:
            raise ValueError("没有加载到任何评论")

        # 统计分组情况
        groups = self._group_reviews_by_profile(reviews)
        for pid, grp in groups.items():
            p = self.mapping_config.get_profile(pid)
            logger.info(f"  - {p.name if p else pid}: {len(grp)} 条")

        results = await self._tag_reviews(
            reviews, "", progress_callback=progress_callback
        )

        save_tagged_excel(
            df,
            results,
            output_path,
            review_id_column=id_column,
            output_format=output_format,
        )
        return output_path
