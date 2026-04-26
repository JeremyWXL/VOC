"""API 路由."""

import asyncio
import json
import shutil
import tempfile
from pathlib import Path
from datetime import datetime
import pandas as pd
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from loguru import logger

from review_tagger.api.tasks import create_task, get_task, update_task, cleanup_task
from review_tagger.config import Settings
from review_tagger.models import TagSystem, TagSystemCreate
from review_tagger.core.excel_tagger import ExcelTagger
from review_tagger.core.incremental import IncrementalTagger
from review_tagger.loaders import (
    load_reviews_from_excel,
    load_tag_hierarchy,
    format_tag_tree,
    _read_file,
    save_tagged_excel,
)
import review_tagger.db.store as db_store

router = APIRouter()

TEMP_DIR = Path(tempfile.gettempdir()) / "review_tagger"
TEMP_DIR.mkdir(exist_ok=True)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent


@router.get("/download-file")
async def download_file(file_id: str):
    """读取已上传文件的内容（文本）."""
    path = Path(file_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")
    try:
        content = path.read_text(encoding='utf-8-sig')
        return StreamingResponse(
            iter([content.encode('utf-8')]),
            media_type="text/csv; charset=utf-8",
        )
    except UnicodeDecodeError:
        # 二进制文件（如 xlsx），尝试用 pandas 读取后转 CSV
        try:
            df = _read_file(str(path))
            import io
            output = io.StringIO()
            df.to_csv(output, index=False, encoding='utf-8')
            content = output.getvalue()
            return StreamingResponse(
                iter([content.encode('utf-8')]),
                media_type="text/csv; charset=utf-8",
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"无法读取文件: {e}")


@router.get("/preset-tags")
async def list_preset_tags():
    """列出预置标签体系（从数据库查询）."""
    items = db_store.list_tag_systems(preset_only=True)
    presets = []
    for row in items:
        presets.append({
            "category": "configs",
            "name": row["name"] + ".csv",
            "path": f"__tag_system__:{row['id']}",
            "columns": ["一级标签", "二级标签", "三级标签", "四级标签"],
            "row_count": row["csv_content"].count("\n") - 1 if row["csv_content"] else 0,
            "tag_system_id": row["id"],
        })
    return {"presets": presets}


# ---------------------------------------------------------------------------
# Tag System Management
# ---------------------------------------------------------------------------

@router.get("/tag-systems")
async def list_tag_systems(scene: Optional[str] = None, preset: Optional[bool] = None):
    """列出所有标签体系."""
    items = db_store.list_tag_systems(
        preset_only=preset if preset is not None else False,
        scene_type=scene,
    )
    return {"items": items, "total": len(items)}


@router.post("/tag-systems")
async def create_tag_system(payload: TagSystemCreate):
    """创建新标签体系."""
    sid = db_store.create_tag_system(
        name=payload.name,
        csv_content=payload.csv_content,
        scene_type=payload.scene_type,
        description=payload.description,
    )
    ts = db_store.get_tag_system(sid)
    return ts


@router.get("/tag-systems/{sid}")
async def get_tag_system(sid: str):
    """获取标签体系详情."""
    ts = db_store.get_tag_system(sid)
    if not ts:
        raise HTTPException(status_code=404, detail="标签体系不存在")
    return ts


@router.put("/tag-systems/{sid}")
async def update_tag_system(sid: str, payload: TagSystemCreate):
    """更新标签体系."""
    existing = db_store.get_tag_system(sid)
    if not existing:
        raise HTTPException(status_code=404, detail="标签体系不存在")
    db_store.update_tag_system(
        sid,
        name=payload.name,
        scene_type=payload.scene_type,
        description=payload.description,
        csv_content=payload.csv_content,
    )
    return db_store.get_tag_system(sid)


@router.delete("/tag-systems/{sid}")
async def delete_tag_system(sid: str):
    """删除标签体系."""
    try:
        db_store.delete_tag_system(sid)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"success": True}


@router.post("/tag-systems/{sid}/copy")
async def copy_tag_system(sid: str):
    """复制标签体系."""
    try:
        new_sid = db_store.copy_tag_system(sid)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return db_store.get_tag_system(new_sid)


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """上传 Excel/CSV 文件，返回列名和预览."""
    suffix = Path(file.filename).suffix
    file_id = tempfile.mktemp(suffix=suffix, dir=TEMP_DIR)
    path = Path(file_id)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        df = _read_file(str(path))
        columns = list(df.columns)
        preview = df.head(5).fillna("").astype(str).to_dict(orient="records")
        row_count = len(df)
    except Exception as e:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"无法读取文件: {e}")

    return {
        "file_id": str(path),
        "filename": file.filename,
        "columns": columns,
        "preview": preview,
        "row_count": row_count,
    }


@router.post("/preview-prompt")
async def preview_prompt(
    review_text: str = Form(...),
    tag_file_id: Optional[str] = Form(None),
    tag_system_id: Optional[str] = Form(None),
    provider: str = Form("openai"),
    model: str = Form("gpt-4o-mini"),
):
    """预览某条评论的 LLM Prompt."""
    settings = Settings()
    settings.llm.provider = provider
    settings.llm.model = model
    tagger = ExcelTagger(settings)
    prompt = tagger.preview_prompt(review_text, tag_file_id)
    return {"prompt": prompt}


@router.post("/tag")
async def start_tagging(
    background_tasks: BackgroundTasks,
    review_file_id: str = Form(...),
    tag_file_id: str = Form(...),
    content_column: str = Form("评论内容"),
    id_column: Optional[str] = Form(None),
    output_format: str = Form("wide"),
    provider: str = Form("openai"),
    model: str = Form("gpt-4o-mini"),
    api_key: str = Form(...),
    base_url: Optional[str] = Form(None),
    concurrency: int = Form(5),
    batch_size: int = Form(10),
    use_json_mode: bool = Form(True),
    confidence_threshold: float = Form(0.7),
    previous_output_path: Optional[str] = Form(None),
    strategy: str = Form("skip_existing"),
    sharding_enabled: bool = Form(False),
    shard_size: int = Form(200),
    max_shards: int = Form(10),
):
    """启动打标任务."""
    if not tag_file_id and not tag_system_id:
        raise HTTPException(status_code=400, detail="tag_file_id 或 tag_system_id 至少提供一个")
    
    # 如果提供了 tag_system_id，将 CSV 内容写入临时文件
    actual_tag_file_id = tag_file_id
    if tag_system_id:
        ts = db_store.get_tag_system(tag_system_id)
        if not ts:
            raise HTTPException(status_code=404, detail="标签体系不存在")
        temp_path = TEMP_DIR / f"ts_{tag_system_id}_{datetime.now().timestamp()}.csv"
        temp_path.write_text(ts["csv_content"], encoding="utf-8")
        actual_tag_file_id = str(temp_path)

    task_id = create_task()
    output_path = str(TEMP_DIR / f"{task_id}_output.csv")

    settings = Settings()
    settings.llm.provider = provider
    settings.llm.model = model
    settings.llm.api_key = api_key
    settings.llm.base_url = base_url or None
    settings.llm.concurrency = concurrency
    settings.llm.batch_size = batch_size
    settings.llm.use_json_mode = use_json_mode
    settings.tagger.confidence_threshold = confidence_threshold

    update_task(
        task_id,
        status="running",
        output_path=output_path,
        output_format=output_format,
    )

    background_tasks.add_task(
        _run_tagging,
        task_id,
        settings,
        review_file_id,
        actual_tag_file_id,
        content_column,
        id_column,
        output_path,
        output_format,
        previous_output_path,
        strategy,
        sharding_enabled,
        shard_size,
        max_shards,
    )

    return {"task_id": task_id}


async def _run_tagging(
    task_id: str,
    settings: Settings,
    review_file_id: str,
    tag_file_id: str,
    content_column: str,
    id_column: Optional[str],
    output_path: str,
    output_format: str,
    previous_output_path: Optional[str] = None,
    strategy: str = "skip_existing",
    sharding_enabled: bool = False,
    shard_size: int = 200,
    max_shards: int = 10,
) -> None:
    """后台执行打标."""
    try:
        reviews, df = load_reviews_from_excel(
            review_file_id, content_column=content_column, id_column=id_column
        )
        tag_tree = load_tag_hierarchy(tag_file_id)
        tag_tree_text = format_tag_tree(tag_tree)

        db_store.create_task(
            task_id,
            status="running",
            review_file_path=review_file_id,
            tag_file_path=tag_file_id,
            content_column=content_column,
            id_column=id_column,
            output_format=output_format,
            provider=settings.llm.provider,
            model=settings.llm.model,
            output_path=output_path,
        )
        review_id_map = db_store.save_reviews(task_id, reviews)

        update_task(task_id, progress_total=len(reviews), review_columns=list(df.columns))

        def progress_cb(done: int, total: int) -> None:
            update_task(task_id, progress_done=done, progress_total=total)

        if previous_output_path and Path(previous_output_path).exists():
            tagger = IncrementalTagger(settings, progress_callback=progress_cb)
            stats = await tagger.tag_excel_incremental(
                review_path=review_file_id,
                tag_hierarchy_path=tag_file_id,
                output_path=output_path,
                previous_output_path=previous_output_path,
                content_column=content_column,
                id_column=id_column,
                output_format=output_format,
                strategy=strategy,
            )
            results = stats.get("results", [])
        else:
            tagger = ExcelTagger(settings, progress_callback=progress_cb)
            results = await tagger._tag_reviews(
                reviews,
                tag_tree_text,
                progress_callback=progress_cb,
                sharding_enabled=sharding_enabled,
                shard_size=shard_size,
                max_shards=max_shards,
            )
            save_tagged_excel(
                df,
                results,
                output_path,
                review_id_column=id_column,
                output_format=output_format,
            )

        for res in results:
            rid = res.get("review_id", "")
            db_id = review_id_map.get(rid)
            if db_id:
                db_store.save_tags(db_id, res.get("matches", []))
                status = "tagged" if not res.get("error") else "pending"
                db_store.update_review_status(db_id, status)

        result_df = _read_file(output_path)
        preview = result_df.head(10).fillna("").astype(str).to_dict(orient="records")

        db_store.update_task(
            task_id,
            status="completed",
            completed_at=datetime.now().isoformat(),
        )
        update_task(
            task_id,
            status="completed",
            message="打标完成",
            result_preview=preview,
            progress_done=len(reviews),
        )
    except Exception as e:
        import traceback

        db_store.update_task(
            task_id,
            status="failed",
            error=str(e),
            completed_at=datetime.now().isoformat(),
        )
        update_task(task_id, status="failed", error=f"{e}\n{traceback.format_exc()}")


# ====== 场景识别与标签自动生成 API ======

from review_tagger.core.scene_detector import SceneDetector, SceneType, SceneDetectionResult
from review_tagger.core.tag_generator import TagGenerator, TagGenerationResult


@router.get("/scenes")
async def list_scenes():
    """获取所有预定义场景列表."""
    scenes = []
    for scene in SceneType:
        scenes.append({
            "scene_type": scene.value,
            "display_name": SceneType.display_name(scene),
        })
    return {"scenes": scenes}


@router.post("/detect-scene")
async def detect_scene(
    review_file_id: str = Form(...),
    content_column: str = Form("评论内容"),
    sample_size: int = Form(20),
):
    """根据评论样本识别业务场景.

    返回识别出的场景类型、置信度和描述。
    """
    try:
        df = _read_file(review_file_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无法读取评论文件: {e}")

    if content_column not in df.columns:
        raise HTTPException(status_code=400, detail=f"列不存在: {content_column}")

    reviews = df[content_column].dropna().astype(str).tolist()
    if not reviews:
        raise HTTPException(status_code=400, detail="评论文件中没有有效评论内容")

    detector = SceneDetector()
    try:
        result: SceneDetectionResult = await detector.detect(
            reviews, sample_size=sample_size, use_llm=True
        )
        return {
            "scene_type": result.scene_type.value,
            "display_name": SceneType.display_name(result.scene_type),
            "confidence": result.confidence,
            "description": result.description,
            "keywords": result.keywords,
            "is_fallback": result.is_fallback,
            "sample_count": min(len(reviews), sample_size),
        }
    except Exception as e:
        logger.error(f"场景识别失败: {e}")
        raise HTTPException(status_code=500, detail=f"场景识别失败: {e}")


class GenerateTagsPayload(BaseModel):
    scene_type: str
    review_file_id: Optional[str] = None
    content_column: str = "评论内容"
    use_template: bool = True
    save_as_system: bool = False
    name: Optional[str] = None


@router.post("/generate-tags")
async def generate_tags(payload: GenerateTagsPayload):
    """根据场景生成标签体系 CSV.

    优先使用预定义模板；如果场景无模板且提供了评论样本，则使用 LLM 动态生成。
    """
    try:
        scene = SceneType(payload.scene_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"未知的场景类型: {payload.scene_type}")

    sample_reviews = None
    if payload.review_file_id:
        try:
            df = _read_file(payload.review_file_id)
            if payload.content_column in df.columns:
                sample_reviews = df[payload.content_column].dropna().astype(str).tolist()
        except Exception:
            pass

    generator = TagGenerator()
    try:
        result: TagGenerationResult = await generator.generate_async(
            scene_type=scene,
            sample_reviews=sample_reviews,
            use_template=payload.use_template,
        )
        response = {
            "scene_type": result.scene_type.value,
            "display_name": SceneType.display_name(result.scene_type),
            "csv_content": result.csv_content,
            "tag_count": result.tag_count,
            "level1_count": result.level1_count,
            "is_template": result.is_template,
        }
        if payload.save_as_system:
            name = payload.name or f"{SceneType.display_name(result.scene_type)} 标签体系"
            sid = db_store.create_tag_system(
                name=name,
                csv_content=result.csv_content,
                scene_type=result.scene_type.value,
            )
            response["tag_system_id"] = sid
        return response
    except Exception as e:
        logger.error(f"标签生成失败: {e}")
        raise HTTPException(status_code=500, detail=f"标签生成失败: {e}")


@router.get("/tasks/{task_id}")
async def task_status(task_id: str):
    """查询任务状态."""
    task = get_task(task_id)
    db_task = db_store.get_task(task_id)
    if not task and not db_task:
        raise HTTPException(status_code=404, detail="任务不存在")
    result = {
        "task_id": task.task_id if task else db_task["id"],
        "status": task.status if task else db_task.get("status"),
        "message": task.message if task else "",
        "progress_done": task.progress_done if task else 0,
        "progress_total": task.progress_total if task else 0,
        "error": task.error if task else db_task.get("error"),
        "result_preview": task.result_preview if task else None,
        "output_format": task.output_format if task else db_task.get("output_format"),
    }
    if db_task:
        result["tag_file_path"] = db_task.get("tag_file_path")
        result["review_file_path"] = db_task.get("review_file_path")
    return result


@router.get("/tasks/{task_id}/events")
async def task_events(task_id: str):
    """SSE 实时推送任务进度."""
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    async def event_generator():
        while True:
            await asyncio.sleep(0.5)
            task = get_task(task_id)
            if not task:
                payload = {"type": "error", "message": "任务不存在"}
                yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
                break

            payload = {
                "type": "progress",
                "done": task.progress_done,
                "total": task.progress_total,
                "status": task.status,
            }
            yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

            if task.status in ("completed", "failed"):
                end_payload = {
                    "type": "end",
                    "status": task.status,
                    "error": task.error,
                    "preview": task.result_preview,
                }
                yield f"data: {json.dumps(end_payload, ensure_ascii=False)}\n\n"
                break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.get("/download/{task_id}")
async def download_result(task_id: str):
    """下载打标结果."""
    task = get_task(task_id)
    if not task or not task.output_path:
        raise HTTPException(status_code=404, detail="任务或结果不存在")

    path = Path(task.output_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="结果文件已删除")

    ext = path.suffix.lower()
    if ext == ".csv":
        media_type = "text/csv; charset=utf-8-sig"
    else:
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    return FileResponse(
        path,
        media_type=media_type,
        filename=f"tagged_reviews{ext}",
    )


@router.get("/tasks/{task_id}/reviews")
async def list_task_reviews(
    task_id: str,
    page: int = 1,
    page_size: int = 20,
    level1: Optional[str] = None,
):
    """获取某任务的所有评论及标签（支持分页、按一级标签筛选）."""
    task = db_store.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if level1:
        reviews = db_store.get_reviews_by_task_and_tag(task_id, level1)
    else:
        reviews = db_store.get_reviews_by_task(task_id)

    total = len(reviews)
    start = (page - 1) * page_size
    end = start + page_size
    page_reviews = reviews[start:end]

    for rev in page_reviews:
        rev["tags"] = db_store.get_tags_by_review(rev["id"])

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "level1_filter": level1,
        "reviews": page_reviews,
    }


class TagUpdate(BaseModel):
    """人工修正标签请求体."""

    level1: str = ""
    level2: str = ""
    level3: str = ""
    level4: str = ""
    confidence: float = 1.0
    reason: str = ""


@router.post("/tasks/{task_id}/reviews/{review_db_id}/tags")
async def update_review_tags(task_id: str, review_db_id: int, tags: List[TagUpdate]):
    """人工修正某条评论的标签."""
    task = db_store.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    tag_dicts = []
    for t in tags:
        d = t.model_dump()
        d["is_manual"] = True
        tag_dicts.append(d)

    db_store.clear_tags(review_db_id)
    db_store.save_tags(review_db_id, tag_dicts)
    db_store.update_review_status(review_db_id, "reviewed")
    return {"message": "标签已更新"}


@router.get("/tag-hierarchy")
async def get_tag_hierarchy(file_id: str):
    """从标签体系文件获取层级结构."""
    try:
        df = _read_file(file_id)
        tree: Dict[str, Any] = {}
        has_l4 = "四级标签" in df.columns
        for _, row in df.iterrows():
            l1 = str(row["一级标签"]).strip() if pd.notna(row["一级标签"]) else ""
            l2 = str(row["二级标签"]).strip() if pd.notna(row["二级标签"]) else ""
            l3 = str(row["三级标签"]).strip() if pd.notna(row["三级标签"]) else ""
            l4 = str(row["四级标签"]).strip() if has_l4 and pd.notna(row["四级标签"]) else ""
            if not l1 or not l2 or not l3:
                continue
            if l1 not in tree:
                tree[l1] = {}
            if l2 not in tree[l1]:
                tree[l1][l2] = {}
            if l3 not in tree[l1][l2]:
                tree[l1][l2][l3] = []
            if l4 and l4 not in tree[l1][l2][l3]:
                tree[l1][l2][l3].append(l4)
        return {"hierarchy": tree}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无法读取标签体系: {e}")


@router.get("/tasks")
async def list_tasks():
    """获取任务列表."""
    tasks = db_store.list_tasks()
    # 补充每个任务的评论统计
    for t in tasks:
        stats = db_store.get_task_stats(t["id"])
        t["total_reviews"] = stats["total_reviews"]
        t["tagged_reviews"] = stats["tagged_reviews"]
        t["uncertain_count"] = len(stats["uncertain_reviews"])
        t["rejected_count"] = len(stats["rejected_reviews"])
    return {"tasks": tasks}


@router.get("/tasks/{task_id}/stats")
async def task_stats(task_id: str):
    """获取任务统计信息."""
    task = db_store.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return db_store.get_task_stats(task_id)


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    """清理任务及临时文件."""
    cleanup_task(task_id)
    return {"message": "已清理"}


# ====== 多维度标签体系映射 API ======

from review_tagger.core.tag_mapping import (
    TagMappingConfig,
    TagProfile,
    TagMappingRule,
    Condition,
    Operator,
)
from review_tagger.core.multi_tagger import MultiTagger

# 内存中暂存映射配置（按临时 key）
_mapping_configs: Dict[str, TagMappingConfig] = {}


@router.post("/tag-profiles")
async def upload_tag_profile(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str = Form(""),
):
    """上传单个标签体系文件作为标签方案."""
    suffix = Path(file.filename).suffix
    file_id = tempfile.mktemp(suffix=suffix, dir=TEMP_DIR)
    path = Path(file_id)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        df = _read_file(str(path))
        columns = list(df.columns)
        row_count = len(df)
    except Exception as e:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"无法读取文件: {e}")

    profile_id = f"profile_{path.stem}_{datetime.now().strftime('%H%M%S')}"
    profile = TagProfile(
        id=profile_id,
        name=name,
        description=description,
        file_path=str(path),
    )
    return {
        "profile_id": profile_id,
        "name": name,
        "file_path": str(path),
        "columns": columns,
        "row_count": row_count,
    }


class MappingConfigPayload(BaseModel):
    profiles: List[Dict[str, Any]]
    rules: List[Dict[str, Any]]
    default_profile_id: Optional[str] = None


@router.post("/tag-mapping-config")
async def save_mapping_config(payload: MappingConfigPayload):
    """保存标签映射配置，返回 config_key."""
    config_key = f"mapping_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{id(payload) % 10000}"
    try:
        config = TagMappingConfig.from_dict(payload.model_dump())
        _mapping_configs[config_key] = config
        return {"config_key": config_key, "profiles_count": len(config.profiles), "rules_count": len(config.rules)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"配置格式错误: {e}")


@router.post("/tag-mapping-preview")
async def preview_mapping(
    review_file_id: str = Form(...),
    config_key: str = Form(...),
):
    """预览映射结果：查看每条评论匹配到什么标签方案."""
    config = _mapping_configs.get(config_key)
    if not config:
        raise HTTPException(status_code=404, detail="映射配置不存在或已过期")

    try:
        df = _read_file(review_file_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无法读取评论文件: {e}")

    preview = []
    for _, row in df.head(50).iterrows():  # 最多预览50条
        row_dict = row.to_dict()
        profile = config.resolve(row_dict)
        preview.append({
            "row_data": {k: str(v) for k, v in row_dict.items()},
            "matched_profile_id": profile.id if profile else None,
            "matched_profile_name": profile.name if profile else None,
        })

    return {"preview": preview}


@router.post("/tag-multi")
async def start_multi_tagging(
    background_tasks: BackgroundTasks,
    review_file_id: str = Form(...),
    config_key: str = Form(...),
    content_column: str = Form("评论内容"),
    id_column: Optional[str] = Form(None),
    output_format: str = Form("wide"),
    provider: str = Form("openai"),
    model: str = Form("gpt-4o-mini"),
    api_key: str = Form(...),
    base_url: Optional[str] = Form(None),
    concurrency: int = Form(5),
    batch_size: int = Form(10),
    use_json_mode: bool = Form(True),
    confidence_threshold: float = Form(0.7),
    sharding_enabled: bool = Form(False),
    shard_size: int = Form(200),
    max_shards: int = Form(10),
):
    """启动多标签体系映射打标任务."""
    config = _mapping_configs.get(config_key)
    if not config:
        raise HTTPException(status_code=404, detail="映射配置不存在或已过期，请重新保存配置")

    task_id = create_task()
    output_path = str(TEMP_DIR / f"{task_id}_output.csv")

    settings = Settings()
    settings.llm.provider = provider
    settings.llm.model = model
    settings.llm.api_key = api_key
    settings.llm.base_url = base_url or None
    settings.llm.concurrency = concurrency
    settings.llm.batch_size = batch_size
    settings.llm.use_json_mode = use_json_mode
    settings.tagger.confidence_threshold = confidence_threshold

    update_task(
        task_id,
        status="running",
        output_path=output_path,
        output_format=output_format,
    )

    background_tasks.add_task(
        _run_multi_tagging,
        task_id,
        settings,
        review_file_id,
        config,
        content_column,
        id_column,
        output_path,
        output_format,
        sharding_enabled,
        shard_size,
        max_shards,
    )

    return {"task_id": task_id}


async def _run_multi_tagging(
    task_id: str,
    settings: Settings,
    review_file_id: str,
    mapping_config: TagMappingConfig,
    content_column: str,
    id_column: Optional[str],
    output_path: str,
    output_format: str,
    sharding_enabled: bool = False,
    shard_size: int = 200,
    max_shards: int = 10,
) -> None:
    """后台执行多标签体系打标."""
    try:
        reviews, df = load_reviews_from_excel(
            review_file_id, content_column=content_column, id_column=id_column
        )

        db_store.create_task(
            task_id,
            status="running",
            review_file_path=review_file_id,
            tag_file_path="multi_mapping_config",
            content_column=content_column,
            id_column=id_column,
            output_format=output_format,
            provider=settings.llm.provider,
            model=settings.llm.model,
            output_path=output_path,
        )
        review_id_map = db_store.save_reviews(task_id, reviews)
        update_task(task_id, progress_total=len(reviews), review_columns=list(df.columns))

        def progress_cb(done: int, total: int) -> None:
            update_task(task_id, progress_done=done, progress_total=total)

        tagger = MultiTagger(mapping_config, settings, progress_callback=progress_cb)
        results = await tagger._tag_reviews(
            reviews,
            "",
            sharding_enabled=sharding_enabled,
            shard_size=shard_size,
            max_shards=max_shards,
        )

        save_tagged_excel(
            df,
            results,
            output_path,
            review_id_column=id_column,
            output_format=output_format,
        )

        for res in results:
            rid = res.get("review_id", "")
            db_id = review_id_map.get(rid)
            if db_id:
                db_store.save_tags(db_id, res.get("matches", []))
                status = "tagged" if not res.get("error") else "pending"
                db_store.update_review_status(db_id, status)

        result_df = _read_file(output_path)
        preview = result_df.head(10).fillna("").astype(str).to_dict(orient="records")

        db_store.update_task(
            task_id,
            status="completed",
            completed_at=datetime.now().isoformat(),
        )
        update_task(
            task_id,
            status="completed",
            message="多标签体系打标完成",
            result_preview=preview,
            progress_done=len(reviews),
        )
    except Exception as e:
        import traceback
        db_store.update_task(
            task_id,
            status="failed",
            error=str(e),
            completed_at=datetime.now().isoformat(),
        )
        update_task(task_id, status="failed", error=f"{e}\n{traceback.format_exc()}")
