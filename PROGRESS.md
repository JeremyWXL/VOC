# VOC 智能分析引擎 - 项目进度

> 记录时间: 2026-04-25
> 测试状态: 91 passed ✅
> 服务器端口: 8000

---

## 一、已实现功能

### Phase 0: MVP 核心
- [x] LLM 驱动的评论打标（三级标签体系）
- [x] CLI 工具 (`tag-excel`, `preview-prompt`, `init-config`)
- [x] Excel/CSV 输入输出
- [x] Wide/Long 两种输出格式

### Phase 1: 标签配置
- [x] 标签体系画布编辑器 (`app_tag_config.html`，纯 HTML/JS)
- [x] 四级标签树支持（L1/L2/L3/L4）
- [x] 标签编辑器与主页面通过 iframe + postMessage 通信

### Phase 2: 数据质量检测
- [x] 模糊评论识别 (`_uncertain` 标签)
- [x] 真实性评分 (`authenticity_score`，0.0~1.0)
- [x] 虚假/模板评论识别（水军检测）

### Phase 3: 持久化与增量
- [x] SQLite 持久化 (`src/review_tagger/db/store.py`)
- [x] 增量打标（skip_existing / re_tag_all）
- [x] 手动审核模式（inline 编辑标签）

### Phase 4: 任务看板
- [x] 任务列表 + 统计卡片
- [x] 标签分布图表
- [x] SSE 实时进度推送

### Phase 5: 配置管理
- [x] API 配置管理（localStorage，Base64 编码）
- [x] 多模型支持（OpenAI/DeepSeek/DashScope/Azure）

### Phase 6: 多维度标签映射
- [x] 场景条件引擎（7 种操作符：EQ/NE/CONTAINS/IN/STARTS_WITH/ENDS_WITH/REGEX）
- [x] 多标签方案映射 (`tag_mapping.py`, `multi_tagger.py`)
- [x] 单模式/多模式切换

### Phase 7: 分片并行
- [x] 大文件分片处理 (`sharding.py`)
- [x] ShardWorker + ShardingEngine
- [x] 可配置 shard_size / max_shards

### Phase 8: 标签详情弹窗
- [x] 点击看板标签柱 → 弹窗显示过滤评论
- [x] inline 编辑/增删标签

### Phase 9: 场景识别与标签自动生成
- [x] 13 个预定义场景识别（LLM + keyword fallback）
- [x] 9 个场景预定义标签模板（20~50 条路径）
- [x] 标签自动生成 API (`/api/generate-tags`)
- [x] 前端 AI 智能生成入口（Step 2 区域）
- [x] 编辑器自动带入生成的标签（iframe postMessage）

### Phase 10: 品牌视觉改造
- [x] 观远数据品牌视觉风格
- [x] 观远 Logo（白色反白版）
- [x] 品牌蓝主色调 (`#1890ff`)
- [x] 产品名称统一为 "VOC 智能分析引擎"

---

## 二、项目结构

```
ecommerce-review-tagger/
├── src/review_tagger/
│   ├── api/
│   │   ├── main.py              # FastAPI 入口 + 静态文件挂载
│   │   ├── routes.py            # 19 个 API 端点
│   │   └── tasks.py             # 内存任务状态管理
│   ├── core/
│   │   ├── excel_tagger.py      # 核心打标 orchestrator
│   │   ├── incremental.py       # 增量打标
│   │   ├── multi_tagger.py      # 多维度标签映射打标
│   │   ├── scene_detector.py    # 场景识别器（13 场景）
│   │   ├── tag_generator.py     # 标签生成器（9 模板）
│   │   ├── tag_mapping.py       # 标签映射引擎
│   │   └── sharding.py          # 分片并行处理
│   ├── db/
│   │   └── store.py             # SQLite 持久化
│   ├── llm/
│   │   ├── client.py            # LLMClient（批量/并发/重试）
│   │   ├── provider.py          # LLMProvider 抽象基类
│   │   └── providers.py         # OpenAI/Azure/DashScope/DeepSeek
│   ├── prompts/
│   │   ├── templates.py         # 打标 system prompt
│   │   ├── examples.py          # Few-shot 示例（含 authenticity_score）
│   │   └── scene_prompts.py     # 场景识别/标签生成 prompt
│   ├── config.py                # Pydantic Settings（.env 自动加载）
│   ├── loaders.py               # Excel/CSV 读写 + 标签树格式化
│   ├── models.py                # Pydantic 数据模型
│   └── cli.py                   # CLI 入口
├── tests/                       # 91 个测试
├── configs/
│   ├── llm.yaml                 # LLM 配置模板
│   └── tag_hierarchy.csv        # 默认标签体系（服装电商）
├── static/
│   └── logo_guandata_white.png  # 观远 Logo（反白版）
├── scripts/
│   └── run_authenticity_test.py # 真实性评分实测脚本
├── app_tag_workbench.html       # 主前端（~3000 行，纯 HTML/JS/CSS）
├── app_tag_config.html          # 标签画布编辑器（iframe 内嵌）
├── .env                         # API Key 等环境变量（gitignore 建议添加）
└── PROGRESS.md                  # 本文件
```

---

## 三、API 端点清单

| 端点 | 方法 | 说明 |
|---|---|---|
| `/` | GET | 返回主页面 HTML |
| `/api/scenes` | GET | 获取所有预定义场景列表 |
| `/api/detect-scene` | POST | 根据评论识别业务场景 |
| `/api/generate-tags` | POST | 根据场景生成标签体系 CSV |
| `/api/upload` | POST | 上传 Excel/CSV 文件 |
| `/api/download-file` | GET | 读取已上传文件的文本内容 |
| `/api/preset-tags` | GET | 列出预置标签体系文件 |
| `/api/tag` | POST | 启动单标签体系打标任务 |
| `/api/tag-multi` | POST | 启动多维度映射打标任务 |
| `/api/tag-profiles` | POST | 上传标签方案文件 |
| `/api/tag-mapping-config` | POST | 保存映射配置 |
| `/api/tag-mapping-preview` | POST | 预览映射结果 |
| `/api/preview-prompt` | POST | 预览某条评论的 Prompt |
| `/api/tasks` | GET | 获取任务列表 |
| `/api/tasks/{id}` | GET | 获取任务状态 |
| `/api/tasks/{id}/events` | GET | SSE 实时进度 |
| `/api/tasks/{id}/stats` | GET | 任务统计 |
| `/api/tasks/{id}/reviews` | GET | 获取评论列表（支持 level1 筛选） |
| `/api/tasks/{id}/reviews/{db_id}/tags` | POST | 人工修正标签 |
| `/api/download/{task_id}` | GET | 下载打标结果 |

---

## 四、关键配置

### 环境变量 (.env)
```bash
OPENAI_API_KEY=sk-lEM8OtCsRxV4TD2BeyyavB9IiyRqHmysXdAmkQ15tkhcT3F1
OPENAI_BASE_URL=https://modelgateway.guandata.com/v1
LLM_PROVIDER=openai
LLM_MODEL=doubao-seed-2-0-pro-260215
```

### LLM 配置加载逻辑
- `config.py` 中 `load_settings()` 显式调用 `load_dotenv(ENV_FILE)`
- `SceneDetector` 和 `TagGenerator` 都使用 `load_settings()` 而非 `Settings()`
- 支持 `TAGGER_` 前缀的环境变量（Pydantic Settings）

### 注意事项
- doubao 模型不支持 `json_object` response format → `providers.py` 已加自动回退逻辑
- 场景识别 LLM 调用耗时约 5~15 秒（doubao）
- 临时文件保存在 `/var/folders/.../review_tagger/`

---

## 五、前端页面结构

### `app_tag_workbench.html`（主页面）
- 顶部: 观远品牌导航栏（Logo + VOC 智能分析引擎 + Badge）
- Step 1: 评论数据上传（文件上传 + 列选择 + 增量选项）
- Step 2: 标签体系（单/多模式切换 + AI 智能生成入口 + 上传/预设/编辑）
- Step 3: LLM 配置 + 高级选项（并发/分片/JSON Mode）
- Step 4: 执行打标 + 结果预览
- 底部: 品牌 Footer
- 三个 Tab: 打标模式 / 任务看板 / 审核模式

### `app_tag_config.html`（标签画布编辑器）
- 独立 iframe，通过 postMessage 与父页面通信
- 支持从父页面接收 CSV 数据（`load-csv` 消息类型）
- 支持导出 CSV
- 没有父页面数据时 → **空白画布，从0开始**
- 有父页面数据时 → **自动带入**

---

## 六、已知问题与限制

| 问题 | 状态 | 说明 |
|---|---|---|
| 网络限制 | ⚠️ | 当前网络无法直连 114.55.243.75，通过观远模型网关访问 |
| 场景识别耗时 | ⚠️ | doubao 模型 LLM 调用约 5~15 秒，需前端 loading 提示 |
| 编辑器保存同步 | ⚠️ | 编辑器内导出 CSV 后需手动重新上传，未自动同步回主页面 |
| 映射配置持久化 | ⚠️ | 多维度映射配置保存在内存 dict，服务器重启后丢失 |
| 端口冲突 | ⚠️ | 偶尔 8000 被占用，需 `kill $(cat /tmp/tagger_server.pid)` |

---

## 七、Phase 11: 标签体系管理功能 ✅

### 已实现
1. **标签体系库**
   - [x] SQLite 持久化表 `tag_systems`（CSV 整存策略）
   - [x] 预置标签自动迁移（`configs/*.csv` → `is_preset=1`）
   - [x] 完整 CRUD API：`/api/tag-systems` + `/copy`
   - [x] `/preset-tags` 改造为从数据库查询
   - [x] `/tag` 支持 `tag_system_id` 参数
   - [x] `/generate-tags` 支持 `save_as_system`

2. **前端集成**
   - [x] Step 2 区域「标签库」卡片网格替代预设下拉框
   - [x] 标签库管理弹窗（搜索/场景筛选/新建/编辑/复制/删除）
   - [x] AI 生成后「保存到标签库」入口
   - [x] 编辑器双向通信（`save-csv` postMessage）
   - [x] 编辑器返回后「用于当前任务」或「保存到标签库」

### Phase 11.5: 标签库一级功能升级 ✅
- [x] 标签库从弹窗升级为与「打标/任务看板/审核」并列的一级 Tab
- [x] 独立标签库页面：统计卡片 + 搜索/场景筛选/视图切换（卡片/列表）
- [x] 标签体系预览（树形结构弹窗，不打开编辑器）
- [x] CSV 导入到标签库
- [x] 「使用」按钮一键切换回打标模式并选中该标签体系
- [x] Step 2 的「打开标签库」按钮直接跳转到标签库 Tab

### 测试状态
- 新增测试：`test_store_tag_systems.py` (8 passed), `test_api_tag_systems.py` (6 passed)
- 总测试：108 passed ✅
- 服务器：端口 8000 运行正常

---

*End of PROGRESS.md*
