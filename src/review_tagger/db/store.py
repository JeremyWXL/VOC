"""SQLite 数据层封装 — 最小可行实现."""

import hashlib
import sqlite3
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from review_tagger.models import Review

DEFAULT_DB_PATH = Path(tempfile.gettempdir()) / "review_tagger" / "review_tagger.db"


class Store:
    """SQLite 存储封装."""

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = str(db_path or DEFAULT_DB_PATH)
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)

    def _conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self) -> None:
        """创建表和索引."""
        ddl = """
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            status TEXT,
            review_file_path TEXT,
            tag_file_path TEXT,
            content_column TEXT,
            id_column TEXT,
            output_format TEXT,
            provider TEXT,
            model TEXT,
            created_at TEXT,
            completed_at TEXT,
            error TEXT,
            output_path TEXT
        );
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT,
            review_id TEXT,
            content TEXT,
            content_hash TEXT,
            status TEXT,
            uncertain INTEGER,
            authenticity_score REAL
        );
        CREATE TABLE IF NOT EXISTS tag_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            review_db_id INTEGER,
            level1 TEXT,
            level2 TEXT,
            level3 TEXT,
            level4 TEXT,
            confidence REAL,
            reason TEXT,
            is_manual INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_reviews_task ON reviews(task_id);
        CREATE INDEX IF NOT EXISTS idx_reviews_hash ON reviews(task_id, content_hash);
        CREATE INDEX IF NOT EXISTS idx_tags_review ON tag_records(review_db_id);

        CREATE TABLE IF NOT EXISTS tag_systems (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            scene_type TEXT,
            description TEXT,
            csv_content TEXT NOT NULL,
            is_preset INTEGER DEFAULT 0,
            created_at TEXT,
            updated_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_tag_systems_preset ON tag_systems(is_preset);
        CREATE INDEX IF NOT EXISTS idx_tag_systems_scene ON tag_systems(scene_type);
        """
        with self._conn() as conn:
            conn.executescript(ddl)
            conn.commit()

    def create_task(self, task_id: str, **kwargs) -> None:
        """创建任务记录."""
        now = datetime.now().isoformat()
        status = kwargs.get("status", "pending")
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO tasks (id, status, created_at) VALUES (?, ?, ?)",
                (task_id, status, now),
            )
            allowed = {
                "status",
                "review_file_path",
                "tag_file_path",
                "content_column",
                "id_column",
                "output_format",
                "provider",
                "model",
                "completed_at",
                "error",
                "output_path",
            }
            updates = {k: v for k, v in kwargs.items() if k in allowed}
            if updates:
                cols = ", ".join(f"{k} = ?" for k in updates)
                vals = list(updates.values()) + [task_id]
                conn.execute(f"UPDATE tasks SET {cols} WHERE id = ?", vals)
            conn.commit()

    def update_task(self, task_id: str, **kwargs) -> None:
        """更新任务字段."""
        allowed = {
            "status",
            "review_file_path",
            "tag_file_path",
            "content_column",
            "id_column",
            "output_format",
            "provider",
            "model",
            "completed_at",
            "error",
            "output_path",
        }
        updates = {k: v for k, v in kwargs.items() if k in allowed}
        if not updates:
            return
        cols = ", ".join(f"{k} = ?" for k in updates)
        vals = list(updates.values()) + [task_id]
        with self._conn() as conn:
            conn.execute(f"UPDATE tasks SET {cols} WHERE id = ?", vals)
            conn.commit()

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取任务详情."""
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
            return dict(row) if row else None

    def save_reviews(self, task_id: str, reviews: List[Review]) -> Dict[str, int]:
        """批量保存评论并返回 review_id -> db_id 映射."""
        id_map: Dict[str, int] = {}
        with self._conn() as conn:
            for r in reviews:
                content = (r.content or "").strip()
                content_hash = hashlib.md5(content.encode("utf-8")).hexdigest()
                cur = conn.execute(
                    """
                    INSERT INTO reviews (task_id, review_id, content, content_hash, status)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (task_id, r.id or "", content, content_hash, "pending"),
                )
                id_map[r.id or ""] = cur.lastrowid
            conn.commit()
        return id_map

    def get_reviews_by_task(self, task_id: str) -> List[Dict[str, Any]]:
        """获取某任务下所有评论."""
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM reviews WHERE task_id = ? ORDER BY id", (task_id,)
            ).fetchall()
            return [dict(r) for r in rows]

    def get_reviews_by_task_and_tag(
        self, task_id: str, level1: str
    ) -> List[Dict[str, Any]]:
        """获取某任务下包含指定一级标签的评论."""
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT DISTINCT r.*
                FROM reviews r
                JOIN tag_records t ON r.id = t.review_db_id
                WHERE r.task_id = ? AND t.level1 = ?
                ORDER BY r.id
                """,
                (task_id, level1),
            ).fetchall()
            return [dict(r) for r in rows]

    def find_existing_review(self, task_id: str, content_hash: str) -> Optional[Dict[str, Any]]:
        """通过 content_hash 查找已有评论."""
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM reviews WHERE task_id = ? AND content_hash = ?",
                (task_id, content_hash),
            ).fetchone()
            return dict(row) if row else None

    def save_tags(self, review_db_id: int, tags: List[Dict[str, Any]]) -> None:
        """保存标签记录."""
        if not tags:
            return
        rows = []
        for t in tags:
            rows.append(
                (
                    review_db_id,
                    t.get("level1", ""),
                    t.get("level2", ""),
                    t.get("level3", ""),
                    t.get("level4", ""),
                    t.get("confidence", 1.0),
                    t.get("reason", ""),
                    1 if t.get("is_manual") else 0,
                )
            )
        with self._conn() as conn:
            conn.executemany(
                """
                INSERT INTO tag_records
                (review_db_id, level1, level2, level3, level4, confidence, reason, is_manual)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows,
            )
            conn.commit()

    def clear_tags(self, review_db_id: int) -> None:
        """清空某评论的所有标签."""
        with self._conn() as conn:
            conn.execute("DELETE FROM tag_records WHERE review_db_id = ?", (review_db_id,))
            conn.commit()

    def get_tags_by_review(self, review_db_id: int) -> List[Dict[str, Any]]:
        """获取某评论的标签列表."""
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM tag_records WHERE review_db_id = ? ORDER BY id",
                (review_db_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    def update_review_status(
        self,
        review_db_id: int,
        status: str,
        uncertain: Optional[int] = None,
        authenticity_score: Optional[float] = None,
    ) -> None:
        """更新评论状态."""
        fields = ["status = ?"]
        params: List[Any] = [status]
        if uncertain is not None:
            fields.append("uncertain = ?")
            params.append(uncertain)
        if authenticity_score is not None:
            fields.append("authenticity_score = ?")
            params.append(authenticity_score)
        params.append(review_db_id)
        with self._conn() as conn:
            conn.execute(f"UPDATE reviews SET {', '.join(fields)} WHERE id = ?", params)
            conn.commit()

    def export_task_results(
        self, task_id: str, output_format: str = "wide"
    ) -> List[Dict[str, Any]]:
        """导出任务结果为 DataFrame 兼容的 dict list."""
        reviews = self.get_reviews_by_task(task_id)
        results: List[Dict[str, Any]] = []
        for rev in reviews:
            tags = self.get_tags_by_review(rev["id"])
            row: Dict[str, Any] = {
                "review_db_id": rev["id"],
                "review_id": rev["review_id"],
                "content": rev["content"],
                "status": rev["status"],
                "uncertain": bool(rev["uncertain"]) if rev["uncertain"] is not None else None,
                "authenticity_score": rev["authenticity_score"],
            }
            if output_format == "long":
                if not tags:
                    row.update(
                        {
                            "level1": "",
                            "level2": "",
                            "level3": "",
                            "level4": "",
                            "confidence": "",
                            "reason": "",
                            "is_manual": "",
                        }
                    )
                    results.append(row)
                else:
                    for t in tags:
                        tag_row = row.copy()
                        tag_row.update(
                            {
                                "level1": t["level1"],
                                "level2": t["level2"],
                                "level3": t["level3"],
                                "level4": t["level4"],
                                "confidence": t["confidence"],
                                "reason": t["reason"],
                                "is_manual": bool(t["is_manual"]),
                            }
                        )
                        results.append(tag_row)
            else:
                l1 = ", ".join(sorted({t["level1"] for t in tags if t["level1"]}))
                l2 = ", ".join(sorted({t["level2"] for t in tags if t["level2"]}))
                l3 = ", ".join(sorted({t["level3"] for t in tags if t["level3"]}))
                l4 = ", ".join(sorted({t["level4"] for t in tags if t["level4"]}))
                row.update(
                    {
                        "level1": l1,
                        "level2": l2,
                        "level3": l3,
                        "level4": l4,
                        "tags": tags,
                    }
                )
                results.append(row)
        return results

    def list_tasks(self) -> List[Dict[str, Any]]:
        """获取任务列表，按创建时间倒序."""
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM tasks ORDER BY created_at DESC"
            ).fetchall()
            return [dict(r) for r in rows]

    # ------------------------------------------------------------------
    # Tag Systems
    # ------------------------------------------------------------------

    def create_tag_system(
        self,
        name: str,
        csv_content: str,
        scene_type: Optional[str] = None,
        description: Optional[str] = None,
        is_preset: int = 0,
    ) -> str:
        """创建标签体系，返回 id."""
        sid = f"ts_{uuid.uuid4().hex[:12]}"
        now = datetime.now().isoformat()
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO tag_systems
                (id, name, scene_type, description, csv_content, is_preset, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (sid, name, scene_type or "", description or "", csv_content, is_preset, now, now),
            )
            conn.commit()
        return sid

    def get_tag_system(self, sid: str) -> Optional[Dict[str, Any]]:
        """获取单个标签体系."""
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM tag_systems WHERE id = ?", (sid,)).fetchone()
            return dict(row) if row else None

    def list_tag_systems(
        self,
        preset_only: bool = False,
        scene_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """列出标签体系，默认按 updated_at DESC."""
        query = "SELECT * FROM tag_systems WHERE 1=1"
        params: List[Any] = []
        if preset_only:
            query += " AND is_preset = 1"
        if scene_type:
            query += " AND scene_type = ?"
            params.append(scene_type)
        query += " ORDER BY updated_at DESC"
        with self._conn() as conn:
            rows = conn.execute(query, params).fetchall()
            return [dict(r) for r in rows]

    def update_tag_system(self, sid: str, **kwargs) -> None:
        """更新标签体系字段."""
        allowed = {"name", "scene_type", "description", "csv_content"}
        updates = {k: v for k, v in kwargs.items() if k in allowed}
        if not updates:
            return
        updates["updated_at"] = datetime.now().isoformat()
        cols = ", ".join(f"{k} = ?" for k in updates)
        vals = list(updates.values()) + [sid]
        with self._conn() as conn:
            conn.execute(f"UPDATE tag_systems SET {cols} WHERE id = ?", vals)
            conn.commit()

    def delete_tag_system(self, sid: str) -> None:
        """删除标签体系（预置不可删）."""
        ts = self.get_tag_system(sid)
        if ts is None:
            return
        if ts.get("is_preset"):
            raise ValueError("Cannot delete preset tag system")
        with self._conn() as conn:
            conn.execute("DELETE FROM tag_systems WHERE id = ?", (sid,))
            conn.commit()

    def copy_tag_system(self, sid: str) -> str:
        """复制标签体系，返回新 id."""
        ts = self.get_tag_system(sid)
        if ts is None:
            raise ValueError("Tag system not found")
        new_name = f"{ts['name']} (副本)"
        return self.create_tag_system(
            name=new_name,
            csv_content=ts["csv_content"],
            scene_type=ts.get("scene_type") or None,
            description=ts.get("description") or None,
            is_preset=0,
        )

    def migrate_presets(self, configs_dir: Path) -> None:
        """将 configs/*.csv 导入为预置标签体系."""
        with self._conn() as conn:
            row = conn.execute("SELECT COUNT(*) as cnt FROM tag_systems WHERE is_preset = 1").fetchone()
            if row and row["cnt"] > 0:
                return
        if not configs_dir.exists():
            return
        for f in sorted(configs_dir.iterdir()):
            if f.suffix.lower() == ".csv":
                try:
                    csv_content = f.read_text(encoding="utf-8-sig")
                    self.create_tag_system(
                        name=f.stem,
                        csv_content=csv_content,
                        is_preset=1,
                    )
                except Exception:
                    pass

    def get_task_stats(self, task_id: str) -> Dict[str, Any]:
        """获取任务统计信息."""
        with self._conn() as conn:
            # 总评论数
            total_row = conn.execute(
                "SELECT COUNT(*) as cnt FROM reviews WHERE task_id = ?", (task_id,)
            ).fetchone()
            total = total_row["cnt"] if total_row else 0

            # 各状态统计
            status_rows = conn.execute(
                "SELECT status, COUNT(*) as cnt FROM reviews WHERE task_id = ? GROUP BY status",
                (task_id,),
            ).fetchall()
            status_counts: Dict[str, int] = {r["status"]: r["cnt"] for r in status_rows}

            # 已打标评论数（至少有一条标签记录）
            tagged_row = conn.execute(
                """
                SELECT COUNT(DISTINCT r.id) as cnt
                FROM reviews r
                JOIN tag_records t ON r.id = t.review_db_id
                WHERE r.task_id = ?
                """,
                (task_id,),
            ).fetchone()
            tagged = tagged_row["cnt"] if tagged_row else 0

            # 标签分布（一级标签）
            tag_rows = conn.execute(
                """
                SELECT t.level1, COUNT(*) as cnt
                FROM reviews r
                JOIN tag_records t ON r.id = t.review_db_id
                WHERE r.task_id = ? AND t.level1 != '' AND t.level1 != '_uncertain'
                GROUP BY t.level1
                ORDER BY cnt DESC
                """,
                (task_id,),
            ).fetchall()
            tag_distribution: Dict[str, int] = {r["level1"]: r["cnt"] for r in tag_rows}

            # 模糊评论列表
            uncertain_rows = conn.execute(
                """
                SELECT id, review_id, content, authenticity_score, status
                FROM reviews
                WHERE task_id = ? AND (uncertain = 1 OR status = 'uncertain')
                ORDER BY id
                """,
                (task_id,),
            ).fetchall()
            uncertain_reviews = [dict(r) for r in uncertain_rows]

            # 虚假评论列表
            rejected_rows = conn.execute(
                """
                SELECT id, review_id, content, authenticity_score, status
                FROM reviews
                WHERE task_id = ? AND status = 'rejected'
                ORDER BY id
                """,
                (task_id,),
            ).fetchall()
            rejected_reviews = [dict(r) for r in rejected_rows]

        return {
            "task_id": task_id,
            "total_reviews": total,
            "tagged_reviews": tagged,
            "status_counts": status_counts,
            "tag_distribution": tag_distribution,
            "uncertain_reviews": uncertain_reviews,
            "rejected_reviews": rejected_reviews,
        }


# 模块级默认实例（懒加载）
_default_store: Optional[Store] = None


def _get_default_store() -> Store:
    global _default_store
    if _default_store is None:
        _default_store = Store()
        _default_store.init_db()
    return _default_store


def init_db() -> None:
    _get_default_store().init_db()


def create_task(task_id: str, **kwargs) -> None:
    _get_default_store().create_task(task_id, **kwargs)


def update_task(task_id: str, **kwargs) -> None:
    _get_default_store().update_task(task_id, **kwargs)


def get_task(task_id: str) -> Optional[Dict[str, Any]]:
    return _get_default_store().get_task(task_id)


def save_reviews(task_id: str, reviews: List[Review]) -> Dict[str, int]:
    return _get_default_store().save_reviews(task_id, reviews)


def get_reviews_by_task(task_id: str) -> List[Dict[str, Any]]:
    return _get_default_store().get_reviews_by_task(task_id)


def get_reviews_by_task_and_tag(task_id: str, level1: str) -> List[Dict[str, Any]]:
    return _get_default_store().get_reviews_by_task_and_tag(task_id, level1)


def find_existing_review(task_id: str, content_hash: str) -> Optional[Dict[str, Any]]:
    return _get_default_store().find_existing_review(task_id, content_hash)


def save_tags(review_db_id: int, tags: List[Dict[str, Any]]) -> None:
    _get_default_store().save_tags(review_db_id, tags)


def clear_tags(review_db_id: int) -> None:
    _get_default_store().clear_tags(review_db_id)


def get_tags_by_review(review_db_id: int) -> List[Dict[str, Any]]:
    return _get_default_store().get_tags_by_review(review_db_id)


def update_review_status(
    review_db_id: int,
    status: str,
    uncertain: Optional[int] = None,
    authenticity_score: Optional[float] = None,
) -> None:
    _get_default_store().update_review_status(review_db_id, status, uncertain, authenticity_score)


def export_task_results(task_id: str, output_format: str = "wide") -> List[Dict[str, Any]]:
    return _get_default_store().export_task_results(task_id, output_format)


def list_tasks() -> List[Dict[str, Any]]:
    return _get_default_store().list_tasks()


def get_task_stats(task_id: str) -> Dict[str, Any]:
    return _get_default_store().get_task_stats(task_id)


def migrate_presets(configs_dir: Path) -> None:
    _get_default_store().migrate_presets(configs_dir)


def create_tag_system(name: str, csv_content: str, **kwargs) -> str:
    return _get_default_store().create_tag_system(name, csv_content, **kwargs)


def get_tag_system(sid: str) -> Optional[Dict[str, Any]]:
    return _get_default_store().get_tag_system(sid)


def list_tag_systems(**kwargs) -> List[Dict[str, Any]]:
    return _get_default_store().list_tag_systems(**kwargs)


def update_tag_system(sid: str, **kwargs) -> None:
    return _get_default_store().update_tag_system(sid, **kwargs)


def delete_tag_system(sid: str) -> None:
    return _get_default_store().delete_tag_system(sid)


def copy_tag_system(sid: str) -> str:
    return _get_default_store().copy_tag_system(sid)
