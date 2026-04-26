"""LLM Provider 具体实现."""

from typing import List, Dict, Any, Optional

from loguru import logger

from review_tagger.llm.provider import LLMProvider


class OpenAIProvider(LLMProvider):
    """OpenAI / 兼容 OpenAI API 的提供商."""

    def __init__(
        self,
        api_key: str,
        base_url: Optional[str] = None,
        timeout: float = 60.0,
        max_retries: int = 3,
    ):
        from openai import AsyncOpenAI
        self._client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout,
            max_retries=max_retries,
        )
        self._base_url = base_url

    @property
    def name(self) -> str:
        return f"openai({self._base_url or 'default'})"

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 1024,
        response_format: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> str:
        params: Dict[str, Any] = {
            "model": model or "gpt-4o-mini",
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            params["response_format"] = response_format
        params.update(kwargs)

        try:
            resp = await self._client.chat.completions.create(**params)
            content = resp.choices[0].message.content or ""
            logger.debug(
                f"LLM call: model={params['model']}, "
                f"prompt_tokens={resp.usage.prompt_tokens if resp.usage else '?'}, "
                f"completion_tokens={resp.usage.completion_tokens if resp.usage else '?'}"
            )
            return content
        except Exception as e:
            from openai import OpenAIError
            if isinstance(e, OpenAIError):
                err_msg = str(e).lower()
                if response_format and "json_object" in err_msg and "not supported" in err_msg:
                    logger.warning(f"模型不支持 json_object，自动回退到文本模式: {e}")
                    params.pop("response_format", None)
                    resp = await self._client.chat.completions.create(**params)
                    content = resp.choices[0].message.content or ""
                    logger.debug(
                        f"LLM call (fallback): model={params['model']}, "
                        f"prompt_tokens={resp.usage.prompt_tokens if resp.usage else '?'}, "
                        f"completion_tokens={resp.usage.completion_tokens if resp.usage else '?'}"
                    )
                    return content
                logger.error(f"OpenAI API error: {e}")
            raise

    def count_tokens(self, text: str, model: Optional[str] = None) -> int:
        """使用 tiktoken 估算 token."""
        try:
            import tiktoken
            enc = tiktoken.encoding_for_model(model or "gpt-4o-mini")
            return len(enc.encode(text))
        except Exception:
            # 粗略估算: 1 token ≈ 1.5 中文字符
            return int(len(text) * 0.6)


class AzureOpenAIProvider(LLMProvider):
    """Azure OpenAI Provider（预留）."""

    def __init__(self, api_key: str, endpoint: str, api_version: str = "2024-06-01"):
        from openai import AsyncOpenAI
        self._client = AsyncOpenAI(
            api_key=api_key,
            base_url=f"{endpoint}/openai/deployments",
            default_query={"api-version": api_version},
        )

    @property
    def name(self) -> str:
        return "azure_openai"

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 1024,
        response_format: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> str:
        # Azure 使用 deployment_id 作为 model
        return await OpenAIProvider.chat(self, messages, model, temperature, max_tokens, response_format, **kwargs)

    def count_tokens(self, text: str, model: Optional[str] = None) -> int:
        return OpenAIProvider.count_tokens(self, text, model)


class DashScopeProvider(OpenAIProvider):
    """阿里云 DashScope（通义千问），兼容 OpenAI 接口."""

    def __init__(self, api_key: str, timeout: float = 60.0, max_retries: int = 3):
        super().__init__(
            api_key=api_key,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            timeout=timeout,
            max_retries=max_retries,
        )

    @property
    def name(self) -> str:
        return "dashscope"


class DeepSeekProvider(OpenAIProvider):
    """DeepSeek Provider."""

    def __init__(self, api_key: str, timeout: float = 60.0, max_retries: int = 3):
        super().__init__(
            api_key=api_key,
            base_url="https://api.deepseek.com/v1",
            timeout=timeout,
            max_retries=max_retries,
        )

    @property
    def name(self) -> str:
        return "deepseek"
