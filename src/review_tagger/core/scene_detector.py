"""场景识别器 - 根据评论样本识别业务场景."""

import json
import re
from enum import Enum
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from loguru import logger

from review_tagger.config import Settings, load_settings
from review_tagger.llm.client import LLMClient
from review_tagger.llm.providers import OpenAIProvider
from review_tagger.prompts.scene_prompts import build_scene_detection_prompt


class SceneType(str, Enum):
    """预定义场景类型."""

    ECOMMERCE_CLOTHING = "ecommerce_clothing"
    ECOMMERCE_ELECTRONICS = "ecommerce_electronics"
    ECOMMERCE_FOOD = "ecommerce_food"
    ECOMMERCE_BEAUTY = "ecommerce_beauty"
    ECOMMERCE_HOME = "ecommerce_home"
    ECOMMERCE_BABY = "ecommerce_baby"
    FOOD_CATERING = "food_catering"
    HOTEL = "hotel"
    TRAVEL = "travel"
    EDUCATION = "education"
    HEALTHCARE = "healthcare"
    ENTERTAINMENT = "entertainment"
    GENERAL = "general"

    @classmethod
    def display_name(cls, scene_type: "SceneType") -> str:
        """返回中文显示名."""
        names = {
            cls.ECOMMERCE_CLOTHING: "服装电商",
            cls.ECOMMERCE_ELECTRONICS: "数码电商",
            cls.ECOMMERCE_FOOD: "食品电商",
            cls.ECOMMERCE_BEAUTY: "美妆电商",
            cls.ECOMMERCE_HOME: "家居电商",
            cls.ECOMMERCE_BABY: "母婴电商",
            cls.FOOD_CATERING: "餐饮到店",
            cls.HOTEL: "酒店住宿",
            cls.TRAVEL: "旅游出行",
            cls.EDUCATION: "教育培训",
            cls.HEALTHCARE: "医疗健康",
            cls.ENTERTAINMENT: "娱乐休闲",
            cls.GENERAL: "通用/其他",
        }
        return names.get(scene_type, scene_type.value)


@dataclass
class SceneDetectionResult:
    """场景识别结果."""

    scene_type: SceneType
    confidence: float
    description: str
    keywords: List[str]
    is_fallback: bool = False  # 是否为 keyword fallback


# Keyword-based fallback 映射
SCENE_KEYWORDS: Dict[SceneType, List[str]] = {
    SceneType.ECOMMERCE_CLOTHING: [
        "衣服", "服装", "尺码", "面料", "版型", "裤子", "裙子", "外套", "T恤",
        "鞋子", "鞋", "穿搭", "试穿", "合身", "偏大", "偏小", "褪色", "起球",
    ],
    SceneType.ECOMMERCE_ELECTRONICS: [
        "手机", "电脑", "电池", "充电", "屏幕", "卡顿", "发热", "像素", "续航",
        "耳机", "音响", "家电", "电视", "冰箱", "洗衣机", "路由器", "信号",
    ],
    SceneType.ECOMMERCE_FOOD: [
        "零食", "口味", "好吃", "难吃", "新鲜", "保质期", "包装", "零食", "饮料",
        "咖啡", "茶叶", "水果", "生鲜", "肉类", "甜品", "辣", "甜", "酸",
    ],
    SceneType.ECOMMERCE_BEAUTY: [
        "化妆品", "护肤", "口红", "面膜", "香水", "保湿", "美白", "遮瑕",
        "眼影", "粉底", "乳液", "精华", "过敏", "刺激", "肤质",
    ],
    SceneType.ECOMMERCE_HOME: [
        "家具", "沙发", "床垫", "枕头", "被子", "窗帘", "桌子", "椅子",
        "厨房", "厨具", "锅", "碗", "收纳", "装饰", "灯具",
    ],
    SceneType.ECOMMERCE_BABY: [
        "奶粉", "尿布", "纸尿裤", "婴儿", "宝宝", "辅食", "奶瓶", "童装",
        "玩具", "推车", "安全座椅", "孕妇", "孕妈",
    ],
    SceneType.FOOD_CATERING: [
        "餐厅", "服务员", "上菜", "菜品", "菜单", "点菜", "就餐", "用餐",
        " waiter", " waitress", "大厨", "厨师", "包厢", "排队", "等位",
    ],
    SceneType.HOTEL: [
        "酒店", "房间", "前台", "入住", "退房", "客房", "大床", "双床",
        "早餐", "Wifi", "隔音", "卫生", "打扫", "押金",
    ],
    SceneType.TRAVEL: [
        "景点", "导游", "旅行社", "机票", "航班", "登机", "签证", "护照",
        "景区", "门票", "度假村", "民宿", "自驾游", "跟团",
    ],
    SceneType.EDUCATION: [
        "课程", "老师", "教学", "培训", "学习", "作业", "考试", "题库",
        "网课", "直播课", "辅导班", "家教", "留学", "考研",
    ],
    SceneType.HEALTHCARE: [
        "医院", "医生", "护士", "挂号", "排队", "检查", "药品", "处方",
        "体检", "诊所", "牙科", "中医", "西药", "疗效", "副作用",
    ],
    SceneType.ENTERTAINMENT: [
        "电影", "影院", "KTV", "健身房", "瑜伽", "游泳", "游乐园", "剧本杀",
        "密室", "演唱会", "演出", "会员", "教练", "器材",
    ],
}


class SceneDetector:
    """场景识别器."""

    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or load_settings()
        self._client: Optional[LLMClient] = None

    def _get_llm_client(self) -> LLMClient:
        if self._client is None:
            provider = OpenAIProvider(
                api_key=self.settings.llm.api_key,
                base_url=self.settings.llm.base_url,
                timeout=self.settings.llm.timeout,
                max_retries=self.settings.llm.max_retries,
            )
            self._client = LLMClient(
                provider=provider,
                concurrency=self.settings.llm.concurrency,
                max_retries=self.settings.llm.max_retries,
            )
        return self._client

    async def detect(
        self,
        reviews: List[str],
        sample_size: int = 20,
        use_llm: bool = True,
    ) -> SceneDetectionResult:
        """识别评论所属场景.

        Args:
            reviews: 评论内容列表
            sample_size: 采样数量（控制 token）
            use_llm: 是否使用 LLM（false 则只用 keyword fallback）

        Returns:
            SceneDetectionResult
        """
        # 1. 采样
        samples = reviews[:sample_size]
        if not samples:
            return SceneDetectionResult(
                scene_type=SceneType.GENERAL,
                confidence=0.0,
                description="没有提供评论样本",
                keywords=[],
                is_fallback=True,
            )

        # 2. 先做一次 keyword fallback（作为保底 + LLM 参考）
        keyword_result = self._keyword_detect(samples)

        if not use_llm:
            return keyword_result

        # 3. LLM 识别
        try:
            llm_result = await self._llm_detect(samples)
            # 如果 LLM 结果置信度低，用 keyword 结果兜底
            if llm_result.confidence < 0.5 and keyword_result.confidence > 0.3:
                logger.warning(
                    f"LLM 场景识别置信度低 ({llm_result.confidence})，"
                    f"回退到 keyword 结果: {keyword_result.scene_type.value}"
                )
                return SceneDetectionResult(
                    scene_type=keyword_result.scene_type,
                    confidence=keyword_result.confidence,
                    description=f"{keyword_result.description} (LLM置信度低，keyword兜底)",
                    keywords=keyword_result.keywords,
                    is_fallback=True,
                )
            return llm_result
        except Exception as e:
            logger.error(f"LLM 场景识别失败: {e}，回退到 keyword 匹配")
            return SceneDetectionResult(
                scene_type=keyword_result.scene_type,
                confidence=keyword_result.confidence * 0.8,
                description=f"{keyword_result.description} (LLM失败，keyword兜底)",
                keywords=keyword_result.keywords,
                is_fallback=True,
            )

    def _keyword_detect(self, samples: List[str]) -> SceneDetectionResult:
        """基于关键词的轻量场景识别."""
        text = " ".join(samples)
        scores: Dict[SceneType, int] = {}

        for scene, keywords in SCENE_KEYWORDS.items():
            score = 0
            matched = []
            for kw in keywords:
                count = len(re.findall(re.escape(kw), text))
                if count > 0:
                    score += count
                    matched.append(kw)
            if score > 0:
                scores[scene] = score

        if not scores:
            return SceneDetectionResult(
                scene_type=SceneType.GENERAL,
                confidence=0.3,
                description="未匹配到明显场景关键词",
                keywords=[],
                is_fallback=True,
            )

        best_scene = max(scores, key=scores.get)
        total_score = sum(scores.values())
        confidence = min(0.95, scores[best_scene] / max(total_score, 1))

        # 找到匹配的关键词
        matched_kws = []
        for kw in SCENE_KEYWORDS[best_scene]:
            if kw in text:
                matched_kws.append(kw)

        return SceneDetectionResult(
            scene_type=best_scene,
            confidence=confidence,
            description=f"关键词匹配: {', '.join(matched_kws[:5])}",
            keywords=matched_kws[:10],
            is_fallback=True,
        )

    async def _llm_detect(self, samples: List[str]) -> SceneDetectionResult:
        """基于 LLM 的场景识别."""
        client = self._get_llm_client()
        messages = build_scene_detection_prompt(samples)

        content = await client.call(
            messages=messages,
            model=self.settings.llm.model,
            temperature=0.1,
            max_tokens=512,
            response_format={"type": "json_object"},
        )

        # 清理可能的 markdown 代码块
        content = content.strip()
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)

        data = json.loads(content)

        scene_str = data.get("scene_type", "general")
        try:
            scene_type = SceneType(scene_str)
        except ValueError:
            scene_type = SceneType.GENERAL

        return SceneDetectionResult(
            scene_type=scene_type,
            confidence=float(data.get("confidence", 0.5)),
            description=data.get("description", ""),
            keywords=data.get("keywords", []),
            is_fallback=False,
        )
