"""数据模型定义."""

from enum import Enum
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class Sentiment(str, Enum):
    """情感极性."""
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


class TagCategory(str, Enum):
    """标签分类体系."""
    SENTIMENT = "sentiment"
    QUALITY = "quality"
    SERVICE = "service"
    LOGISTICS = "logistics"
    VALUE = "value"
    SCENE = "scene"
    INTENT = "intent"
    ASPECT = "aspect"


class Tag(BaseModel):
    """单个标签."""
    category: TagCategory = Field(...)
    name: str = Field(...)
    label: str = Field(default="")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    source: str = Field(default="llm")


class TagMatch(BaseModel):
    """标签匹配项."""
    level1: str
    level2: Optional[str] = None
    level3: Optional[str] = None
    level4: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)
    reason: Optional[str] = None


class Review(BaseModel):
    """原始评论."""
    id: Optional[str] = Field(default=None)
    content: str = Field(..., min_length=1)
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    product_name: Optional[str] = Field(default=None)
    category: Optional[str] = Field(default=None)
    created_at: Optional[datetime] = Field(default=None)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TagResult(BaseModel):
    """标签化结果."""
    review_id: Optional[str] = Field(default=None)
    content: str = Field(...)
    tags: List[Tag] = Field(default_factory=list)
    sentiment: Optional[Sentiment] = Field(default=None)
    keywords: List[str] = Field(default_factory=list)
    aspects: List[str] = Field(default_factory=list)
    summary: Optional[str] = Field(default=None)
    uncertain: bool = False
    authenticity_score: float = 1.0
    llm_raw: Optional[Dict[str, Any]] = Field(default=None)
    processed_at: datetime = Field(default_factory=datetime.now)
    source_engine: str = Field(default="llm")

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump(mode="json")


class TagSystem(BaseModel):
    """标签体系."""
    id: str
    name: str
    scene_type: Optional[str] = Field(default="")
    description: Optional[str] = Field(default="")
    csv_content: str
    is_preset: bool = Field(default=False)
    created_at: Optional[str] = Field(default=None)
    updated_at: Optional[str] = Field(default=None)


class TagSystemCreate(BaseModel):
    """创建标签体系请求."""
    name: str
    scene_type: Optional[str] = Field(default="")
    description: Optional[str] = Field(default="")
    csv_content: str
