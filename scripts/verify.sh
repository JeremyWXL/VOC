#!/bin/bash
set -e

echo "=== VOC 智能分析引擎 — 提交前验证 ==="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# ── 1. 后端测试 ──
echo "[1/4] 运行后端测试 (pytest)..."
cd "$(dirname "$0")/.."
if .venv/bin/python -m pytest tests/ -q --tb=short 2>/dev/null; then
    echo -e "${GREEN}✓${NC} 后端测试通过"
else
    echo -e "${RED}✗${NC} 后端测试失败"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# ── 2. 前端 JS 语法检查 ──
echo "[2/4] 检查前端 JS 语法..."

# app_tag_workbench.html
sed -n '/<script>/,/<\/script>/p' app_tag_workbench.html | sed '1d;$d' > /tmp/_voc_wb.js
if node --check /tmp/_voc_wb.js 2>/dev/null; then
    echo -e "${GREEN}✓${NC} app_tag_workbench.html JS 语法正确"
else
    echo -e "${RED}✗${NC} app_tag_workbench.html JS 语法错误"
    node --check /tmp/_voc_wb.js 2>&1 || true
    ERRORS=$((ERRORS + 1))
fi

# app_tag_config.html
sed -n '/<script>/,/<\/script>/p' app_tag_config.html | sed '1d;$d' > /tmp/_voc_cfg.js
if node --check /tmp/_voc_cfg.js 2>/dev/null; then
    echo -e "${GREEN}✓${NC} app_tag_config.html JS 语法正确"
else
    echo -e "${RED}✗${NC} app_tag_config.html JS 语法错误"
    node --check /tmp/_voc_cfg.js 2>&1 || true
    ERRORS=$((ERRORS + 1))
fi
echo ""

# ── 3. HTML 结构检查 ──
echo "[3/4] 检查 HTML 结构..."

python3 -c "
from html.parser import HTMLParser

class HTMLChecker(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.errors = []
        
    def handle_starttag(self, tag, attrs):
        void_tags = [
            'meta', 'link', 'br', 'hr', 'img', 'input', 'area', 'base', 
            'col', 'embed', 'param', 'source', 'track', 'wbr',
            'svg', 'path', 'circle', 'line', 'polygon', 'rect', 'ellipse',
            'use', 'defs', 'stop', 'g'
        ]
        if tag not in void_tags:
            self.stack.append((tag, self.getpos()[0]))
    
    def handle_endtag(self, tag):
        void_tags = [
            'meta', 'link', 'br', 'hr', 'img', 'input', 'area', 'base',
            'col', 'embed', 'param', 'source', 'track', 'wbr',
            'svg', 'path', 'circle', 'line', 'polygon', 'rect', 'ellipse',
            'use', 'defs', 'stop', 'g'
        ]
        if tag in void_tags:
            return
        if self.stack and self.stack[-1][0] == tag:
            self.stack.pop()
        else:
            expected = self.stack[-1] if self.stack else None
            if expected:
                self.errors.append(f'Line {self.getpos()[0]}: Unexpected </{tag}>, expected </{expected[0]}> (opened at line {expected[1]})')
            else:
                self.errors.append(f'Line {self.getpos()[0]}: Unexpected </{tag}>, no matching open tag')

files = ['app_tag_workbench.html', 'app_tag_config.html']
all_ok = True

for filepath in files:
    checker = HTMLChecker()
    with open(filepath, 'r', encoding='utf-8') as f:
        checker.feed(f.read())
    
    if checker.errors:
        all_ok = False
        print(f'✗ {filepath}:')
        for err in checker.errors[:5]:
            print(f'    {err}')
    elif checker.stack:
        all_ok = False
        print(f'✗ {filepath}:')
        for tag, line in checker.stack:
            print(f'    Unclosed <{tag}> (opened at line {line})')
    else:
        print(f'✓ {filepath}: HTML 结构正确')

if not all_ok:
    exit(1)
" || {
    echo -e "${RED}✗${NC} HTML 结构检查失败"
    ERRORS=$((ERRORS + 1))
}
echo ""

# ── 4. 服务器可启动检查 ──
echo "[4/4] 检查服务器能否正常启动..."

# 先检查是否有进程占用 8000 端口
if lsof -ti:8000 >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠${NC} 端口 8000 被占用，跳过启动检查"
else
    # 尝试启动服务器，3秒后检查健康状态
    .venv/bin/uvicorn review_tagger.api.main:app --host 0.0.0.0 --port 8000 > /tmp/_voc_health.log 2>&1 &
    PID=$!
    sleep 2
    
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/ | grep -q "200"; then
        echo -e "${GREEN}✓${NC} 服务器启动正常 (PID: $PID)"
    else
        echo -e "${RED}✗${NC} 服务器启动失败"
        cat /tmp/_voc_health.log | tail -5
        ERRORS=$((ERRORS + 1))
    fi
    
    # 清理测试进程
    kill $PID 2>/dev/null || true
    sleep 1
fi
echo ""

# ── 结果 ──
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}═══════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ 全部验证通过，可以安全提交${NC}"
    echo -e "${GREEN}═══════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}═══════════════════════════════════════${NC}"
    echo -e "${RED}  ❌ 验证失败 ($ERRORS 项)，请修复后再提交${NC}"
    echo -e "${RED}═══════════════════════════════════════${NC}"
    exit 1
fi
