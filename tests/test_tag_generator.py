"""标签生成器测试."""

import pytest
from review_tagger.core.tag_generator import TagGenerator, _TAG_TEMPLATES
from review_tagger.core.scene_detector import SceneType


class TestTemplateGeneration:
    """模板生成测试."""

    def test_clothing_template(self):
        gen = TagGenerator()
        result = gen.generate(SceneType.ECOMMERCE_CLOTHING, use_template=True)

        assert result.is_template is True
        assert result.tag_count > 20
        assert result.level1_count >= 6
        assert result.scene_type == SceneType.ECOMMERCE_CLOTHING

        # 验证包含关键一级标签
        level1s = set(t["level1"] for t in result.tags)
        assert "商品质量" in level1s
        assert "物流服务" in level1s
        assert "整体评价" in level1s

        # 验证 CSV 格式
        assert "一级标签,二级标签,三级标签" in result.csv_content
        lines = result.csv_content.strip().split("\n")
        assert len(lines) == result.tag_count + 1  # +header

    def test_food_template(self):
        gen = TagGenerator()
        result = gen.generate(SceneType.FOOD_CATERING, use_template=True)

        assert result.is_template is True
        assert result.tag_count > 15
        assert result.scene_type == SceneType.FOOD_CATERING

        level1s = set(t["level1"] for t in result.tags)
        assert "口味口感" in level1s
        assert "上菜速度" in level1s
        assert "整体评价" in level1s

    def test_hotel_template(self):
        gen = TagGenerator()
        result = gen.generate(SceneType.HOTEL, use_template=True)

        assert result.is_template is True
        assert result.tag_count > 15
        level1s = set(t["level1"] for t in result.tags)
        assert "房间设施" in level1s
        assert "卫生清洁" in level1s

    def test_electronics_template(self):
        gen = TagGenerator()
        result = gen.generate(SceneType.ECOMMERCE_ELECTRONICS, use_template=True)

        assert result.is_template is True
        level1s = set(t["level1"] for t in result.tags)
        assert "产品质量" in level1s
        assert "功能性能" in level1s
        assert "续航功耗" in level1s

    def test_beauty_template(self):
        gen = TagGenerator()
        result = gen.generate(SceneType.ECOMMERCE_BEAUTY, use_template=True)

        assert result.is_template is True
        level1s = set(t["level1"] for t in result.tags)
        assert "产品效果" in level1s

    def test_general_fallback(self):
        gen = TagGenerator()
        result = gen.generate(SceneType.GENERAL, use_template=True)

        assert result.is_template is True
        assert result.tag_count >= 5

    def test_no_template_uses_general(self):
        """如果场景没有模板且不用 LLM，应回退到 GENERAL."""
        gen = TagGenerator()
        # EDUCATION 暂无模板
        result = gen.generate(SceneType.EDUCATION, use_template=True)

        # 应该回退到 GENERAL 模板
        assert result.tag_count >= 5
        assert result.is_template is True


class TestTagNormalization:
    """标签规范化测试."""

    def test_normalize_tags(self):
        raw = [
            {"level1": " 商品质量 ", "level2": "面料", "level3": "舒适"},
            {"level1": "物流", "level2": "", "level3": "快"},  # level2 为空，应被过滤
            {"level1": "整体", "level2": "满意度", "level3": "满意"},
            {"bad": "data"},  # 缺少 level1/2/3，应被过滤
        ]
        result = TagGenerator._normalize_tags(raw)
        assert len(result) == 2
        assert result[0]["level1"] == "商品质量"
        assert result[0]["level2"] == "面料"

    def test_tags_to_csv(self):
        tags = [
            {"level1": "商品质量", "level2": "面料材质", "level3": "舒适"},
            {"level1": "物流服务", "level2": "配送速度", "level3": "速度快"},
        ]
        csv = TagGenerator._tags_to_csv(tags)
        assert "一级标签,二级标签,三级标签" in csv
        assert "商品质量,面料材质,舒适" in csv
        assert "物流服务,配送速度,速度快" in csv


class TestTemplateRegistry:
    """模板注册表测试."""

    def test_key_scenes_have_templates(self):
        """核心场景必须有预定义模板."""
        required = [
            SceneType.ECOMMERCE_CLOTHING,
            SceneType.ECOMMERCE_ELECTRONICS,
            SceneType.ECOMMERCE_FOOD,
            SceneType.ECOMMERCE_BEAUTY,
            SceneType.ECOMMERCE_HOME,
            SceneType.ECOMMERCE_BABY,
            SceneType.FOOD_CATERING,
            SceneType.HOTEL,
            SceneType.GENERAL,
        ]
        for scene in required:
            assert scene in _TAG_TEMPLATES, f"{scene.value} 缺少预定义模板"
            assert len(_TAG_TEMPLATES[scene]) > 0

    def test_template_structure(self):
        """所有模板标签必须有 level1/level2/level3."""
        for scene, tags in _TAG_TEMPLATES.items():
            for tag in tags:
                assert "level1" in tag and tag["level1"], f"{scene.value} 标签缺少 level1"
                assert "level2" in tag and tag["level2"], f"{scene.value} 标签缺少 level2"
                assert "level3" in tag and tag["level3"], f"{scene.value} 标签缺少 level3"
