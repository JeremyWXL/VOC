"""标签体系生成器 - 根据场景自动生成标签 CSV."""

import json
import re
import csv
import io
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from loguru import logger

from review_tagger.config import Settings, load_settings
from review_tagger.llm.client import LLMClient, create_provider
from review_tagger.core.scene_detector import SceneType
from review_tagger.prompts.scene_prompts import build_tag_generation_prompt
from review_tagger.utils import strip_markdown_code_blocks


@dataclass
class TagGenerationResult:
    """标签生成结果."""

    scene_type: SceneType
    tags: List[Dict[str, str]]
    csv_content: str
    tag_count: int
    level1_count: int
    is_template: bool


# ============ 预定义标签模板 ============

_TAG_TEMPLATES: Dict[SceneType, List[Dict[str, str]]] = {
    SceneType.ECOMMERCE_CLOTHING: [
        # 商品质量
        {"level1": "商品质量", "level2": "整体质量", "level3": "质量好"},
        {"level1": "商品质量", "level2": "整体质量", "level3": "质量差"},
        {"level1": "商品质量", "level2": "面料材质", "level3": "舒适"},
        {"level1": "商品质量", "level2": "面料材质", "level3": "不透气"},
        {"level1": "商品质量", "level2": "面料材质", "level3": "起球"},
        {"level1": "商品质量", "level2": "面料材质", "level3": "掉色"},
        {"level1": "商品质量", "level2": "做工细节", "level3": "精细"},
        {"level1": "商品质量", "level2": "做工细节", "level3": "粗糙"},
        {"level1": "商品质量", "level2": "做工细节", "level3": "有线头"},
        # 版型尺寸
        {"level1": "版型尺寸", "level2": "尺码", "level3": "偏大"},
        {"level1": "版型尺寸", "level2": "尺码", "level3": "偏小"},
        {"level1": "版型尺寸", "level2": "尺码", "level3": "标准"},
        {"level1": "版型尺寸", "level2": "版型", "level3": "修身"},
        {"level1": "版型尺寸", "level2": "版型", "level3": "宽松"},
        {"level1": "版型尺寸", "level2": "版型", "level3": "不合身"},
        # 颜色外观
        {"level1": "颜色外观", "level2": "颜色", "level3": "无色差"},
        {"level1": "颜色外观", "level2": "颜色", "level3": "有色差"},
        {"level1": "颜色外观", "level2": "颜色", "level3": "好看"},
        {"level1": "颜色外观", "level2": "外观设计", "level3": "时尚"},
        {"level1": "颜色外观", "level2": "外观设计", "level3": "老气"},
        # 物流服务
        {"level1": "物流服务", "level2": "配送速度", "level3": "速度快"},
        {"level1": "物流服务", "level2": "配送速度", "level3": "速度慢"},
        {"level1": "物流服务", "level2": "包装", "level3": "包装完好"},
        {"level1": "物流服务", "level2": "包装", "level3": "包装破损"},
        {"level1": "物流服务", "level2": "快递态度", "level3": "态度好"},
        # 价格感知
        {"level1": "价格感知", "level2": "性价比", "level3": "性价比高"},
        {"level1": "价格感知", "level2": "性价比", "level3": "性价比低"},
        {"level1": "价格感知", "level2": "价格", "level3": "便宜"},
        {"level1": "价格感知", "level2": "价格", "level3": "贵"},
        {"level1": "价格感知", "level2": "促销", "level3": "优惠力度大"},
        # 整体评价
        {"level1": "整体评价", "level2": "满意度", "level3": "满意"},
        {"level1": "整体评价", "level2": "满意度", "level3": "一般"},
        {"level1": "整体评价", "level2": "满意度", "level3": "失望"},
        {"level1": "整体评价", "level2": "推荐度", "level3": "推荐"},
        {"level1": "整体评价", "level2": "推荐度", "level3": "不推荐"},
        # 用户行为
        {"level1": "用户行为", "level2": "复购意向", "level3": "会回购"},
        {"level1": "用户行为", "level2": "复购意向", "level3": "不会回购"},
        {"level1": "用户行为", "level2": "购买渠道", "level3": "线上购买"},
        # 客服售后
        {"level1": "客服售后", "level2": "客服态度", "level3": "耐心"},
        {"level1": "客服售后", "level2": "客服态度", "level3": "敷衍"},
        {"level1": "客服售后", "level2": "退换货", "level3": "退货顺利"},
        {"level1": "客服售后", "level2": "退换货", "level3": "退货难"},
    ],

    SceneType.ECOMMERCE_ELECTRONICS: [
        # 产品质量
        {"level1": "产品质量", "level2": "整体质量", "level3": "质量好"},
        {"level1": "产品质量", "level2": "整体质量", "level3": "质量差"},
        {"level1": "产品质量", "level2": "做工细节", "level3": "精细"},
        {"level1": "产品质量", "level2": "做工细节", "level3": "粗糙"},
        {"level1": "产品质量", "level2": "耐用性", "level3": "耐用"},
        {"level1": "产品质量", "level2": "耐用性", "level3": "易损坏"},
        # 功能性能
        {"level1": "功能性能", "level2": "运行速度", "level3": "流畅"},
        {"level1": "功能性能", "level2": "运行速度", "level3": "卡顿"},
        {"level1": "功能性能", "level2": "功能", "level3": "功能齐全"},
        {"level1": "功能性能", "level2": "功能", "level3": "功能缺失"},
        {"level1": "功能性能", "level2": "兼容性", "level3": "兼容性好"},
        # 续航功耗
        {"level1": "续航功耗", "level2": "电池续航", "level3": "续航长"},
        {"level1": "续航功耗", "level2": "电池续航", "level3": "续航短"},
        {"level1": "续航功耗", "level2": "充电", "level3": "充电快"},
        {"level1": "续航功耗", "level2": "充电", "level3": "充电慢"},
        {"level1": "续航功耗", "level2": "发热", "level3": "不发热"},
        {"level1": "续航功耗", "level2": "发热", "level3": "发热严重"},
        # 外观设计
        {"level1": "外观设计", "level2": "外观", "level3": "好看"},
        {"level1": "外观设计", "level2": "外观", "level3": "一般"},
        {"level1": "外观设计", "level2": "手感", "level3": "手感好"},
        {"level1": "外观设计", "level2": "手感", "level3": "手感差"},
        {"level1": "外观设计", "level2": "重量", "level3": "轻便"},
        {"level1": "外观设计", "level2": "重量", "level3": "笨重"},
        # 配件包装
        {"level1": "配件包装", "level2": "配件", "level3": "配件齐全"},
        {"level1": "配件包装", "level2": "配件", "level3": "配件缺失"},
        {"level1": "配件包装", "level2": "包装", "level3": "包装精美"},
        # 物流服务
        {"level1": "物流服务", "level2": "配送速度", "level3": "速度快"},
        {"level1": "物流服务", "level2": "配送速度", "level3": "速度慢"},
        # 价格感知
        {"level1": "价格感知", "level2": "性价比", "level3": "性价比高"},
        {"level1": "价格感知", "level2": "性价比", "level3": "性价比低"},
        # 整体评价
        {"level1": "整体评价", "level2": "满意度", "level3": "满意"},
        {"level1": "整体评价", "level2": "满意度", "level3": "一般"},
        {"level1": "整体评价", "level2": "推荐度", "level3": "推荐"},
        # 用户行为
        {"level1": "用户行为", "level2": "复购意向", "level3": "会回购"},
        # 客服售后
        {"level1": "客服售后", "level2": "客服态度", "level3": "耐心"},
        {"level1": "客服售后", "level2": "售后服务", "level3": "售后好"},
        {"level1": "客服售后", "level2": "售后服务", "level3": "售后差"},
    ],

    SceneType.FOOD_CATERING: [
        # 口味口感
        {"level1": "口味口感", "level2": "整体味道", "level3": "好吃"},
        {"level1": "口味口感", "level2": "整体味道", "level3": "难吃"},
        {"level1": "口味口感", "level2": "整体味道", "level3": "一般"},
        {"level1": "口味口感", "level2": "咸淡", "level3": "太咸"},
        {"level1": "口味口感", "level2": "咸淡", "level3": "太淡"},
        {"level1": "口味口感", "level2": "口感", "level3": "软糯"},
        {"level1": "口味口感", "level2": "口感", "level3": "酥脆"},
        {"level1": "口味口感", "level2": "辣度", "level3": "太辣"},
        {"level1": "口味口感", "level2": "温度", "level3": "凉了"},
        # 食材新鲜
        {"level1": "食材新鲜", "level2": "新鲜度", "level3": "新鲜"},
        {"level1": "食材新鲜", "level2": "新鲜度", "level3": "不新鲜"},
        {"level1": "食材新鲜", "level2": "分量", "level3": "分量足"},
        {"level1": "食材新鲜", "level2": "分量", "level3": "分量少"},
        # 服务态度
        {"level1": "服务态度", "level2": "服务员", "level3": "热情"},
        {"level1": "服务态度", "level2": "服务员", "level3": "冷漠"},
        {"level1": "服务态度", "level2": "响应速度", "level3": "响应快"},
        {"level1": "服务态度", "level2": "响应速度", "level3": "响应慢"},
        # 环境卫生
        {"level1": "环境卫生", "level2": "整洁度", "level3": "干净"},
        {"level1": "环境卫生", "level2": "整洁度", "level3": "脏乱"},
        {"level1": "环境卫生", "level2": "氛围", "level3": "氛围好"},
        {"level1": "环境卫生", "level2": "氛围", "level3": "吵闹"},
        # 上菜速度
        {"level1": "上菜速度", "level2": "等待时间", "level3": "快"},
        {"level1": "上菜速度", "level2": "等待时间", "level3": "慢"},
        {"level1": "上菜速度", "level2": "等待时间", "level3": "适中"},
        # 价格感知
        {"level1": "价格感知", "level2": "性价比", "level3": "性价比高"},
        {"level1": "价格感知", "level2": "性价比", "level3": "性价比低"},
        {"level1": "价格感知", "level2": "人均", "level3": "便宜"},
        {"level1": "价格感知", "level2": "人均", "level3": "贵"},
        # 整体评价
        {"level1": "整体评价", "level2": "满意度", "level3": "满意"},
        {"level1": "整体评价", "level2": "满意度", "level3": "一般"},
        {"level1": "整体评价", "level2": "满意度", "level3": "失望"},
        {"level1": "整体评价", "level2": "推荐度", "level3": "推荐"},
        {"level1": "整体评价", "level2": "推荐度", "level3": "不推荐"},
        # 用户行为
        {"level1": "用户行为", "level2": "复购意向", "level3": "会再来"},
        {"level1": "用户行为", "level2": "复购意向", "level3": "不会再来"},
    ],

    SceneType.HOTEL: [
        # 房间设施
        {"level1": "房间设施", "level2": "房间大小", "level3": "宽敞"},
        {"level1": "房间设施", "level2": "房间大小", "level3": "狭小"},
        {"level1": "房间设施", "level2": "床品", "level3": "舒适"},
        {"level1": "房间设施", "level2": "床品", "level3": "不舒服"},
        {"level1": "房间设施", "level2": "设施", "level3": "齐全"},
        {"level1": "房间设施", "level2": "设施", "level3": "老旧"},
        {"level1": "房间设施", "level2": "Wifi", "level3": "信号好"},
        {"level1": "房间设施", "level2": "Wifi", "level3": "信号差"},
        {"level1": "房间设施", "level2": "隔音", "level3": "隔音好"},
        {"level1": "房间设施", "level2": "隔音", "level3": "隔音差"},
        # 卫生清洁
        {"level1": "卫生清洁", "level2": "整洁度", "level3": "干净"},
        {"level1": "卫生清洁", "level2": "整洁度", "level3": "脏乱"},
        {"level1": "卫生清洁", "level2": "气味", "level3": "无异味"},
        {"level1": "卫生清洁", "level2": "气味", "level3": "有异味"},
        # 服务态度
        {"level1": "服务态度", "level2": "前台", "level3": "热情"},
        {"level1": "服务态度", "level2": "前台", "level3": "冷漠"},
        {"level1": "服务态度", "level2": "客房服务", "level3": "及时"},
        {"level1": "服务态度", "level2": "客房服务", "level3": "不及时"},
        # 位置交通
        {"level1": "位置交通", "level2": "位置", "level3": "位置好"},
        {"level1": "位置交通", "level2": "位置", "level3": "位置偏"},
        {"level1": "位置交通", "level2": "交通", "level3": "交通便利"},
        {"level1": "位置交通", "level2": "停车", "level3": "停车方便"},
        # 餐饮服务
        {"level1": "餐饮服务", "level2": "早餐", "level3": "早餐丰富"},
        {"level1": "餐饮服务", "level2": "早餐", "level3": "早餐差"},
        # 价格感知
        {"level1": "价格感知", "level2": "性价比", "level3": "性价比高"},
        {"level1": "价格感知", "level2": "性价比", "level3": "性价比低"},
        {"level1": "价格感知", "level2": "价格", "level3": "便宜"},
        {"level1": "价格感知", "level2": "价格", "level3": "贵"},
        # 整体评价
        {"level1": "整体评价", "level2": "满意度", "level3": "满意"},
        {"level1": "整体评价", "level2": "满意度", "level3": "一般"},
        {"level1": "整体评价", "level2": "推荐度", "level3": "推荐"},
        {"level1": "整体评价", "level2": "推荐度", "level3": "不推荐"},
        # 用户行为
        {"level1": "用户行为", "level2": "复购意向", "level3": "会再来"},
        {"level1": "用户行为", "level2": "入住体验", "level3": "入住顺利"},
    ],

    SceneType.ECOMMERCE_BEAUTY: [
        {"level1": "产品效果", "level2": "整体效果", "level3": "效果好"},
        {"level1": "产品效果", "level2": "整体效果", "level3": "没效果"},
        {"level1": "产品效果", "level2": "保湿", "level3": "保湿好"},
        {"level1": "产品效果", "level2": "美白", "level3": "有提亮"},
        {"level1": "产品效果", "level2": "遮瑕", "level3": "遮瑕好"},
        {"level1": "产品效果", "level2": "持久度", "level3": "持久"},
        {"level1": "产品效果", "level2": "持久度", "level3": "易脱妆"},
        # 质地肤感
        {"level1": "质地肤感", "level2": "质地", "level3": "清爽"},
        {"level1": "质地肤感", "level2": "质地", "level3": "油腻"},
        {"level1": "质地肤感", "level2": "气味", "level3": "好闻"},
        {"level1": "质地肤感", "level2": "气味", "level3": "难闻"},
        {"level1": "质地肤感", "level2": "刺激度", "level3": "温和"},
        {"level1": "质地肤感", "level2": "刺激度", "level3": "过敏"},
        # 包装设计
        {"level1": "包装设计", "level2": "外观", "level3": "精美"},
        {"level1": "包装设计", "level2": "便携性", "level3": "方便携带"},
        # 物流服务
        {"level1": "物流服务", "level2": "配送速度", "level3": "速度快"},
        # 价格感知
        {"level1": "价格感知", "level2": "性价比", "level3": "性价比高"},
        {"level1": "价格感知", "level2": "价格", "level3": "贵"},
        # 整体评价
        {"level1": "整体评价", "level2": "满意度", "level3": "满意"},
        {"level1": "整体评价", "level2": "推荐度", "level3": "推荐"},
        # 用户行为
        {"level1": "用户行为", "level2": "复购意向", "level3": "会回购"},
        # 客服售后
        {"level1": "客服售后", "level2": "客服态度", "level3": "耐心"},
    ],

    SceneType.ECOMMERCE_FOOD: [
        {"level1": "口味口感", "level2": "整体味道", "level3": "好吃"},
        {"level1": "口味口感", "level2": "整体味道", "level3": "难吃"},
        {"level1": "口味口感", "level2": "口感", "level3": "软糯"},
        {"level1": "口味口感", "level2": "口感", "level3": "酥脆"},
        # 食材品质
        {"level1": "食材品质", "level2": "新鲜度", "level3": "新鲜"},
        {"level1": "食材品质", "level2": "新鲜度", "level3": "不新鲜"},
        {"level1": "食材品质", "level2": "分量", "level3": "分量足"},
        # 包装物流
        {"level1": "包装物流", "level2": "包装", "level3": "包装完好"},
        {"level1": "包装物流", "level2": "包装", "level3": "包装破损"},
        {"level1": "包装物流", "level2": "配送", "level3": "配送快"},
        {"level1": "包装物流", "level2": "保质期", "level3": "日期新鲜"},
        # 价格感知
        {"level1": "价格感知", "level2": "性价比", "level3": "性价比高"},
        {"level1": "价格感知", "level2": "价格", "level3": "便宜"},
        # 整体评价
        {"level1": "整体评价", "level2": "满意度", "level3": "满意"},
        {"level1": "整体评价", "level2": "推荐度", "level3": "推荐"},
        # 用户行为
        {"level1": "用户行为", "level2": "复购意向", "level3": "会回购"},
        # 客服售后
        {"level1": "客服售后", "level2": "客服态度", "level3": "耐心"},
    ],

    SceneType.ECOMMERCE_HOME: [
        {"level1": "产品质量", "level2": "整体质量", "level3": "质量好"},
        {"level1": "产品质量", "level2": "整体质量", "level3": "质量差"},
        {"level1": "产品质量", "level2": "材质", "level3": "实木"},
        {"level1": "产品质量", "level2": "材质", "level3": "板材"},
        {"level1": "产品质量", "level2": "做工", "level3": "精细"},
        {"level1": "产品质量", "level2": "耐用性", "level3": "耐用"},
        # 安装服务
        {"level1": "安装服务", "level2": "安装", "level3": "安装简单"},
        {"level1": "安装服务", "level2": "安装", "level3": "安装困难"},
        {"level1": "安装服务", "level2": "说明书", "level3": "说明清晰"},
        # 外观设计
        {"level1": "外观设计", "level2": "风格", "level3": "简约"},
        {"level1": "外观设计", "level2": "风格", "level3": "豪华"},
        {"level1": "外观设计", "level2": "颜色", "level3": "无色差"},
        # 物流服务
        {"level1": "物流服务", "level2": "配送", "level3": "送货上门"},
        {"level1": "物流服务", "level2": "配送", "level3": "配送慢"},
        # 价格感知
        {"level1": "价格感知", "level2": "性价比", "level3": "性价比高"},
        # 整体评价
        {"level1": "整体评价", "level2": "满意度", "level3": "满意"},
        {"level1": "整体评价", "level2": "推荐度", "level3": "推荐"},
        # 客服售后
        {"level1": "客服售后", "level2": "客服态度", "level3": "耐心"},
        {"level1": "客服售后", "level2": "售后", "level3": "售后好"},
    ],

    SceneType.ECOMMERCE_BABY: [
        {"level1": "产品质量", "level2": "安全性", "level3": "安全"},
        {"level1": "产品质量", "level2": "安全性", "level3": "有隐患"},
        {"level1": "产品质量", "level2": "材质", "level3": "纯棉"},
        {"level1": "产品质量", "level2": "材质", "level3": "柔软"},
        # 产品效果
        {"level1": "产品效果", "level2": "吸收性", "level3": "吸收好"},
        {"level1": "产品效果", "level2": "吸收性", "level3": "漏尿"},
        {"level1": "产品效果", "level2": "营养", "level3": "易消化"},
        {"level1": "产品效果", "level2": "营养", "level3": "上火"},
        # 包装设计
        {"level1": "包装设计", "level2": "便利性", "level3": "易开封"},
        {"level1": "包装设计", "level2": "密封性", "level3": "密封好"},
        # 物流服务
        {"level1": "物流服务", "level2": "配送", "level3": "配送快"},
        # 价格感知
        {"level1": "价格感知", "level2": "性价比", "level3": "性价比高"},
        {"level1": "价格感知", "level2": "价格", "level3": "贵"},
        # 整体评价
        {"level1": "整体评价", "level2": "满意度", "level3": "满意"},
        {"level1": "整体评价", "level2": "推荐度", "level3": "推荐"},
        # 客服售后
        {"level1": "客服售后", "level2": "客服态度", "level3": "耐心"},
    ],

    SceneType.GENERAL: [
        {"level1": "整体评价", "level2": "满意度", "level3": "满意"},
        {"level1": "整体评价", "level2": "满意度", "level3": "一般"},
        {"level1": "整体评价", "level2": "满意度", "level3": "失望"},
        {"level1": "整体评价", "level2": "推荐度", "level3": "推荐"},
        {"level1": "整体评价", "level2": "推荐度", "level3": "不推荐"},
        {"level1": "服务质量", "level2": "服务态度", "level3": "热情"},
        {"level1": "服务质量", "level2": "服务态度", "level3": "冷漠"},
        {"level1": "服务质量", "level2": "响应速度", "level3": "响应快"},
        {"level1": "价格感知", "level2": "性价比", "level3": "性价比高"},
        {"level1": "价格感知", "level2": "性价比", "level3": "性价比低"},
    ],
}


class TagGenerator:
    """标签体系生成器."""

    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or load_settings()
        self._client: Optional[LLMClient] = None

    def _get_llm_client(self) -> LLMClient:
        if self._client is None:
            self._client = LLMClient(
                provider=create_provider(self.settings.llm),
                concurrency=self.settings.llm.concurrency,
                max_retries=self.settings.llm.max_retries,
            )
        return self._client

    def generate(
        self,
        scene_type: SceneType,
        sample_reviews: Optional[List[str]] = None,
        use_template: bool = True,
        use_llm_enhance: bool = False,
    ) -> TagGenerationResult:
        """生成标签体系.

        Args:
            scene_type: 场景类型
            sample_reviews: 评论样本（用于 LLM 增强）
            use_template: 是否优先使用预定义模板
            use_llm_enhance: 是否在模板基础上用 LLM 微调（耗时）

        Returns:
            TagGenerationResult
        """
        tags: List[Dict[str, str]] = []
        is_template = False

        # 1. 尝试使用模板
        if use_template and scene_type in _TAG_TEMPLATES:
            tags = [dict(t) for t in _TAG_TEMPLATES[scene_type]]
            is_template = True
            logger.info(f"使用模板生成标签: {scene_type.value}, {len(tags)} 条")

            # TODO: LLM 增强（根据样本微调模板标签，降低空标签率）
            if use_llm_enhance and sample_reviews:
                logger.info("LLM 增强生成标签: 功能开发中，当前使用模板标签")

        # 2. 无模板或 GENERAL → LLM 动态生成
        if not tags and sample_reviews:
            tags = self._llm_generate_tags(scene_type, sample_reviews)
            is_template = False
            logger.info(f"LLM 动态生成标签: {scene_type.value}, {len(tags)} 条")

        # 3. 兜底：GENERAL 模板
        if not tags:
            tags = [dict(t) for t in _TAG_TEMPLATES[SceneType.GENERAL]]
            is_template = True

        csv_content = self._tags_to_csv(tags)
        level1_count = len(set(t["level1"] for t in tags))

        return TagGenerationResult(
            scene_type=scene_type,
            tags=tags,
            csv_content=csv_content,
            tag_count=len(tags),
            level1_count=level1_count,
            is_template=is_template,
        )

    def _llm_generate_tags(
        self,
        scene_type: SceneType,
        sample_reviews: List[str],
    ) -> List[Dict[str, str]]:
        """使用 LLM 动态生成标签（同步入口）.

        注意：此方法会启动一个临时事件循环。如果已在异步上下文中，
        请直接使用 generate_async() 异步版本。
        """
        import asyncio

        async def _call_llm() -> str:
            client = self._get_llm_client()
            messages = build_tag_generation_prompt(
                scene_type=scene_type.value,
                scene_description=SceneType.display_name(scene_type),
                sample_reviews=sample_reviews[:15],
            )
            return await client.call(
                messages=messages,
                model=self.settings.llm.model,
                temperature=0.3,
                max_tokens=2048,
            )

        try:
            content = asyncio.run(_call_llm())
        except RuntimeError as e:
            if "asyncio.run() cannot be called from a running event loop" in str(e):
                logger.error(
                    "LLM 标签生成失败：当前已在事件循环中运行，"
                    "请使用 TagGenerator.generate_async() 异步版本"
                )
                return []
            logger.error(f"LLM 标签生成失败: {e}")
            return []
        except Exception as e:
            logger.error(f"LLM 标签生成失败: {e}")
            return []

        content = strip_markdown_code_blocks(content)
        try:
            tags = json.loads(content)
            if isinstance(tags, list):
                return self._normalize_tags(tags)
        except json.JSONDecodeError:
            logger.error(f"LLM 返回内容无法解析为 JSON: {content[:200]}")
        return []

    async def generate_async(
        self,
        scene_type: SceneType,
        sample_reviews: Optional[List[str]] = None,
        use_template: bool = True,
    ) -> TagGenerationResult:
        """异步生成标签体系（用于 API 端点）."""
        tags: List[Dict[str, str]] = []
        is_template = False

        if use_template and scene_type in _TAG_TEMPLATES:
            tags = [dict(t) for t in _TAG_TEMPLATES[scene_type]]
            is_template = True

        if not tags and sample_reviews:
            client = self._get_llm_client()
            messages = build_tag_generation_prompt(
                scene_type=scene_type.value,
                scene_description=SceneType.display_name(scene_type),
                sample_reviews=sample_reviews[:15],
            )
            try:
                content = await client.call(
                    messages=messages,
                    model=self.settings.llm.model,
                    temperature=0.3,
                    max_tokens=2048,
                )
                content = content.strip()
                if content.startswith("```"):
                    content = re.sub(r"^```(?:json)?\s*", "", content)
                    content = re.sub(r"\s*```$", "", content)
                tags_raw = json.loads(content)
                if isinstance(tags_raw, list):
                    tags = self._normalize_tags(tags_raw)
                    is_template = False
            except Exception as e:
                logger.error(f"LLM 标签生成失败: {e}")

        if not tags:
            tags = [dict(t) for t in _TAG_TEMPLATES[SceneType.GENERAL]]
            is_template = True

        csv_content = self._tags_to_csv(tags)
        level1_count = len(set(t["level1"] for t in tags))

        return TagGenerationResult(
            scene_type=scene_type,
            tags=tags,
            csv_content=csv_content,
            tag_count=len(tags),
            level1_count=level1_count,
            is_template=is_template,
        )

    @staticmethod
    def _normalize_tags(tags: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        """规范化标签字段，确保只有 level1/level2/level3."""
        result = []
        for t in tags:
            if not isinstance(t, dict):
                continue
            level1 = str(t.get("level1", "")).strip()
            level2 = str(t.get("level2", "")).strip()
            level3 = str(t.get("level3", "")).strip()
            if level1 and level2 and level3:
                result.append({"level1": level1, "level2": level2, "level3": level3})
        return result

    @staticmethod
    def _tags_to_csv(tags: List[Dict[str, str]]) -> str:
        """将标签列表转为 CSV 文本."""
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["一级标签", "二级标签", "三级标签"])
        for t in tags:
            writer.writerow([t.get("level1", ""), t.get("level2", ""), t.get("level3", "")])
        return output.getvalue()
