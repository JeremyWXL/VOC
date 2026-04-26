"""配置管理."""

import os
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_FILE = PROJECT_ROOT / ".env"


class LLMConfig(BaseModel):
    """LLM 配置."""
    provider: str = Field(default="openai", description="提供商: openai/azure/dashscope/custom")
    api_key: Optional[str] = Field(default=None)
    base_url: Optional[str] = Field(default=None, description="自定义 API Base URL")
    model: str = Field(default="gpt-4o-mini", description="模型名称")
    max_tokens: int = Field(default=1024)
    temperature: float = Field(default=0.1, ge=0.0, le=2.0)
    timeout: float = Field(default=60.0)
    max_retries: int = Field(default=3)
    concurrency: int = Field(default=5, description="并发请求数")
    batch_size: int = Field(default=10, description="每批处理条数")
    use_json_mode: bool = Field(default=True, description="使用 JSON Mode")
    system_prompt_path: Optional[str] = Field(default=None)


class TaggerConfig(BaseModel):
    """标签引擎配置."""
    engine: str = Field(default="hybrid", description="引擎: llm/rule/hybrid")
    fallback_on_error: bool = Field(default=True, description="LLM 失败时降级到规则")
    rule_validation: bool = Field(default=True, description="用规则校验 LLM 结果")
    confidence_threshold: float = Field(default=0.7, ge=0.0, le=1.0, description="标签置信度阈值")
    min_authenticity_score: float = Field(default=0.3, ge=0.0, le=1.0, description="最低真实性评分阈值")
    custom_tags_path: Optional[str] = Field(default=None)


class Settings(BaseSettings):
    """应用配置."""
    llm: LLMConfig = Field(default_factory=LLMConfig)
    tagger: TaggerConfig = Field(default_factory=TaggerConfig)

    model_config = SettingsConfigDict(
        env_prefix="TAGGER_",
        env_nested_delimiter="__",
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @classmethod
    def from_yaml(cls, path: str) -> "Settings":
        import yaml
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        return cls(**data)


def load_settings(config_path: Optional[str] = None) -> Settings:
    """加载配置（环境变量优先）."""
    # 显式加载 .env 文件到环境变量
    try:
        from dotenv import load_dotenv
        load_dotenv(ENV_FILE, override=True)
    except ImportError:
        pass

    if config_path and Path(config_path).exists():
        settings = Settings.from_yaml(config_path)
    else:
        settings = Settings()

    # 环境变量覆盖
    if api_key := os.getenv("OPENAI_API_KEY"):
        settings.llm.api_key = api_key
    if base_url := os.getenv("OPENAI_BASE_URL"):
        settings.llm.base_url = base_url
    if model := os.getenv("LLM_MODEL"):
        settings.llm.model = model

    return settings
