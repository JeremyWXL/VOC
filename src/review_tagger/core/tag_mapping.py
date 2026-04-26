"""多维度标签体系映射引擎.

支持根据评论的元数据（如商品类目、购物环节等）动态匹配不同的标签体系。
"""

import json
import re
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from review_tagger.loaders import load_tag_hierarchy, format_tag_tree


class Operator(str, Enum):
    """规则运算符."""
    EQ = "=="
    NE = "!="
    CONTAINS = "contains"
    IN = "in"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    REGEX = "regex"


class Condition(BaseModel):
    """单个条件：列名 运算符 值."""
    column: str
    op: Operator = Field(default=Operator.EQ)
    value: str

    def evaluate(self, row: Dict[str, Any]) -> bool:
        raw = row.get(self.column)
        cell = str(raw).strip() if raw is not None else ""
        target = self.value.strip()
        if self.op == Operator.EQ:
            return cell == target
        if self.op == Operator.NE:
            return cell != target
        if self.op == Operator.CONTAINS:
            return target in cell
        if self.op == Operator.IN:
            targets = [t.strip() for t in target.split(",")]
            return cell in targets
        if self.op == Operator.STARTS_WITH:
            return cell.startswith(target)
        if self.op == Operator.ENDS_WITH:
            return cell.endswith(target)
        if self.op == Operator.REGEX:
            try:
                return bool(re.search(target, cell))
            except re.error:
                return False
        return False


class TagProfile(BaseModel):
    """标签方案（一个标签体系文件 + 元信息）."""
    id: str
    name: str
    description: str = ""
    file_path: str
    tag_tree: Optional[Dict[str, Any]] = Field(default=None, exclude=True)
    tag_tree_text: Optional[str] = Field(default=None, exclude=True)

    def load(self) -> None:
        if self.tag_tree is None:
            self.tag_tree = load_tag_hierarchy(self.file_path)
            self.tag_tree_text = format_tag_tree(self.tag_tree)


class TagMappingRule(BaseModel):
    """映射规则：当条件满足时，使用指定标签方案."""
    id: str
    name: str = ""
    conditions: List[Condition] = Field(default_factory=list)
    profile_id: str
    priority: int = Field(default=0)

    def match(self, row: Dict[str, Any]) -> bool:
        if not self.conditions:
            return False
        return all(c.evaluate(row) for c in self.conditions)


class TagMappingConfig(BaseModel):
    """完整的映射配置."""
    profiles: List[TagProfile] = Field(default_factory=list)
    rules: List[TagMappingRule] = Field(default_factory=list)
    default_profile_id: Optional[str] = Field(default=None)

    _profile_map: Optional[Dict[str, TagProfile]] = None

    def _build_profile_map(self) -> Dict[str, TagProfile]:
        if self._profile_map is None:
            self._profile_map = {p.id: p for p in self.profiles}
        return self._profile_map

    def get_profile(self, profile_id: str) -> Optional[TagProfile]:
        return self._build_profile_map().get(profile_id)

    def resolve(self, row: Dict[str, Any]) -> Optional[TagProfile]:
        sorted_rules = sorted(self.rules, key=lambda r: r.priority, reverse=True)
        for rule in sorted_rules:
            if rule.match(row):
                return self.get_profile(rule.profile_id)
        if self.default_profile_id:
            return self.get_profile(self.default_profile_id)
        if self.profiles:
            return self.profiles[0]
        return None

    def load_all_profiles(self) -> None:
        for p in self.profiles:
            p.load()

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump(mode="json")

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TagMappingConfig":
        return cls(**data)

    def save_to_file(self, path: str) -> None:
        Path(path).write_text(json.dumps(self.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")

    @classmethod
    def load_from_file(cls, path: str) -> "TagMappingConfig":
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls.from_dict(data)
