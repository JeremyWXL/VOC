# 标签体系管理功能 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现标签体系的持久化 CRUD 管理，包括数据库、API、前端三层改造。

**Architecture:** 在现有 SQLite 数据库新增 `tag_systems` 表（CSV 整存），新增 6 个 REST API 端点，前端 Step 2 区域集成标签库卡片网格，保留原有文件路径兼容层。

**Tech Stack:** FastAPI, SQLite, vanilla JS/HTML, Pydantic, pandas

---

## Task 1: 数据库层 — 新增 tag_systems 表和 CRUD 方法

**Files:**
- Modify: `src/review_tagger/db/store.py`
- Test: `tests/test_store_tag_systems.py`

- [ ] **Step 1: Write the failing test**

```python
import pytest
from review_tagger.db.store import Store

def test_create_and_get_tag_system():
    store = Store(db_path=":memory:")
    store.init_db()
    sid = store.create_tag_system(name="测试标签", csv_content="一级标签,二级标签\n质量,好\n")
    assert sid.startswith("ts_")
    ts = store.get_tag_system(sid)
    assert ts["name"] == "测试标签"
    assert ts["csv_content"] == "一级标签,二级标签\n质量,好\n"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/wangxingliang/ecommerce-review-tagger && uv run pytest tests/test_store_tag_systems.py -v`
Expected: FAIL with "AttributeError: 'Store' object has no attribute 'create_tag_system'"

- [ ] **Step 3: Add tag_systems table to init_db and implement CRUD methods**

In `src/review_tagger/db/store.py`:
1. Add `tag_systems` DDL to `init_db()` after existing tables
2. Add methods: `create_tag_system`, `get_tag_system`, `list_tag_systems`, `update_tag_system`, `delete_tag_system`, `copy_tag_system`
3. Add module-level convenience functions

Key implementation:
```python
def create_tag_system(self, name: str, csv_content: str, scene_type: Optional[str] = None, description: Optional[str] = None, is_preset: int = 0) -> str:
    import uuid
    sid = f"ts_{uuid.uuid4().hex[:12]}"
    now = datetime.now().isoformat()
    with self._conn() as conn:
        conn.execute(
            "INSERT INTO tag_systems (id, name, scene_type, description, csv_content, is_preset, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (sid, name, scene_type or "", description or "", csv_content, is_preset, now, now),
        )
        conn.commit()
    return sid
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_store_tag_systems.py -v`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `uv run pytest tests/ -q`
Expected: All existing tests still pass

---

## Task 2: 数据模型 — 新增 TagSystem Pydantic 模型

**Files:**
- Modify: `src/review_tagger/models.py`
- Test: `tests/test_models.py` (追加)

- [ ] **Step 1: Write the failing test**

```python
from review_tagger.models import TagSystem, TagSystemCreate

def test_tag_system_model():
    ts = TagSystem(id="ts_123", name="测试", csv_content="a,b\n1,2\n")
    assert ts.name == "测试"
    assert ts.is_preset == False
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL with "ImportError: cannot import name 'TagSystem'"

- [ ] **Step 3: Add Pydantic models**

In `src/review_tagger/models.py`,追加:
```python
class TagSystem(BaseModel):
    id: str
    name: str
    scene_type: Optional[str] = ""
    description: Optional[str] = ""
    csv_content: str
    is_preset: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class TagSystemCreate(BaseModel):
    name: str
    scene_type: Optional[str] = ""
    description: Optional[str] = ""
    csv_content: str
```

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS

---

## Task 3: API 层 — 新增 /api/tag-systems 端点

**Files:**
- Modify: `src/review_tagger/api/routes.py`
- Test: `tests/test_api_tag_systems.py`

- [ ] **Step 1: Write the failing test**

```python
def test_list_tag_systems(client):
    r = client.get("/api/tag-systems")
    assert r.status_code == 200
    assert "items" in r.json()
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL with 404

- [ ] **Step 3: Implement API endpoints**

In `src/review_tagger/api/routes.py`:
1. Import new models
2. Add endpoints:
   - `GET /api/tag-systems` — list with optional `?scene=` and `?preset=` query params
   - `POST /api/tag-systems` — create from `TagSystemCreate`
   - `GET /api/tag-systems/{id}` — detail
   - `PUT /api/tag-systems/{id}` — update
   - `DELETE /api/tag-systems/{id}` — delete (block if `is_preset`)
   - `POST /api/tag-systems/{id}/copy` — copy with "(副本)" suffix

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS

- [ ] **Step 5: Run full test suite**

Expected: All pass

---

## Task 4: 改造现有端点

**Files:**
- Modify: `src/review_tagger/api/routes.py`

- [ ] **Step 1: 改造 /preset-tags**

Change `/preset-tags` to query `db_store.list_tag_systems(preset_only=True)` instead of scanning filesystem.

- [ ] **Step 2: 改造 /tag 支持 tag_system_id**

Modify `POST /tag` payload to accept optional `tag_system_id`. If provided, read CSV from `db_store.get_tag_system(tag_system_id)["csv_content"]` and write to temp file for `ExcelTagger`.

- [ ] **Step 3: 改造 /generate-tags 支持 save_as_system**

Add optional `save_as_system: bool = False` and `name: str = ""` to `GenerateTagsPayload`. When true, call `db_store.create_tag_system()` and return `{ csv_content, tag_system_id }`.

- [ ] **Step 4: Run tests**

Expected: All pass

---

## Task 5: 前端 — 标签库管理弹窗 UI

**Files:**
- Modify: `app_tag_workbench.html`

- [ ] **Step 1: Add tag system library modal HTML**

Add a modal section `#tagSystemModal` with:
- Header: 标签库管理 + 新建按钮 + 关闭按钮
- Search input + Scene filter dropdown
- Grid of cards: name, scene badge, tag count, created date
- Card actions: 选择 / 编辑 / 复制 / 删除

- [ ] **Step 2: Add CSS styles for tag system cards**

Use existing brand blue `#1890ff`, card layout consistent with task dashboard.

- [ ] **Step 3: Add JavaScript for tag system API integration**

Functions:
- `loadTagSystems(scene, preset)` — fetch `/api/tag-systems`
- `renderTagSystemGrid(items)` — render cards
- `createTagSystem(name, csv)` — POST `/api/tag-systems`
- `deleteTagSystem(id)` — DELETE with confirm
- `copyTagSystem(id)` — POST `/api/tag-systems/{id}/copy`

---

## Task 6: 前端 — Step 2 区域集成标签库选择

**Files:**
- Modify: `app_tag_workbench.html`

- [ ] **Step 1: Replace preset selector with tag system selector**

In `#singleTagMode`:
- Replace `#presetTagSelect` dropdown with a compact tag system selector
- Show currently selected tag system name
- Click → open `#tagSystemModal`
- "新建标签体系" button → open editor with blank canvas

- [ ] **Step 2: Update tag file state management**

`tagFile` global now supports both `file_id` (legacy) and `tag_system_id` (new).
When user selects a tag system from library, set:
```javascript
tagFile = { type: 'tag_system', tag_system_id: 'ts_xxx', name: '...', csvContent: '...' };
```

- [ ] **Step 3: Handle AI generated tags save-to-library**

After `/generate-tags` returns, show "保存到标签库" button that calls `createTagSystem()`.

---

## Task 7: 前端 — 编辑器双向通信

**Files:**
- Modify: `app_tag_config.html`
- Modify: `app_tag_workbench.html`

- [ ] **Step 1: Add postMessage outbound in editor**

In `app_tag_config.html`, add:
```javascript
function saveToParent() {
    const csv = treeToCSV();
    window.parent.postMessage({ type: 'save-csv', csv: csv }, '*');
}
```
Add a "保存并返回" button next to existing "导出 CSV" button.

- [ ] **Step 2: Handle save-csv message in parent**

In `app_tag_workbench.html`:
```javascript
window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'save-csv') {
        // Store CSV and offer "Save to library" or "Use for current task"
        editorReturnedCsv = e.data.csv;
        closeTagEditor();
        showEditorReturnModal();
    }
});
```

---

## Task 8: 数据迁移 — 预置标签入库

**Files:**
- Modify: `src/review_tagger/db/store.py`

- [ ] **Step 1: Add migration function**

```python
def migrate_presets(self, project_root: Path) -> None:
    """Import configs/*.csv as preset tag systems if not already imported."""
    with self._conn() as conn:
        row = conn.execute("SELECT COUNT(*) as cnt FROM tag_systems WHERE is_preset = 1").fetchone()
        if row and row["cnt"] > 0:
            return  # Already migrated
        configs_dir = project_root / "configs"
        if not configs_dir.exists():
            return
        for f in sorted(configs_dir.iterdir()):
            if f.suffix.lower() == ".csv":
                csv_content = f.read_text(encoding='utf-8-sig')
                self.create_tag_system(
                    name=f.stem,
                    csv_content=csv_content,
                    is_preset=1,
                )
```

- [ ] **Step 2: Call migration on init_db**

In `init_db()` after creating tables, call `self.migrate_presets(PROJECT_ROOT)` (pass project root as parameter).

---

## Task 9: 集成测试与验证

- [ ] **Step 1: Run full test suite**

`uv run pytest tests/ -q`
Expected: All pass

- [ ] **Step 2: Start server and manually verify**

1. `uv run review-tagger serve --port 8000`
2. Open http://localhost:8000
3. Check Step 2 标签库是否能正常加载
4. 测试新建/编辑/复制/删除标签体系
5. 测试 AI 生成后保存到标签库
6. 测试编辑器双向通信

- [ ] **Step 3: Update PROGRESS.md**

记录新增功能。
