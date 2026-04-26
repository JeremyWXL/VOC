"""Tag system CRUD tests."""

import pytest
import tempfile
import os
from review_tagger.db.store import Store


@pytest.fixture
def store():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    s = Store(db_path=path)
    s.init_db()
    yield s
    os.unlink(path)


def test_create_and_get_tag_system(store):
    sid = store.create_tag_system(
        name="测试标签",
        csv_content="一级标签,二级标签\n质量,好\n",
        scene_type="ECOMMERCE_CLOTHING",
        description="desc",
    )
    assert sid.startswith("ts_")
    ts = store.get_tag_system(sid)
    assert ts["name"] == "测试标签"
    assert ts["csv_content"] == "一级标签,二级标签\n质量,好\n"
    assert ts["scene_type"] == "ECOMMERCE_CLOTHING"
    assert ts["description"] == "desc"
    assert ts["is_preset"] == 0
    assert ts["created_at"] is not None


def test_list_tag_systems(store):
    store.create_tag_system(name="A", csv_content="a,b\n")
    store.create_tag_system(name="B", csv_content="c,d\n", scene_type="HOTEL")
    items = store.list_tag_systems()
    assert len(items) == 2
    assert items[0]["name"] == "B"  # DESC order by updated_at


def test_list_tag_systems_with_filter(store):
    store.create_tag_system(name="Preset1", csv_content="a,b\n", is_preset=1)
    store.create_tag_system(name="User1", csv_content="c,d\n", is_preset=0)
    presets = store.list_tag_systems(preset_only=True)
    assert len(presets) == 1
    assert presets[0]["name"] == "Preset1"

    hotel = store.create_tag_system(name="Hotel", csv_content="e,f\n", scene_type="HOTEL")
    hotel_items = store.list_tag_systems(scene_type="HOTEL")
    assert len(hotel_items) == 1


def test_update_tag_system(store):
    sid = store.create_tag_system(name="Old", csv_content="a,b\n")
    store.update_tag_system(sid, name="New", description="updated")
    ts = store.get_tag_system(sid)
    assert ts["name"] == "New"
    assert ts["description"] == "updated"


def test_delete_tag_system(store):
    sid = store.create_tag_system(name="Del", csv_content="a,b\n")
    assert store.get_tag_system(sid) is not None
    store.delete_tag_system(sid)
    assert store.get_tag_system(sid) is None


def test_delete_preset_blocked(store):
    sid = store.create_tag_system(name="Preset", csv_content="a,b\n", is_preset=1)
    with pytest.raises(ValueError, match="preset"):
        store.delete_tag_system(sid)


def test_copy_tag_system(store):
    sid = store.create_tag_system(name="Original", csv_content="a,b\n1,2\n", scene_type="FOOD")
    new_sid = store.copy_tag_system(sid)
    assert new_sid != sid
    ts = store.get_tag_system(new_sid)
    assert ts["name"] == "Original (副本)"
    assert ts["csv_content"] == "a,b\n1,2\n"
    assert ts["scene_type"] == "FOOD"
    assert ts["is_preset"] == 0


def test_get_nonexistent(store):
    assert store.get_tag_system("ts_doesnotexist") is None
