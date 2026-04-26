"""Tag system API tests."""

import pytest
from fastapi.testclient import TestClient

from review_tagger.api.main import app
from review_tagger.db.store import Store

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_db(monkeypatch):
    """Use isolated temp DB for each test."""
    import tempfile
    import os
    import review_tagger.db.store as db_store_module
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    store = Store(db_path=path)
    store.init_db()
    monkeypatch.setattr(db_store_module, "_default_store", store)
    yield
    os.unlink(path)


def test_list_tag_systems_empty():
    r = client.get("/api/tag-systems")
    assert r.status_code == 200
    data = r.json()
    assert data["items"] == []


def test_create_and_get_tag_system():
    r = client.post("/api/tag-systems", json={
        "name": "测试体系",
        "csv_content": "一级标签,二级标签\n质量,好\n",
        "scene_type": "ECOMMERCE_CLOTHING",
        "description": "desc",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "测试体系"
    assert data["id"].startswith("ts_")
    sid = data["id"]

    r2 = client.get(f"/api/tag-systems/{sid}")
    assert r2.status_code == 200
    assert r2.json()["name"] == "测试体系"


def test_update_tag_system():
    r = client.post("/api/tag-systems", json={"name": "Old", "csv_content": "a,b\n"})
    sid = r.json()["id"]

    r2 = client.put(f"/api/tag-systems/{sid}", json={"name": "New", "csv_content": "c,d\n"})
    assert r2.status_code == 200
    assert r2.json()["name"] == "New"
    assert r2.json()["csv_content"] == "c,d\n"


def test_delete_tag_system():
    r = client.post("/api/tag-systems", json={"name": "Del", "csv_content": "a,b\n"})
    sid = r.json()["id"]

    r2 = client.delete(f"/api/tag-systems/{sid}")
    assert r2.status_code == 200

    r3 = client.get(f"/api/tag-systems/{sid}")
    assert r3.status_code == 404


def test_copy_tag_system():
    r = client.post("/api/tag-systems", json={"name": "Original", "csv_content": "a,b\n"})
    sid = r.json()["id"]

    r2 = client.post(f"/api/tag-systems/{sid}/copy")
    assert r2.status_code == 200
    assert r2.json()["name"] == "Original (副本)"
    assert r2.json()["id"] != sid


def test_preset_tags_endpoint():
    """After migration, /preset-tags should return items from DB."""
    r = client.get("/api/preset-tags")
    assert r.status_code == 200
    # Presets may be empty if no configs/*.csv in test env
    data = r.json()
    assert "presets" in data
    assert isinstance(data["presets"], list)
