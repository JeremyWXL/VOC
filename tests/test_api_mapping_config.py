"""测试映射配置持久化 API."""

import pytest
from fastapi.testclient import TestClient

from review_tagger.api.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_mapping_payload():
    return {
        "name": "测试映射配置",
        "profiles": [
            {"id": "p1", "name": "服装", "file_path": "/tmp/p1.csv", "description": ""},
        ],
        "rules": [
            {
                "id": "r1",
                "name": "服装规则",
                "conditions": [{"column": "类目", "op": "==", "value": "服装"}],
                "profile_id": "p1",
                "priority": 10,
            },
        ],
        "default_profile_id": "p1",
    }


class TestMappingConfigAPI:
    def test_create_mapping_config(self, client, sample_mapping_payload):
        res = client.post("/api/mapping-configs", json=sample_mapping_payload)
        assert res.status_code == 200
        data = res.json()
        assert data["id"].startswith("mc_")
        assert data["name"] == "测试映射配置"
        assert data["profiles_count"] == 1
        assert data["rules_count"] == 1

    def test_list_mapping_configs(self, client, sample_mapping_payload):
        # 先创建一个
        client.post("/api/mapping-configs", json=sample_mapping_payload)
        res = client.get("/api/mapping-configs")
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert len(data["items"]) >= 1

    def test_get_mapping_config(self, client, sample_mapping_payload):
        create_res = client.post("/api/mapping-configs", json=sample_mapping_payload)
        cid = create_res.json()["id"]

        res = client.get(f"/api/mapping-configs/{cid}")
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == cid
        assert data["name"] == "测试映射配置"
        assert "config" in data
        assert data["config"]["profiles"][0]["id"] == "p1"

    def test_get_mapping_config_not_found(self, client):
        res = client.get("/api/mapping-configs/mc_notexist")
        assert res.status_code == 404

    def test_delete_mapping_config(self, client, sample_mapping_payload):
        create_res = client.post("/api/mapping-configs", json=sample_mapping_payload)
        cid = create_res.json()["id"]

        res = client.delete(f"/api/mapping-configs/{cid}")
        assert res.status_code == 200
        assert res.json()["success"] is True

        # 确认已删除
        get_res = client.get(f"/api/mapping-configs/{cid}")
        assert get_res.status_code == 404


class TestMappingConfigBackwardCompat:
    def test_old_tag_mapping_config_still_works(self, client, sample_mapping_payload):
        """旧的 POST /api/tag-mapping-config 内存模式仍然可用."""
        payload = {
            "profiles": sample_mapping_payload["profiles"],
            "rules": sample_mapping_payload["rules"],
            "default_profile_id": sample_mapping_payload["default_profile_id"],
        }
        res = client.post("/api/tag-mapping-config", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "config_key" in data
        assert data["config_key"].startswith("mapping_")
        assert data["profiles_count"] == 1
        assert data["rules_count"] == 1
