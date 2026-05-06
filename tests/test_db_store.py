"""数据库层测试."""

import pytest
from review_tagger.db.store import Store, _get_default_store
from review_tagger.models import Review


@pytest.fixture
def store(tmp_path):
    db_path = tmp_path / "test.db"
    s = Store(str(db_path))
    s.init_db()
    return s


class TestStore:
    def test_init_db(self, store):
        """数据库初始化应创建所有表."""
        with store._conn() as conn:
            tables = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
            table_names = {t["name"] for t in tables}
            assert "tasks" in table_names
            assert "reviews" in table_names
            assert "tag_records" in table_names
            assert "tag_systems" in table_names

    def test_create_and_get_task(self, store):
        store.create_task("t1", status="running")
        task = store.get_task("t1")
        assert task is not None
        assert task["status"] == "running"

    def test_update_task(self, store):
        store.create_task("t2")
        store.update_task("t2", status="completed", error="ok")
        task = store.get_task("t2")
        assert task["status"] == "completed"
        assert task["error"] == "ok"

    def test_get_task_nonexistent(self, store):
        assert store.get_task("noexist") is None

    def test_save_reviews(self, store):
        store.create_task("t3")
        reviews = [
            Review(id="r1", content="很好"),
            Review(id="r2", content="一般"),
        ]
        id_map = store.save_reviews("t3", reviews)
        assert len(id_map) == 2
        assert id_map["r1"] > 0
        assert id_map["r2"] > 0

    def test_save_and_get_tags(self, store):
        store.create_task("t4")
        reviews = [Review(id="r1", content="test")]
        id_map = store.save_reviews("t4", reviews)
        db_id = id_map["r1"]

        store.save_tags(db_id, [
            {"level1": "质量", "level2": "整体", "level3": "好", "confidence": 0.9}
        ])
        tags = store.get_tags_by_review(db_id)
        assert len(tags) == 1
        assert tags[0]["level1"] == "质量"

    def test_clear_tags(self, store):
        store.create_task("t5")
        reviews = [Review(id="r1", content="test")]
        id_map = store.save_reviews("t5", reviews)
        db_id = id_map["r1"]
        store.save_tags(db_id, [{"level1": "A", "level2": "B", "level3": "C"}])
        store.clear_tags(db_id)
        assert store.get_tags_by_review(db_id) == []

    def test_tag_system_crud(self, store):
        sid = store.create_tag_system(name="test", csv_content="a,b,c\n1,2,3")
        assert sid.startswith("ts_")

        ts = store.get_tag_system(sid)
        assert ts["name"] == "test"

        store.update_tag_system(sid, name="updated")
        ts = store.get_tag_system(sid)
        assert ts["name"] == "updated"

        systems = store.list_tag_systems()
        assert len(systems) == 1

        store.delete_tag_system(sid)
        assert store.get_tag_system(sid) is None

    def test_preset_blocked(self, store):
        sid = store.create_tag_system(name="preset", csv_content="a,b,c", is_preset=1)
        with pytest.raises(ValueError, match="Cannot delete preset"):
            store.delete_tag_system(sid)

    def test_copy_tag_system(self, store):
        sid = store.create_tag_system(name="orig", csv_content="a,b,c")
        new_sid = store.copy_tag_system(sid)
        ts = store.get_tag_system(new_sid)
        assert "副本" in ts["name"]

    def test_task_stats(self, store):
        store.create_task("t6", status="running")
        reviews = [Review(id="r1", content="test")]
        id_map = store.save_reviews("t6", reviews)
        store.update_review_status(id_map["r1"], "tagged", uncertain=0, authenticity_score=0.9)
        store.save_tags(id_map["r1"], [{"level1": "质量", "level2": "整体", "level3": "好"}])

        stats = store.get_task_stats("t6")
        assert stats["total_reviews"] == 1
        assert stats["tagged_reviews"] == 1

    def test_find_existing_review(self, store):
        store.create_task("t7")
        reviews = [Review(id="r1", content="hello world")]
        store.save_reviews("t7", reviews)
        import hashlib
        h = hashlib.md5("hello world".encode()).hexdigest()
        found = store.find_existing_review("t7", h)
        assert found is not None
        assert found["content"] == "hello world"
