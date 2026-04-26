"""测试分片并行打标引擎."""

import pytest
from review_tagger.core.sharding import ShardingEngine, ShardResult, ShardProgress
from review_tagger.models import Review


class TestShardingEngine:
    def test_split_small_data(self):
        """数据量小于 shard_size，不分片."""
        engine = ShardingEngine(settings=None, shard_size=10, max_shards=5)
        reviews = [Review(id=str(i), content=f"review {i}") for i in range(5)]
        shards = engine.split(reviews)
        assert len(shards) == 1
        assert len(shards[0]) == 5

    def test_split_large_data(self):
        """大数据量自动分片."""
        engine = ShardingEngine(settings=None, shard_size=10, max_shards=5)
        reviews = [Review(id=str(i), content=f"review {i}") for i in range(100)]
        shards = engine.split(reviews)
        assert len(shards) <= 5
        # 分片数不超过 max_shards
        # 当数据量太大时，每片会超过 shard_size 以控制分片数
        assert sum(len(s) for s in shards) == 100

    def test_split_respects_max_shards(self):
        """分片数不超过 max_shards."""
        engine = ShardingEngine(settings=None, shard_size=5, max_shards=3)
        reviews = [Review(id=str(i), content=f"review {i}") for i in range(100)]
        shards = engine.split(reviews)
        assert len(shards) <= 3
        assert sum(len(s) for s in shards) == 100

    def test_merge_results(self):
        """合并多个分片结果并保持顺序."""
        reviews = [
            Review(id="R001", content="a"),
            Review(id="R002", content="b"),
            Review(id="R003", content="c"),
        ]
        shard_results = [
            ShardResult(
                shard_id=0,
                status="completed",
                results=[
                    {"review_id": "R001", "matches": [{"level1": "A"}]},
                ],
            ),
            ShardResult(
                shard_id=1,
                status="completed",
                results=[
                    {"review_id": "R002", "matches": [{"level1": "B"}]},
                    {"review_id": "R003", "matches": [{"level1": "C"}]},
                ],
            ),
        ]
        merged = ShardingEngine.merge_results(reviews, shard_results)
        assert len(merged) == 3
        assert merged[0]["review_id"] == "R001"
        assert merged[1]["review_id"] == "R002"
        assert merged[2]["review_id"] == "R003"
        assert merged[0]["matches"][0]["level1"] == "A"

    def test_merge_missing_review(self):
        """某条评论在分片结果中缺失时，应返回空结果占位."""
        reviews = [Review(id="R001", content="a"), Review(id="R002", content="b")]
        shard_results = [
            ShardResult(
                shard_id=0,
                status="completed",
                results=[{"review_id": "R001", "matches": []}],
            ),
        ]
        merged = ShardingEngine.merge_results(reviews, shard_results)
        assert len(merged) == 2
        assert merged[0]["review_id"] == "R001"
        assert merged[1]["review_id"] == "R002"
        assert merged[1]["matches"] == []


class TestShardProgress:
    def test_shard_progress_dataclass(self):
        p = ShardProgress(shard_id=0, done=50, total=100, status="running")
        assert p.shard_id == 0
        assert p.done == 50
        assert p.total == 100
