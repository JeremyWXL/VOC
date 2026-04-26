"""FastAPI 应用入口."""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from review_tagger.api.routes import router
import review_tagger.db.store as db_store

app = FastAPI(
    title="VOC智能分析引擎",
    version="0.2.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent

# 挂载静态文件目录
configs_dir = PROJECT_ROOT / "configs"
if configs_dir.exists():
    app.mount("/configs", StaticFiles(directory=str(configs_dir)), name="configs")

data_dir = PROJECT_ROOT / "data"
if data_dir.exists():
    app.mount("/data", StaticFiles(directory=str(data_dir)), name="data")

static_dir = PROJECT_ROOT / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# 标签库管理React应用 (构建产物在 static/taglib/)
taglib_dir = PROJECT_ROOT / "static" / "taglib"
if taglib_dir.exists():
    # 静态资源 (JS/CSS)
    app.mount("/tag-library/assets", StaticFiles(directory=str(taglib_dir / "assets")), name="taglib_assets")

    @app.get("/tag-library")
    @app.get("/tag-library/{path:path}")
    async def tag_library_app(path: str = ""):
        """返回标签库React应用，支持React Router history模式."""
        return FileResponse(str(taglib_dir / "index.html"))


@app.get("/")
async def root():
    workbench = PROJECT_ROOT / "app_tag_workbench.html"
    if workbench.exists():
        return FileResponse(workbench)
    return {"message": "VOC智能分析引擎 API 服务运行中，请打开 app_tag_workbench.html"}


@app.get("/config-editor")
async def config_editor():
    editor = PROJECT_ROOT / "app_tag_config.html"
    if editor.exists():
        return FileResponse(editor)
    raise HTTPException(status_code=404, detail="标签配置编辑器未找到")


@app.get("/app_tag_config.html")
async def tag_config_html():
    editor = PROJECT_ROOT / "app_tag_config.html"
    if editor.exists():
        return FileResponse(editor)
    raise HTTPException(status_code=404, detail="标签配置编辑器未找到")


# 启动时迁移预置标签
try:
    db_store.migrate_presets(PROJECT_ROOT / "configs")
except Exception:
    pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
