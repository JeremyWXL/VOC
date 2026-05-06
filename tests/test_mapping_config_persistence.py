"""测试映射配置持久化到 SQLite."""

import json
import pytest

from review_tagger.db.store import Store, create_mapping_config, get_mapping_config, list_mapping_configs, delete_mapping_config
from review_tagger.core.tag_mapping import TagMappingConfig, TagProfile, TagMappingRule, Condition


@pytest.fixture
def store(tmp_path):
    s = Store(db_path=str(tmp_path / "test.db"))
    s.init_db()
    return s


@pytest.fixture
def sample_config() -> TagMappingConfig:
    return TagMappingConfig(
        profiles=[
            TagProfile(id="p1", name="服装", file_path="/tmp/p1.csv"),
            TagProfile(id="p2", name="数码", file_path="/tmp/p2.csv"),
        ],
        rules=[
            TagMappingRule(
                id="r1",
                name="服装规则",
                conditions=[Condition(column="类目", op="==", value="服装")],
                profile_id="p1",
                priority=10,
            ),
        ],
        default_profile_id="p2",
    )


class TestMappingConfigStore:
    def test_create_and_get(self, store, sample_config):
        config_json = json.dumps(sample_config.to_dict(), ensure_ascii=False)
        cid = store.create_mapping_config(name="测试配置", config_json=config_json)
        assert cid.startswith("mc_")

        row = store.get_mapping_config(cid)
        assert row is not None
        assert row["name"] == "测试配置"
        loaded = TagMappingConfig.from_dict(json.loads(row["config_json"]))
        assert len(loaded.profiles) == 2
        assert loaded.profiles[0].name == "服装"
        assert len(loaded.rules) == 1

    def test_list_and_delete(self, store, sample_config):
        config_json = json.dumps(sample_config.to_dict(), ensure_ascii=False)
        c1 = store.create_mapping_config(name="配置A", config_json=config_json)
        c2 = store.create_mapping_config(name="配置B", config_json=config_json)

        configs = store.list_mapping_configs()
        assert len(configs) == 2
        names = [c["name"] for c in configs]
        assert "配置A" in names
        assert "配置B" in names

        store.delete_mapping_config(c1)
        assert store.get_mapping_config(c1) is None
        assert store.get_mapping_config(c2) is not None

    def test_update(self, store, sample_config):
        config_json = json.dumps(sample_config.to_dict(), ensure_ascii=False)
        cid = store.create_mapping_config(name="旧名称", config_json=config_json)
        store.update_mapping_config(cid, name="新名称")
        row = store.get_mapping_config(cid)
        assert row["name"] == "新名称"

    def test_module_functions(self, tmp_path, sample_config):
        import review_tagger.db.store as db_store_module
        # 使用临时数据库避免污染默认库
        db_store_module._default_store = Store(db_path=str(tmp_path / "mod.db"))
        db_store_module._default_store.init_db()

        config_json = json.dumps(sample_config.to_dict(), ensure_ascii=False)
        cid = db_store_module.create_mapping_config(name="模块测试", config_json=config_json)
        assert cid.startswith("mc_")

        row = db_store_module.get_mapping_config(cid)
        assert row["name"] == "模块测试"

        all_cfgs = db_store_module.list_mapping_configs()
        assert len(all_cfgs) == 1

        db_store_module.delete_mapping_config(cid)
        assert db_store_module.get_mapping_config(cid) is None


class TestMappingConfigResolveFromStore:
    def test_resolve_after_load(self, store, sample_config):
        config_json = json.dumps(sample_config.to_dict(), ensure_ascii=False)
        cid = store.create_mapping_config(name="解析测试", config_json=config_json)
        row = store.get_mapping_config(cid)
        loaded = TagMappingConfig.from_dict(json.loads(row["config_json"]))

        # 测试 resolve 方法
        profile = loaded.resolve({"类目": "服装"})
        assert profile is not None
        assert profile.id == "p1"

        profile = loaded.resolve({"类目": "数码"})
        assert profile is not None
        assert profile.id == "p2"  # default
