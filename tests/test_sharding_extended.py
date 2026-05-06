"""分片引擎扩展测试."""

import pytest
from review_tagger.core.sharding import ShardingEngine, ShardWorker, ShardResult
from review_tagger.models import Review
from review_tagger.config import Settings


class TestShardingEngineExtended:
    def test_split_empty(self):
        engine = ShardingEngine(Settings(), shard_size=10, max_shards=5)
        shards = engine.split([])
        assert shards == [[]]

    def test_split_exact_size(self):
        engine = ShardingEngine(Settings(), shard_size=5, max_shards=5)
        reviews = [Review(id=f"r{i}", content=f"c{i}") for i in range(5)]
        shards = engine.split(reviews)
        assert len(shards) == 1
        assert len(shards[0]) == 5

    def test_split_multiple_shards(self):
        engine = ShardingEngine(Settings(), shard_size=10, max_shards=3)
        reviews = [Review(id=f"r{i}", content=f"c{i}") for i in range(25)]
        shards = engine.split(reviews)
        assert len(shards) == 3
        total = sum(len(s) for s in shards)
        assert total == 25

    def test_merge_results_with_missing(self):
        reviews = [Review(id="r1", content="a"), Review(id="r2", content="b")]
        shard_results = [
            ShardResult(shard_id=0, status="completed", results=[
                {"review_id": "r1", "matches": []}
            ])
        ]
        merged = ShardingEngine.merge_results(reviews, shard_results)
        assert len(merged) == 2
        assert merged[0]["review_id"] == "r1"
        assert merged[1]["review_id"] == "r2"
        assert merged[1]["matches"] == []

    def test_merge_results_empty_shards(self):
        reviews = [Review(id="r1", content="a")]
        merged = ShardingEngine.merge_results(reviews, [])
        assert len(merged) == 1
        assert merged[0]["matches"] == []
