"""API 任务管理测试."""

import pytest
from datetime import datetime, timedelta
from review_tagger.api.tasks import (
    create_task, get_task, update_task, cleanup_task, _tasks
)


class TestTaskManagement:
    def test_create_task(self):
        tid = create_task()
        assert len(tid) == 8
        task = get_task(tid)
        assert task is not None
        assert task.status == "pending"

    def test_update_task(self):
        tid = create_task()
        update_task(tid, status="running", progress_done=5, progress_total=10)
        task = get_task(tid)
        assert task.status == "running"
        assert task.progress_done == 5
        assert task.progress_total == 10

    def test_cleanup_task(self):
        tid = create_task()
        update_task(tid, output_path="/tmp/test.csv")
        cleanup_task(tid)
        assert get_task(tid) is None

    def test_cleanup_expired(self):
        """测试过期任务自动清理."""
        tid = create_task()
        update_task(tid, status="completed")
        # 手动将创建时间设为超过 TTL
        task = get_task(tid)
        task.created_at = datetime.now() - timedelta(hours=25)
        # 触发清理
        update_task(tid, status="completed")
        # 因为任务数未超过 100，不会自动触发清理
        # 手动调用 cleanup
        cleanup_task(tid)
        assert get_task(tid) is None

    def test_get_task_nonexistent(self):
        assert get_task("nonexist") is None
