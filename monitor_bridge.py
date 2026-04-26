#!/usr/bin/env python3
"""
Kimi Code 远程监控桥接服务
功能：
1. 监控项目文件变更
2. 捕获终端输出
3. 检测需要审批的事项
4. 同步状态到 Obsidian（手机可查看）
5. 接收远程指令
"""

import os
import sys
import time
import json
import hashlib
import subprocess
from pathlib import Path
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# 配置
PROJECT_DIR = "/Users/wangxingliang/ecommerce-review-tagger"
OBSIDIAN_DIR = "/Users/wangxingliang/Obsidian/Jeremy的知识库/20-项目/AI新产品GTM/洞察Agent共创项目/来伊份洞察Agent共创"
STATUS_FILE = os.path.join(OBSIDIAN_DIR, "Kimi监控_电商评论打标项目.md")
LOG_FILE = os.path.join(PROJECT_DIR, ".monitor", "bridge.log")

# 需要监控的关键文件
WATCH_PATTERNS = [
    "*.py", "*.html", "*.md", "*.yaml", "*.toml",
    "data/*.csv", "output/*.csv", "configs/*"
]

# 需要审批的关键词
APPROVAL_KEYWORDS = [
    "TODO", "FIXME", "HACK", "审批", "确认", "review",
    "需要确认", "待决定", "pending approval",
    "是否", "请确认", "请审批"
]

class ProjectMonitor(FileSystemEventHandler):
    def __init__(self):
        self.last_check = time.time()
        self.pending_approvals = []
        self.recent_changes = []
        self.ensure_monitor_dir()
        
    def ensure_monitor_dir(self):
        os.makedirs(os.path.join(PROJECT_DIR, ".monitor"), exist_ok=True)
        
    def on_modified(self, event):
        if event.is_directory:
            return
        if any(event.src_path.endswith(p.replace("*", "")) for p in WATCH_PATTERNS):
            self.recent_changes.append({
                "time": datetime.now().strftime("%H:%M:%S"),
                "file": os.path.basename(event.src_path),
                "action": "修改"
            })
            self.check_for_approval_needs(event.src_path)
            
    def on_created(self, event):
        if event.is_directory:
            return
        self.recent_changes.append({
            "time": datetime.now().strftime("%H:%M:%S"),
            "file": os.path.basename(event.src_path),
            "action": "新增"
        })
        
    def check_for_approval_needs(self, filepath):
        """检查文件是否包含需要审批的内容"""
        try:
            if filepath.endswith(('.py', '.md', '.yaml', '.txt')):
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    for keyword in APPROVAL_KEYWORDS:
                        if keyword in content:
                            self.pending_approvals.append({
                                "time": datetime.now().strftime("%H:%M:%S"),
                                "file": os.path.basename(filepath),
                                "keyword": keyword,
                                "status": "待审批"
                            })
        except:
            pass
            
    def get_kimi_status(self):
        """获取 Kimi Code 进程状态"""
        try:
            result = subprocess.run(
                ["ps", "aux"], 
                capture_output=True, 
                text=True
            )
            kimi_procs = [line for line in result.stdout.split('\n') if 'kimi code' in line.lower() and 'grep' not in line.lower()]
            return len(kimi_procs) > 0, len(kimi_procs)
        except:
            return False, 0
            
    def get_project_stats(self):
        """获取项目统计信息"""
        stats = {
            "python_files": 0,
            "html_files": 0,
            "test_files": 0,
            "data_files": 0,
            "total_lines": 0
        }
        
        for root, dirs, files in os.walk(PROJECT_DIR):
            # 跳过虚拟环境和缓存
            dirs[:] = [d for d in dirs if d not in ['.venv', '__pycache__', '.git', '.monitor']]
            
            for file in files:
                filepath = os.path.join(root, file)
                if file.endswith('.py'):
                    stats["python_files"] += 1
                    try:
                        with open(filepath, 'r') as f:
                            stats["total_lines"] += len(f.readlines())
                    except:
                        pass
                elif file.endswith('.html'):
                    stats["html_files"] += 1
                elif file.startswith('test_'):
                    stats["test_files"] += 1
                elif file.endswith('.csv'):
                    stats["data_files"] += 1
                    
        return stats
        
    def generate_status_report(self):
        """生成状态报告并写入 Obsidian"""
        kimi_running, kimi_count = self.get_kimi_status()
        stats = self.get_project_stats()
        
        report = f"""# 🤖 Kimi Code 监控 - 电商评论打标项目

> 更新时间：{datetime.now().strftime("%Y-%m-%d %H:%M:%S")}  
> 监控状态：{'✅ 运行中' if kimi_running else '⚠️ 未运行'}

---

## 📊 项目概览

| 指标 | 数值 |
|------|------|
| Python 文件数 | {stats['python_files']} |
| HTML 文件数 | {stats['html_files']} |
| 测试文件数 | {stats['test_files']} |
| 数据文件数 | {stats['data_files']} |
| 代码总行数 | {stats['total_lines']:,} |
| Kimi 进程数 | {kimi_count} |

---

## 🔔 待审批事项 ({len(self.pending_approvals)})

"""
        
        if self.pending_approvals:
            report += "| 时间 | 文件 | 关键词 | 状态 |\n"
            report += "|------|------|--------|------|\n"
            for item in self.pending_approvals[-10:]:  # 只显示最近10条
                report += f"| {item['time']} | {item['file']} | {item['keyword']} | {item['status']} |\n"
        else:
            report += "✅ 暂无待审批事项\n"
            
        report += f"""

---

## 📝 最近变更 ({len(self.recent_changes)})

"""
        
        if self.recent_changes:
            report += "| 时间 | 文件 | 操作 |\n"
            report += "|------|------|------|\n"
            for item in self.recent_changes[-15:]:  # 只显示最近15条
                report += f"| {item['time']} | {item['file']} | {item['action']} |\n"
        else:
            report += "暂无最近变更\n"
            
        report += """

---

## 🎮 远程指令

你可以发送以下指令给我：

| 指令 | 说明 |
|------|------|
| `status` | 获取最新状态 |
| `approve [编号]` | 审批某个事项 |
| `continue` | 通知 Kimi 继续开发 |
| `pause` | 通知 Kimi 暂停 |
| `check [文件名]` | 检查特定文件状态 |

---

*此文件由监控桥接服务自动生成*  
*项目路径：ecommerce-review-tagger/*
"""
        
        # 写入 Obsidian
        try:
            os.makedirs(os.path.dirname(STATUS_FILE), exist_ok=True)
            with open(STATUS_FILE, 'w', encoding='utf-8') as f:
                f.write(report)
        except Exception as e:
            print(f"写入状态文件失败: {e}")
            
    def run(self):
        """主循环"""
        print(f"🚀 监控桥接服务启动")
        print(f"📁 项目目录: {PROJECT_DIR}")
        print(f"📝 状态文件: {STATUS_FILE}")
        
        # 设置文件监控
        observer = Observer()
        observer.schedule(self, PROJECT_DIR, recursive=True)
        observer.start()
        
        try:
            while True:
                self.generate_status_report()
                time.sleep(30)  # 每30秒更新一次
        except KeyboardInterrupt:
            observer.stop()
            print("\n👋 监控服务已停止")
            
        observer.join()

if __name__ == "__main__":
    monitor = ProjectMonitor()
    monitor.run()
