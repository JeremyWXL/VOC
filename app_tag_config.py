"""标签体系图形化配置界面 - Streamlit V4（Finder 列视图）.

运行方式:
    cd ecommerce-review-tagger
    streamlit run app_tag_config.py
"""

import json
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
import streamlit as st

# ───────────────────────── 全局样式 ─────────────────────────
hide_style = """
<style>
#MainMenu {visibility: hidden;}
footer {visibility: hidden;}
.stDeployButton {display:none;}
.block-container {padding-top: 1rem; padding-bottom: 0.5rem;}
/* 让 secondary 按钮在未选中时更像列表项 */
button[kind="secondary"] {
    justify-content: flex-start !important;
    text-align: left !important;
    font-weight: 400 !important;
}
button[kind="primary"] {
    justify-content: flex-start !important;
    text-align: left !important;
    font-weight: 600 !important;
}
/* 压缩列内间距 */
div[data-testid="stVerticalBlock"] div[data-testid="stVerticalBlockBorderWrapper"] {
    margin-bottom: 2px !important;
}
</style>
"""
st.markdown(hide_style, unsafe_allow_html=True)

st.set_page_config(page_title="标签体系配置", layout="wide")

# ───────────────────────── 常量 ─────────────────────────
MAX_DEPTH = 4
SAVE_PATH = Path(__file__).parent / "configs" / "tag_tree.json"
DEFAULT_CSV = Path(__file__).parent / "data" / "samples" / "tag_hierarchy.csv"

LEVEL_NAMES = {1: "一级", 2: "二级", 3: "三级", 4: "四级"}
LEVEL_COLORS = {1: "#E74C3C", 2: "#E67E22", 3: "#27AE60", 4: "#2980B9"}


# ───────────────────────── 树操作工具函数 ─────────────────────────


def new_node(name: str = "新节点") -> Dict[str, Any]:
    return {"id": str(uuid.uuid4())[:8], "name": name, "children": []}


def find_node(tree: List[Dict[str, Any]], node_id: str) -> Optional[Dict[str, Any]]:
    for node in tree:
        if node["id"] == node_id:
            return node
        found = find_node(node.get("children", []), node_id)
        if found:
            return found
    return None


def find_parent(tree: List[Dict[str, Any]], node_id: str) -> Optional[Dict[str, Any]]:
    for node in tree:
        if any(c["id"] == node_id for c in node.get("children", [])):
            return node
        deeper = find_parent(node.get("children", []), node_id)
        if deeper is not None:
            return deeper
    return None


def count_nodes(tree: List[Dict[str, Any]]) -> int:
    total = 0
    for node in tree:
        total += 1
        total += count_nodes(node.get("children", []))
    return total


def tree_to_csv_rows(tree: List[Dict[str, Any]]) -> List[List[str]]:
    rows = []
    for l1 in tree:
        if not l1.get("children"):
            rows.append([l1["name"], "", "", ""])
            continue
        for l2 in l1["children"]:
            if not l2.get("children"):
                rows.append([l1["name"], l2["name"], "", ""])
                continue
            for l3 in l2["children"]:
                if not l3.get("children"):
                    rows.append([l1["name"], l2["name"], l3["name"], ""])
                    continue
                for l4 in l3["children"]:
                    rows.append([l1["name"], l2["name"], l3["name"], l4["name"]])
    return rows


def csv_rows_to_tree(rows: List[List[str]]) -> List[Dict[str, Any]]:
    tree: List[Dict[str, Any]] = []
    m1: Dict[str, Dict[str, Any]] = {}
    m2: Dict[str, Dict[str, Any]] = {}
    m3: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        if not row or all(not str(c).strip() for c in row):
            continue
        while len(row) < MAX_DEPTH:
            row.append("")
        a, b, c, d = str(row[0]).strip(), str(row[1]).strip(), str(row[2]).strip(), str(row[3]).strip()
        if not a:
            continue
        if a not in m1:
            m1[a] = new_node(a)
            tree.append(m1[a])
        if not b:
            continue
        k2 = f"{a}>{b}"
        if k2 not in m2:
            m2[k2] = new_node(b)
            m1[a]["children"].append(m2[k2])
        if not c:
            continue
        k3 = f"{k2}>{c}"
        if k3 not in m3:
            m3[k3] = new_node(c)
            m2[k2]["children"].append(m3[k3])
        if not d:
            continue
        m3[k3]["children"].append(new_node(d))
    return tree


def save_tree(tree: List[Dict[str, Any]]) -> None:
    SAVE_PATH.parent.mkdir(parents=True, exist_ok=True)
    SAVE_PATH.write_text(json.dumps(tree, ensure_ascii=False, indent=2), encoding="utf-8")
    csv_path = Path(__file__).parent / "configs" / "tag_hierarchy.csv"
    rows = tree_to_csv_rows(tree)
    max_c = max((len(r) for r in rows), default=3)
    headers = ["一级标签", "二级标签", "三级标签", "四级标签"][:max_c]
    pd.DataFrame(rows, columns=headers).to_csv(csv_path, index=False, encoding="utf-8-sig")


def load_tree() -> List[Dict[str, Any]]:
    if SAVE_PATH.exists():
        return json.loads(SAVE_PATH.read_text(encoding="utf-8"))
    if DEFAULT_CSV.exists():
        return csv_rows_to_tree(pd.read_csv(DEFAULT_CSV).values.tolist())
    return []


# ───────────────────────── 初始化 Session State ─────────────────────────

if "tag_tree" not in st.session_state:
    st.session_state.tag_tree = load_tree()

for key in ["sel_l1", "sel_l2", "sel_l3", "sel_l4", "edit_id", "last_saved"]:
    if key not in st.session_state:
        st.session_state[key] = None if key != "last_saved" else SAVE_PATH.exists()


# ───────────────────────── 页面布局 ─────────────────────────

st.title("🏷️ 标签体系配置")
st.caption("Finder 列视图风格：一级 → 二级 → 三级 → 四级，横向展开，层层深入。")

# ── 顶部工具栏 ──
c1, c2, c3, c4, c5 = st.columns([1, 1, 1, 1, 1.5])

with c1:
    up = st.file_uploader("📥 导入 CSV", type=["csv"], label_visibility="collapsed")
    if up is not None:
        try:
            st.session_state.tag_tree = csv_rows_to_tree(pd.read_csv(up).values.tolist())
            for k in ["sel_l1", "sel_l2", "sel_l3", "sel_l4", "edit_id"]:
                st.session_state[k] = None
            st.session_state.last_saved = False
            st.success("导入成功")
            st.rerun()
        except Exception as e:
            st.error(f"导入失败: {e}")

with c2:
    if st.button("📤 导出 CSV", use_container_width=True):
        rows = tree_to_csv_rows(st.session_state.tag_tree)
        max_c = max((len(r) for r in rows), default=3)
        hdr = ["一级标签", "二级标签", "三级标签", "四级标签"][:max_c]
        lines = [",".join(hdr)] + [",".join(f'"{c}"' for c in r) for r in rows]
        st.download_button(
            label="⬇️ 下载", data="\n".join(lines).encode("utf-8-sig"),
            file_name="tag_hierarchy.csv", mime="text/csv", use_container_width=True,
        )

with c3:
    btype = "primary" if not st.session_state.last_saved else "secondary"
    if st.button("💾 保存配置", use_container_width=True, type=btype):
        save_tree(st.session_state.tag_tree)
        st.session_state.last_saved = True
        st.success("已保存到 configs/")
        st.rerun()

with c4:
    if st.button("🗑️ 清空", use_container_width=True):
        for k in ["tag_tree", "sel_l1", "sel_l2", "sel_l3", "sel_l4", "edit_id"]:
            st.session_state[k] = [] if k == "tag_tree" else None
        st.session_state.last_saved = False
        st.rerun()

with c5:
    color = "🟢" if st.session_state.last_saved else "🟡"
    st.markdown(
        f"<div style='text-align:right; padding-top:10px; color:#666; font-size:0.9em;'>"
        f"{color} <b>{count_nodes(st.session_state.tag_tree)}</b> 节点"
        f"{' | 已保存' if st.session_state.last_saved else ' | 未保存'}</div>",
        unsafe_allow_html=True,
    )

st.divider()

# ── 计算每列数据 ──
tree = st.session_state.tag_tree

l1_nodes = tree
l2_nodes = []
l3_nodes = []
l4_nodes = []

l1_sel = find_node(tree, st.session_state.sel_l1) if st.session_state.sel_l1 else None
l2_sel = None
l3_sel = None

if l1_sel:
    l2_nodes = l1_sel.get("children", [])
    l2_sel = find_node(l2_nodes, st.session_state.sel_l2) if st.session_state.sel_l2 else None
if l2_sel:
    l3_nodes = l2_sel.get("children", [])
    l3_sel = find_node(l3_nodes, st.session_state.sel_l3) if st.session_state.sel_l3 else None
if l3_sel:
    l4_nodes = l3_sel.get("children", [])


# ── 渲染列 ──
def render_column(nodes: List[Dict[str, Any]], level: int, selected_node: Optional[Dict[str, Any]], parent_node: Optional[Dict[str, Any]]):
    title = LEVEL_NAMES[level]
    color = LEVEL_COLORS[level]

    st.markdown(f"<h4 style='color:{color}; margin-bottom:4px;'>{title}标签</h4>", unsafe_allow_html=True)

    if parent_node:
        st.caption(f"↳ {parent_node['name']}")
    else:
        st.caption(" ")  # 占位保持对齐

    if not nodes:
        st.info("无标签", icon="📂")

    for node in nodes:
        is_sel = selected_node is not None and selected_node["id"] == node["id"]
        is_edit = st.session_state.edit_id == node["id"]

        if is_edit:
            new_name = st.text_input(
                "名称", value=node["name"], key=f"inp_{node['id']}",
                label_visibility="collapsed",
            )
            if new_name != node["name"]:
                node["name"] = new_name
                st.session_state.last_saved = False
                st.rerun()
            if st.button("✓ 完成", key=f"done_{node['id']}", use_container_width=True):
                st.session_state.edit_id = None
                st.rerun()
        else:
            btn_type = "primary" if is_sel else "secondary"
            if st.button(node["name"], key=f"btn_{level}_{node['id']}", type=btn_type, use_container_width=True):
                # 选中逻辑：设置当前级，清空下级
                if level == 1:
                    st.session_state.sel_l1 = node["id"]
                    st.session_state.sel_l2 = None
                    st.session_state.sel_l3 = None
                    st.session_state.sel_l4 = None
                elif level == 2:
                    st.session_state.sel_l2 = node["id"]
                    st.session_state.sel_l3 = None
                    st.session_state.sel_l4 = None
                elif level == 3:
                    st.session_state.sel_l3 = node["id"]
                    st.session_state.sel_l4 = None
                elif level == 4:
                    st.session_state.sel_l4 = node["id"]
                st.session_state.edit_id = None
                st.rerun()

    st.divider()

    # ── 操作区 ──
    can_add = level == 1 or parent_node is not None
    if st.button(
        f"➕ 添加{title}", key=f"add_{level}",
        disabled=not can_add, use_container_width=True,
    ):
        target = parent_node["children"] if parent_node else st.session_state.tag_tree
        target.append(new_node(f"{title}标签"))
        st.session_state.last_saved = False
        st.rerun()

    sel_id = selected_node["id"] if selected_node else None

    if sel_id and st.button("🗑️ 删除选中", key=f"del_{level}", use_container_width=True):
        if level == 1:
            st.session_state.tag_tree[:] = [n for n in st.session_state.tag_tree if n["id"] != sel_id]
            st.session_state.sel_l1 = None
        elif level == 2 and parent_node:
            parent_node["children"] = [n for n in parent_node["children"] if n["id"] != sel_id]
            st.session_state.sel_l2 = None
        elif level == 3 and parent_node:
            parent_node["children"] = [n for n in parent_node["children"] if n["id"] != sel_id]
            st.session_state.sel_l3 = None
        elif level == 4 and parent_node:
            parent_node["children"] = [n for n in parent_node["children"] if n["id"] != sel_id]
            st.session_state.sel_l4 = None
        st.session_state.edit_id = None
        st.session_state.last_saved = False
        st.rerun()

    if sel_id and st.button("✏️ 编辑名称", key=f"edit_{level}", use_container_width=True):
        st.session_state.edit_id = sel_id
        st.rerun()


# 4 列布局
col1, col2, col3, col4 = st.columns(4)

with col1:
    render_column(l1_nodes, 1, l1_sel, None)
with col2:
    render_column(l2_nodes, 2, l2_sel, l1_sel)
with col3:
    render_column(l3_nodes, 3, l3_sel, l2_sel)
with col4:
    l4_sel = find_node(l4_nodes, st.session_state.sel_l4) if st.session_state.sel_l4 else None
    render_column(l4_nodes, 4, l4_sel, l3_sel)

st.divider()
st.markdown(
    "<small style='color:gray'>"
    "💡 点击节点名称选中，右侧自动展开子标签。➕ 添加、🗑️ 删除、✏️ 编辑名称。最多四级。"
    "</small>",
    unsafe_allow_html=True,
)
