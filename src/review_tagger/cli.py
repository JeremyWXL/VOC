"""命令行接口 - 最小 MVP."""

import asyncio
import sys
from pathlib import Path
from typing import Optional

import typer
from loguru import logger

from review_tagger.config import load_settings
from review_tagger.core.excel_tagger import ExcelTagger
from review_tagger.core.incremental import IncrementalTagger

app = typer.Typer(help="电商评论 LLM 智能打标工具", rich_markup_mode="rich")


def setup_logging(verbose: bool = False):
    level = "DEBUG" if verbose else "INFO"
    logger.remove()
    logger.add(sys.stderr, level=level, format="<level>{level}</level> | {message}")


@app.command("tag-excel")
def tag_excel(
    review_file: str = typer.Argument(..., help="评论 Excel 文件路径"),
    tag_file: str = typer.Argument(..., help="标签体系 Excel 文件路径"),
    output: str = typer.Argument(..., help="输出 Excel 文件路径"),
    content_column: str = typer.Option("评论内容", "--content-col", "-c", help="评论内容列名"),
    id_column: Optional[str] = typer.Option(None, "--id-col", "-i", help="评论 ID 列名"),
    config: Optional[str] = typer.Option(None, "--config", help="配置文件路径 (YAML)"),
    model: Optional[str] = typer.Option(None, "--model", "-m", help="覆盖模型名称"),
    provider: Optional[str] = typer.Option(None, "--provider", "-p", help="覆盖提供商"),
    output_format: str = typer.Option(
        "wide", "--output-format", "-f", help="输出格式: wide(每评论一行) / long(每标签一行)"
    ),
    previous_output: Optional[str] = typer.Option(
        None, "--previous-output", help="已有结果文件路径（用于增量打标）"
    ),
    strategy: str = typer.Option(
        "skip_existing", "--strategy", help="增量策略: skip_existing / re_tag_all"
    ),
    verbose: bool = typer.Option(False, "--verbose", "-v"),
):
    """对评论 Excel 按标签体系进行 LLM 智能打标，输出带标签字段的 Excel."""
    setup_logging(verbose)

    settings = load_settings(config)
    if model:
        settings.llm.model = model
    if provider:
        settings.llm.provider = provider

    # 检查 API Key
    api_key = settings.llm.api_key
    if api_key is None or (isinstance(api_key, str) and not api_key.strip()):
        typer.echo("[red]错误: 未设置 LLM API Key[/red]")
        typer.echo("请通过以下方式之一设置：")
        typer.echo("  1. 环境变量: export OPENAI_API_KEY=sk-xxx")
        typer.echo("  2. 配置文件: review-tagger init-config --output config.yaml")
        typer.echo("  3. CLI 参数: --config config.yaml")
        raise typer.Exit(1)

    tagger = ExcelTagger(settings)
    if previous_output:
        tagger = IncrementalTagger(settings)

    async def _run():
        if previous_output:
            stats = await tagger.tag_excel_incremental(
                review_path=review_file,
                tag_hierarchy_path=tag_file,
                output_path=output,
                previous_output_path=previous_output,
                content_column=content_column,
                id_column=id_column,
                output_format=output_format,
                strategy=strategy,
            )
            typer.echo("\n[bold green]✅ 增量打标完成[/bold green]")
            typer.echo(
                f"总计: {stats['total']}, 新增: {stats['new']}, "
                f"跳过: {stats['skipped']}, 失败: {stats['failed']}"
            )
        else:
            result_path = await tagger.tag_excel(
                review_path=review_file,
                tag_hierarchy_path=tag_file,
                output_path=output,
                content_column=content_column,
                id_column=id_column,
                output_format=output_format,
            )
            typer.echo(f"\n[bold green]✅ 打标完成: {result_path}[/bold green]")

    asyncio.run(_run())


@app.command("preview-prompt")
def preview_prompt(
    review_text: str = typer.Argument(..., help="单条评论文本"),
    tag_file: str = typer.Argument(..., help="标签体系 Excel 文件路径"),
    config: Optional[str] = typer.Option(None, "--config", help="配置文件路径"),
):
    """预览某条评论的 LLM Prompt（调试用）."""
    settings = load_settings(config)
    tagger = ExcelTagger(settings)
    prompt = tagger.preview_prompt(review_text, tag_file)
    typer.echo(prompt)


@app.command("init-config")
def init_config(output: str = typer.Option("config.yaml", "--output", "-o")):
    """生成示例配置文件."""
    text = """# 电商评论打标工具配置
# 环境变量优先级高于此文件，支持变量：OPENAI_API_KEY, OPENAI_BASE_URL, LLM_MODEL

llm:
  provider: openai          # 可选: openai / deepseek / dashscope
  api_key: ""               # LLM API Key（推荐通过环境变量 OPENAI_API_KEY 设置）
  base_url: null            # 自定义 API 地址（如模型网关）
  model: gpt-4o-mini        # 模型名称
  max_tokens: 1024          # 单次最大输出 token
  temperature: 0.1          # 温度（0.0~2.0，越低越稳定）
  timeout: 60.0             # API 超时（秒）
  max_retries: 3            # 失败重试次数
  concurrency: 5            # 并发请求数
  batch_size: 10            # 每批处理条数
  use_json_mode: true       # 强制模型输出 JSON（降低解析失败率）

tagger:
  engine: llm               # llm / rule / hybrid
  fallback_on_error: true   # LLM 失败时是否降级到规则引擎
  rule_validation: true     # 是否用规则校验 LLM 结果
  confidence_threshold: 0.7 # 标签置信度阈值（低于此值的标签会被过滤）
  min_authenticity_score: 0.3  # 最低真实性评分（低于此值标记为虚假评论）
  custom_tags_path: null    # 自定义标签体系文件路径
"""
    Path(output).write_text(text, encoding="utf-8")
    typer.echo(f"[green]配置文件已生成: {output}[/green]")
    typer.echo("[dim]提示: 编辑文件填入 api_key，或通过环境变量 OPENAI_API_KEY 设置[/dim]")


@app.command("serve")
def serve(
    host: str = typer.Option("0.0.0.0", "--host", "-h", help="监听地址"),
    port: int = typer.Option(8000, "--port", "-p", help="监听端口"),
    reload: bool = typer.Option(False, "--reload", "-r", help="开发模式自动重载"),
):
    """启动 Web 打标工作台（FastAPI + 前端页面）."""
    try:
        import uvicorn
    except ImportError:
        typer.echo("[red]错误: 缺少 uvicorn，请运行 pip install uvicorn[/red]")
        raise typer.Exit(1)

    typer.echo(f"[green]启动 Web 工作台: http://{host}:{port}/[/green]")
    typer.echo("[dim]按 Ctrl+C 停止服务[/dim]")
    uvicorn.run("review_tagger.api.main:app", host=host, port=port, reload=reload)


def main():
    app()


if __name__ == "__main__":
    main()
