"""CLI 测试."""

import pytest
from typer.testing import CliRunner
from review_tagger.cli import app

runner = CliRunner()


class TestInitConfig:
    def test_init_config_default(self, tmp_path):
        output = tmp_path / "config.yaml"
        result = runner.invoke(app, ["init-config", "--output", str(output)])
        assert result.exit_code == 0
        assert output.exists()
        content = output.read_text(encoding="utf-8")
        assert "provider: openai" in content
        assert "api_key:" in content

    def test_init_config_custom_output(self, tmp_path):
        output = tmp_path / "my_config.yaml"
        result = runner.invoke(app, ["init-config", "--output", str(output)])
        assert result.exit_code == 0
        assert output.exists()


class TestTagExcel:
    def test_tag_excel_no_api_key(self, tmp_path, monkeypatch):
        """未设置 API Key 时应报错退出."""
        # mock os.getenv 使 OPENAI_API_KEY 始终返回 None，避免 .env 干扰
        original_getenv = __import__("os").getenv
        def _mock_getenv(key, default=None):
            if key in ("OPENAI_API_KEY", "OPENAI_BASE_URL", "LLM_MODEL"):
                return None
            return original_getenv(key, default)
        monkeypatch.setattr("os.getenv", _mock_getenv)

        reviews = tmp_path / "reviews.csv"
        reviews.write_text("评论内容\n很好\n", encoding="utf-8-sig")
        tags = tmp_path / "tags.csv"
        tags.write_text("一级标签,二级标签,三级标签\n质量,整体,好\n", encoding="utf-8-sig")
        output = tmp_path / "out.csv"

        result = runner.invoke(app, [
            "tag-excel", str(reviews), str(tags), str(output)
        ])
        assert result.exit_code == 1
        assert "未设置 LLM API Key" in result.output


class TestPreviewPrompt:
    def test_preview_prompt(self, tmp_path):
        tags = tmp_path / "tags.csv"
        tags.write_text("一级标签,二级标签,三级标签\n质量,整体,好\n", encoding="utf-8-sig")
        result = runner.invoke(app, [
            "preview-prompt", "质量很好", str(tags)
        ])
        assert result.exit_code == 0
        assert "system" in result.output
        assert "user" in result.output


class TestServe:
    def test_serve_missing_uvicorn(self, monkeypatch):
        """缺少 uvicorn 时应友好提示."""
        import sys
        # 临时移除 uvicorn
        monkeypatch.setitem(sys.modules, "uvicorn", None)
        result = runner.invoke(app, ["serve"])
        assert result.exit_code == 1
        assert "缺少 uvicorn" in result.output
