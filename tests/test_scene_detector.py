"""场景识别器测试."""

import pytest
from review_tagger.core.scene_detector import (
    SceneDetector,
    SceneType,
    SceneDetectionResult,
    SCENE_KEYWORDS,
)


class TestKeywordDetect:
    """Keyword fallback 检测测试."""

    def test_clothing_scene(self):
        reviews = [
            "这件衣服尺码偏大，建议买小一码",
            "面料很舒服，但是起球严重",
            "版型修身，洗了两次没掉色",
        ]
        detector = SceneDetector()
        result = detector._keyword_detect(reviews)

        assert result.scene_type == SceneType.ECOMMERCE_CLOTHING
        assert result.confidence > 0.5
        assert any(kw in result.keywords for kw in ["尺码", "面料", "版型"])
        assert result.is_fallback is True

    def test_food_catering_scene(self):
        reviews = [
            "菜品味道不错，但是上菜太慢了",
            "服务员态度很好，环境也很干净",
            "等了一个小时才上菜，分量倒是很足",
        ]
        detector = SceneDetector()
        result = detector._keyword_detect(reviews)

        assert result.scene_type == SceneType.FOOD_CATERING
        assert result.confidence > 0.3
        assert any(kw in result.keywords for kw in ["服务员", "上菜", "菜品"])

    def test_hotel_scene(self):
        reviews = [
            "酒店房间很干净，但是隔音效果一般",
            "前台服务很热情，早餐也很丰富",
            "Wifi信号太差了，根本连不上",
        ]
        detector = SceneDetector()
        result = detector._keyword_detect(reviews)

        assert result.scene_type == SceneType.HOTEL
        assert result.confidence > 0.3

    def test_electronics_scene(self):
        reviews = [
            "手机电池续航很短，一天要充三次",
            "屏幕显示效果很好，但是容易发热",
            "充电速度很快，但是信号不太稳定",
        ]
        detector = SceneDetector()
        result = detector._keyword_detect(reviews)

        assert result.scene_type == SceneType.ECOMMERCE_ELECTRONICS
        assert result.confidence > 0.5

    def test_general_fallback(self):
        reviews = ["这是一段没有任何特征的内容", " another generic text"]
        detector = SceneDetector()
        result = detector._keyword_detect(reviews)

        assert result.scene_type == SceneType.GENERAL
        assert result.confidence < 0.5
        assert result.is_fallback is True

    def test_empty_reviews(self):
        detector = SceneDetector()
        result = detector._keyword_detect([])

        assert result.scene_type == SceneType.GENERAL
        assert result.confidence < 0.5


class TestSceneType:
    """SceneType 枚举测试."""

    def test_display_names(self):
        assert SceneType.display_name(SceneType.ECOMMERCE_CLOTHING) == "服装电商"
        assert SceneType.display_name(SceneType.FOOD_CATERING) == "餐饮到店"
        assert SceneType.display_name(SceneType.HOTEL) == "酒店住宿"
        assert SceneType.display_name(SceneType.GENERAL) == "通用/其他"

    def test_all_scenes_have_keywords(self):
        """确保每个非 GENERAL 场景都有关键词映射."""
        for scene in SceneType:
            if scene != SceneType.GENERAL:
                assert scene in SCENE_KEYWORDS, f"{scene.value} 缺少关键词映射"
                assert len(SCENE_KEYWORDS[scene]) > 0

    def test_scene_values_unique(self):
        values = [s.value for s in SceneType]
        assert len(values) == len(set(values))
