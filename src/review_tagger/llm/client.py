"""LLM 客户端 - 批量调用、重试、限流."""

import asyncio
from typing import List, Dict, Any, Optional, Callable
from dataclasses import dataclass
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from review_tagger.llm.provider import LLMProvider


def create_provider(cfg) -> LLMProvider:
    """根据配置创建对应的 LLM Provider（消除各处重复逻辑）."""
    from review_tagger.llm.providers import OpenAIProvider, DeepSeekProvider, DashScopeProvider

    if cfg.provider == "deepseek":
        return DeepSeekProvider(
            api_key=cfg.api_key or "",
            timeout=cfg.timeout,
            max_retries=cfg.max_retries,
        )
    elif cfg.provider == "dashscope":
        return DashScopeProvider(
            api_key=cfg.api_key or "",
            timeout=cfg.timeout,
            max_retries=cfg.max_retries,
        )
    else:
        return OpenAIProvider(
            api_key=cfg.api_key or "",
            base_url=cfg.base_url,
            timeout=cfg.timeout,
            max_retries=cfg.max_retries,
        )


@dataclass
class LLMRequest:
    """单个 LLM 请求."""
    id: str
    messages: List[Dict[str, str]]
    model: Optional[str] = None
    temperature: float = 0.1
    max_tokens: int = 1024
    response_format: Optional[Dict[str, str]] = None
    metadata: Dict[str, Any] = None


@dataclass
class LLMResponse:
    """单个 LLM 响应."""
    id: str
    content: str
    success: bool = True
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class LLMClient:
    """高阶 LLM 客户端."""

    def __init__(
        self,
        provider: LLMProvider,
        concurrency: int = 5,
        batch_size: int = 10,
        max_retries: int = 3,
    ):
        self.provider = provider
        self.concurrency = concurrency
        self.batch_size = batch_size
        self.max_retries = max_retries
        self._semaphore = asyncio.Semaphore(concurrency)

    async def call(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 1024,
        response_format: Optional[Dict[str, str]] = None,
    ) -> str:
        """单次调用（带重试）."""
        return await self._call_with_retry(
            messages, model, temperature, max_tokens, response_format
        )

    async def batch_call(
        self,
        requests: List[LLMRequest],
        progress_callback: Optional[Callable[[int, int], None]] = None,
    ) -> List[LLMResponse]:
        """批量异步调用."""
        results: List[LLMResponse] = []
        total = len(requests)

        for i in range(0, total, self.batch_size):
            batch = requests[i : i + self.batch_size]
            tasks = [self._handle_one(req) for req in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for req, res in zip(batch, batch_results):
                if isinstance(res, Exception):
                    results.append(LLMResponse(
                        id=req.id,
                        content="",
                        success=False,
                        error=str(res),
                        metadata=req.metadata,
                    ))
                else:
                    results.append(res)

            if progress_callback:
                progress_callback(min(i + self.batch_size, total), total)

        return results

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((TimeoutError, ConnectionError)),
        reraise=True,
    )
    async def _call_with_retry(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str],
        temperature: float,
        max_tokens: int,
        response_format: Optional[Dict[str, str]],
    ) -> str:
        async with self._semaphore:
            return await self.provider.chat(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=response_format,
            )

    async def _handle_one(self, req: LLMRequest) -> LLMResponse:
        try:
            content = await self._call_with_retry(
                messages=req.messages,
                model=req.model,
                temperature=req.temperature,
                max_tokens=req.max_tokens,
                response_format=req.response_format,
            )
            return LLMResponse(
                id=req.id,
                content=content,
                success=True,
                metadata=req.metadata,
            )
        except Exception as e:
            logger.error(f"LLM request failed [{req.id}]: {e}")
            return LLMResponse(
                id=req.id,
                content="",
                success=False,
                error=str(e),
                metadata=req.metadata,
            )
