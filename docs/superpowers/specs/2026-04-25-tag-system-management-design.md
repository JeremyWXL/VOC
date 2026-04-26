# 标签体系管理功能 — 设计文档

> 日期: 2026-04-25
> 项目: VOC 智能分析引擎

## 目标

实现标签体系的持久化 CRUD 管理，替代原有的纯文件路径引用方式。

## 架构决策

- **CSV 整存策略**: `tag_systems.csv_content` 存储完整 CSV 文本，与现有 `load_tag_hierarchy()` 兼容
- **兼容层保留**: 原有 `/upload` + `file_id` 路径继续可用，新增 `tag_system_id` 作为首选方式
- **预置标签入库**: `configs/*.csv` 在首次启动时自动导入为 `is_preset=1` 的记录

## 数据库设计

```sql
CREATE TABLE tag_systems (
    id TEXT PRIMARY KEY,           -- ts_<uuid>
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
```

## API 设计

新增端点:
- `GET /api/tag-systems` — 列表（支持 `?scene=` `?preset=` 筛选）
- `POST /api/tag-systems` — 创建
- `GET /api/tag-systems/{id}` — 详情
- `PUT /api/tag-systems/{id}` — 更新
- `DELETE /api/tag-systems/{id}` — 删除（预置不可删）
- `POST /api/tag-systems/{id}/copy` — 复制

改造端点:
- `/preset-tags` → 查 `tag_systems WHERE is_preset=1`
- `/tag` 和 `/tag-multi` 支持 `tag_system_id` 替代 `tag_file_id`
- `/generate-tags` 新增 `save_as_system` 参数

## 前端设计

- Step 2 区域：标签库卡片网格替代预设下拉框
- 新增「标签库管理」弹窗：列表/搜索/筛选/CRUD
- 编辑器双向通信：`postMessage({ type: 'save-csv', csv: ... })` 回传
- AI 生成后可「保存到标签库」
