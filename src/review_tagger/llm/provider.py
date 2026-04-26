"""LLM Provider 抽象接口."""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional


class LLMProvider(ABC):
    """LLM 提供商抽象基类."""

    @abstractmethod
    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 1024,
        response_format: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> str:
        """发送聊天请求，返回原始文本."""
        pass

    @abstractmethod
    def count_tokens(self, text: str, model: Optional[str] = None) -> int:
        """估算 token 数."""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """提供商名称."""
        pass
