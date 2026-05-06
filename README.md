# 电商评论 LLM 智能打标工具

基于大语言模型（LLM）的电商评论三级标签自动识别系统。

**核心链路**：评论 Excel/CSV + 标签体系 Excel/CSV → LLM 语义理解 → 输出带标签字段的 Excel/CSV

---

## 目录结构

```
ecommerce-review-tagger/
├── src/review_tagger/          # 核心代码
│   ├── core/
│   │   └── excel_tagger.py     # Excel 打标主流程
│   ├── llm/
│   │   ├── provider.py         # LLM Provider 抽象
│   │   ├── providers.py        # OpenAI / DeepSeek / DashScope 实现
│   │   └── client.py           # 批量异步调用 + 重试 + 限流
│   ├── prompts/
│   │   ├── templates.py        # 动态标签体系 Prompt
│   │   └── examples.py         # 少样本示例
│   ├── loaders.py              # Excel/CSV 读写
│   ├── models.py               # Pydantic 数据模型
│   ├── config.py               # 配置管理
│   ├── cli.py                  # 命令行入口
│   └── api/                    # Web 工作台后端 (FastAPI)
│       ├── main.py
│       ├── routes.py
│       └── tasks.py
├── app_tag_workbench.html      # Web 打标工作台前端
├── app_tag_config.html         # 标签体系画布编辑器
├── configs/
│   └── llm.yaml                # 示例配置
├── data/samples/
│   ├── reviews.csv             # 示例评论数据
│   └── tag_hierarchy.csv       # 示例标签体系
└── pyproject.toml
```

---

## 快速开始

### 1. 安装依赖

```bash
cd ecommerce-review-tagger

# 创建虚拟环境并安装
uv venv
uv pip install -e ".[dev]"

# 或使用 pip
pip install -e ".[dev]"
```

### 2. 配置 LLM API Key

```bash
# 方式一：环境变量（推荐）
export OPENAI_API_KEY="sk-xxx"
export OPENAI_BASE_URL="https://api.openai.com/v1"  # 可选，自定义接口地址

# 方式二：配置文件
review-tagger init-config --output config.yaml
# 编辑 config.yaml 填入 api_key
```

支持多种模型提供商：
- `openai`（默认）
- `deepseek`
- `dashscope`（阿里通义千问）
- 任意兼容 OpenAI 接口的自定义地址

### 3. 准备数据

**评论表**（CSV/Excel）

| 评论ID | 评论内容 | 评分 | 商品名称 |
|--------|----------|------|----------|
| R001 | 衣服质量很好... | 4 | T恤 |

**标签体系表**（CSV/Excel）

| 一级标签 | 二级标签 | 三级标签 |
|----------|----------|----------|
| 商品质量 | 整体质量 | 质量好 |
| 商品质量 | 整体质量 | 质量差 |
| 物流服务 | 配送速度 | 速度快 |

> 标签体系严格限制 LLM 的输出范围，**禁止创造体系外标签**。

### 4. 运行打标

```bash
# 使用环境变量中的 API Key
review-tagger tag-excel \
  data/samples/reviews.csv \
  data/samples/tag_hierarchy.csv \
  output/tagged_reviews.csv \
  --content-col "评论内容" \
  --id-col "评论ID"

# 使用配置文件
review-tagger tag-excel \
  reviews.xlsx tag_hierarchy.xlsx output.xlsx \
  --config config.yaml
```

### 5. 查看结果

输出文件会**保留原表所有字段**，并追加以下标签列：

| 一级标签 | 二级标签 | 三级标签 | 标签详情(JSON) |
|----------|----------|----------|----------------|
| 商品质量, 物流服务 | 整体质量, 配送速度 | 质量好, 速度慢 | `[{"level1":"商品质量",...}]` |

---

## CLI 命令

```bash
# 打标（核心命令）
review-tagger tag-excel <评论文件> <标签体系文件> <输出文件>

# 预览 Prompt（调试用，不消耗 API）
review-tagger preview-prompt "这条评论怎么样" tag_hierarchy.csv

# 生成配置文件模板
review-tagger init-config --output config.yaml

# 增量打标（仅对新增评论打标）
review-tagger tag-excel \
  new_reviews.csv tag_hierarchy.csv output.csv \
  --previous-output old_output.csv \
  --strategy skip_existing

# 启动 Web 工作台
review-tagger serve
# 或指定端口
review-tagger serve --port 8080
```

---

## 设计说明

### 为什么用 LLM？

传统规则引擎（关键词匹配）的问题：
- 无法处理语义变体（"物流像蜗牛" ≠ "物流慢"的关键词匹配）
- 难以处理否定、转折（"虽然便宜，但是质量差"）
- 标签体系调整成本高，需要改代码

LLM 的优势：
- 理解上下文语义，精准匹配隐含表达
- 标签体系完全外置（Excel 配置），**零代码调整**
- 支持多标签、多级标签联合推理

### 混合架构

```
┌─────────────────────────────────────────┐
│           ExcelTagger (核心)             │
├─────────────────────────────────────────┤
│  Prompt Builder (体系注入 + 少样本示例)   │
├─────────────────────────────────────────┤
│  LLM Client (批量/异步/重试/限流)        │
├─────────────────────────────────────────┤
│  Provider (OpenAI / DeepSeek / 兼容接口) │
└─────────────────────────────────────────┘
```

### 可靠性机制

- **批量异步**：并发控制 + 分段处理，避免触发限流
- **指数退避重试**：网络波动自动恢复
- **JSON Mode**：强制模型输出结构化 JSON，降低解析失败率
- **容错解析**：即使模型输出带 markdown 代码块，也能正则提取
- **置信度过滤**：只保留 confidence ≥ 0.7 的标签

---

## 输出格式

输出文件保留原表所有字段，并追加以下标签列：

| 一级标签 | 二级标签 | 三级标签 | 标签详情(JSON) | 是否模糊 | 真实性评分 | 评论状态 |
|----------|----------|----------|----------------|---------|-----------|---------|
| 商品质量, 物流服务 | 整体质量, 配送速度 | 质量好, 速度慢 | `[{"level1":"商品质量",...}]` | 0 | 0.95 | normal |
| _uncertain | | | | 1 | 0.60 | uncertain |

**新增列说明**：
- `是否模糊` — 1 表示 LLM 认为评论语义含糊、无法准确打标
- `真实性评分` — 0.0~1.0，评估评论是否像真实用户评价（低分可能为刷单/模板/水军）
- `评论状态` — `normal`（正常）/`uncertain`（模糊）/`rejected`（虚假，评分<0.3）

---

## Web 打标工作台

除了 CLI，项目还提供完整的 Web 界面，支持浏览器内完成「上传 → 配置 → 打标 → 下载」全流程。

### 启动工作台

```bash
review-tagger serve
```

浏览器访问 http://localhost:8000/ 即可使用。

### 工作台功能

| 功能 | 说明 |
|------|------|
| **标签体系上传** | 拖拽上传 CSV/Excel，或跳转画布编辑器创建 |
| **评论数据上传** | 自动识别列名，智能猜测评论内容列 |
| **数据预览** | 上传后即时显示前5行数据 |
| **LLM 配置** | 选择提供商、模型、填写 API Key，支持高级选项 |
| **Prompt 预览** | 输入单条评论，实时查看生成的 LLM Prompt |
| **实时进度** | SSE 推送，进度条实时更新 |
| **结果预览** | 完成后显示前10行打标结果 |
| **一键下载** | 宽格式/长格式结果 CSV 下载 |

### 任务看板

工作台顶部「任务看板」提供全局视角：

1. 查看所有历史任务列表（评论数、已打标数、模糊数、虚假数）
2. 点击任务展开详情卡片：统计数字 + 标签分布条形图
3. 模糊/虚假评论预览，一键进入审核模式

### 审核模式

工作台顶部可切换「审核模式」，无需重新打标即可对已有任务进行人工修正：

1. 输入 task_id（或从 URL `#audit=xxx` 直接进入）
2. 加载评论列表，支持按状态/标签/关键词筛选
3. Inline 编辑标签：删除、添加、保存
4. 批量操作：标记已审核、剔除虚假评论

### 增量打标

Step 2 支持「增量打标」选项：
- 上传上次的结果文件 → 系统自动识别已打标评论
- 策略选择：
  - `skip_existing` — 仅对新增/未打标评论调用 LLM
  - `re_tag_all` — 全部重新打标
- CLI 同样支持：`--previous-output` + `--strategy`

### 架构

```
┌─────────────────────────────────────────────┐
│  浏览器 (app_tag_workbench.html)              │
├─────────────────────────────────────────────┤
│  FastAPI (file upload / tag / SSE / download)│
├─────────────────────────────────────────────┤
│  ExcelTagger + IncrementalTagger              │
├─────────────────────────────────────────────┤
│  LLM Client + Provider                        │
├─────────────────────────────────────────────┤
│  SQLite (tasks / reviews / tag_records)       │
└─────────────────────────────────────────────┘
```

---

## 扩展开发

### 添加自定义 LLM 提供商

继承 `LLMProvider` 抽象类，实现 `chat()` 和 `count_tokens()` 方法：

```python
from review_tagger.llm.provider import LLMProvider

class MyProvider(LLMProvider):
    async def chat(self, messages, ...):
        # 调用你的 API
        return "{...}"
```

### 调整 Prompt

编辑 `src/review_tagger/prompts/templates.py` 中的 `build_system_prompt()`：
- 修改任务要求
- 调整置信度阈值
- 增加输出字段

### 调整少样本示例

编辑 `src/review_tagger/prompts/examples.py`：
- 替换为你业务领域的真实评论示例
- 控制示例数量（默认 2 个）以节省 token

---

## 最小验证（无需 API Key）

```bash
# 1. 验证数据加载和 Prompt 构建
review-tagger preview-prompt "质量很好，物流慢" data/samples/tag_hierarchy.csv

# 2. 本地单元测试
pytest tests/
```
