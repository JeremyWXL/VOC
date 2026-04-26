"""任务状态管理（内存存储）."""

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, List, Any


@dataclass
class TaskInfo:
    task_id: str
    status: str = "pending"  # pending / running / completed / failed
    message: str = ""
    progress_done: int = 0
    progress_total: int = 0
    output_path: Optional[str] = None
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    result_preview: Optional[List[Dict[str, Any]]] = None
    output_format: str = "wide"
    review_columns: Optional[List[str]] = None


_tasks: Dict[str, TaskInfo] = {}


def create_task() -> str:
    task_id = str(uuid.uuid4())[:8]
    _tasks[task_id] = TaskInfo(task_id=task_id)
    return task_id


def get_task(task_id: str) -> Optional[TaskInfo]:
    return _tasks.get(task_id)


def update_task(task_id: str, **kwargs) -> None:
    if task_id in _tasks:
        for k, v in kwargs.items():
            setattr(_tasks[task_id], k, v)


def cleanup_task(task_id: str) -> None:
    task = _tasks.pop(task_id, None)
    if task and task.output_path:
        p = Path(task.output_path)
        if p.exists():
            p.unlink()
