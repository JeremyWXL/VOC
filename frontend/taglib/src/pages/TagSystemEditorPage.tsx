import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Save,
  Eye,
  ArrowLeft,
  Rocket,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import type { TagNode, AtomicTag, SystemStatus } from '@/types';
import { PURCHASE_PHASE_LABELS, SYSTEM_STATUS_LABELS, TAG_CATEGORY_COLORS } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import AtomicTagPanel from '@/components/tag-system/AtomicTagPanel';
import TreeCanvas from '@/components/tag-system/TreeCanvas';
import PropertiesPanel from '@/components/tag-system/PropertiesPanel';

/* ---- helpers ---- */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/* ================================================================== */
/*  Main Page                                                          */
/* ================================================================== */

export default function TagSystemEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    tagSystems,
    tagTrees,
    atomicTags,
    updateTagTree,
    updateTagSystem,
  } = useData();

  const system = useMemo(() => tagSystems.find((s) => s.id === id), [tagSystems, id]);
  const initialNodes = useMemo(() => (id ? (tagTrees[id] ?? []) : []), [tagTrees, id]);

  /* ---- local state for tree editing ---- */
  const [nodes, setNodes] = useState<TagNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggedAtomicTag, setDraggedAtomicTag] = useState<AtomicTag | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  /* ---- UI state ---- */
  const [systemNameEditing, setSystemNameEditing] = useState(false);
  const [systemNameValue, setSystemNameValue] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ---- init nodes from context ---- */
  useEffect(() => {
    if (initialNodes.length >= 0) {
      setNodes([...initialNodes]);
    }
  }, [initialNodes]);

  /* ---- track changes ---- */
  useEffect(() => {
    if (id && initialNodes.length >= 0) {
      const changed = JSON.stringify(nodes) !== JSON.stringify(initialNodes);
      setHasChanges(changed);
    }
  }, [nodes, initialNodes, id]);

  /* ---- auto-save debounce ---- */
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      if (id && hasChanges) {
        handleSave(true);
      }
    }, 3000);
  }, [id, hasChanges]);

  useEffect(() => {
    if (hasChanges) {
      debouncedAutoSave();
    }
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [hasChanges, debouncedAutoSave]);

  /* ---- keyboard: Ctrl+S ---- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nodes, id]);

  /* ---- save ---- */
  const handleSave = useCallback(
    (isAuto: boolean = false) => {
      if (!id) return;
      if (!isAuto) setSaving(true);
      updateTagTree(id, nodes);
      setLastSaved(new Date());
      setHasChanges(false);
      if (!isAuto) {
        toast.success('保存成功');
        setTimeout(() => setSaving(false), 600);
      } else {
        toast.success('已自动保存', { duration: 1500 });
      }
    },
    [id, nodes, updateTagTree]
  );

  /* ---- node operations ---- */
  const handleAddNode = useCallback(
    (parentId: string | undefined, level: 1 | 2 | 3) => {
      const siblings = nodes.filter((n) =>
        parentId ? n.parentId === parentId : n.level === 1
      );
      const newNode: TagNode = {
        id: generateId('tn'),
        name: '新节点',
        level,
        parentId,
        order: siblings.length,
        isExpanded: true,
      };
      const updated = [...nodes, newNode];
      setNodes(updated);
      setSelectedNodeId(newNode.id);
      // Start editing new node name after a brief delay for render
      setTimeout(() => {
        setSelectedNodeId(newNode.id);
      }, 50);
    },
    [nodes]
  );

  const handleUpdateNode = useCallback(
    (nodeId: string, updates: Partial<TagNode>) => {
      setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)));
    },
    []
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      // Count descendants
      const getDescendants = (id: string): string[] => {
        const children = nodes.filter((n) => n.parentId === id);
        return [...children.map((c) => c.id), ...children.flatMap((c) => getDescendants(c.id))];
      };
      const descendants = getDescendants(nodeId);

      if (descendants.length > 0) {
        toast.error(`请先删除 ${descendants.length} 个子节点`, {
          description: '该节点包含子节点，无法直接删除',
        });
        return;
      }

      setNodes((prev) => {
        const filtered = prev.filter((n) => n.id !== nodeId);
        // Reorder siblings
        const siblings = filtered.filter((n) => n.parentId === node.parentId).sort((a, b) => a.order - b.order);
        const reordered = siblings.map((s, i) => ({ ...s, order: i }));
        return filtered.map((n) => {
          const ro = reordered.find((r) => r.id === n.id);
          return ro ?? n;
        });
      });
      setSelectedNodeId((sel) => (sel === nodeId ? null : sel));
      toast.success('节点已删除');
    },
    [nodes]
  );

  const handleLinkAtomicTag = useCallback(
    (nodeId: string, tagId: string) => {
      const tag = atomicTags.find((t) => t.id === tagId);
      if (!tag) return;
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, atomicTagId: tagId, name: tag.name } : n))
      );
    },
    [atomicTags]
  );

  const handleUnlinkAtomicTag = useCallback((nodeId: string) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, atomicTagId: undefined } : n)));
  }, []);

  const handleUpdateNodes = useCallback((updated: TagNode[]) => {
    setNodes(updated);
  }, []);

  /* ---- publish ---- */
  const handlePublish = useCallback(() => {
    if (!id || !system) return;
    updateTagSystem(id, { status: 'published' as SystemStatus });
    handleSave();
    setPublishOpen(false);
    toast.success('标签体系已发布');
  }, [id, system, updateTagSystem, handleSave]);

  /* ---- rename system ---- */
  const handleSystemRename = useCallback(() => {
    if (!id || !systemNameValue.trim()) return;
    updateTagSystem(id, { name: systemNameValue.trim() });
    setSystemNameEditing(false);
    toast.success('名称已更新');
  }, [id, systemNameValue, updateTagSystem]);

  /* ---- computed ---- */
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const nodeCount = nodes.length;
  const referencedCount = nodes.filter((n) => n.atomicTagId).length;

  /* ---- not found ---- */
  if (!system) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[1440px] mx-auto text-center py-20"
      >
        <p className="text-[#9CA3AF]">标签体系不存在或已被删除</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/tag-systems')}>
          返回列表
        </Button>
      </motion.div>
    );
  }

  const statusColors: Record<SystemStatus, { dot: string; text: string }> = {
    draft: { dot: 'bg-[#F59E0B]', text: 'text-[#F59E0B]' },
    published: { dot: 'bg-[#10B981]', text: 'text-[#10B981]' },
    archived: { dot: 'bg-[#9CA3AF]', text: 'text-[#9CA3AF]' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="flex flex-col h-[calc(100dvh-56px)] -mx-6 -mt-6 -mb-6"
    >
      {/* ====== Toolbar / Header ====== */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-[#E5E7EB] flex-shrink-0">
        {/* Left: system info */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/tag-systems')}
            className="w-8 h-8 rounded-md hover:bg-[#F3F4F6] flex items-center justify-center transition-colors"
            title="返回列表"
          >
            <ArrowLeft size={16} className="text-[#6B7280]" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#9CA3AF] flex items-center gap-1">
                <span className={cn('w-1.5 h-1.5 rounded-full', statusColors[system.status].dot)} />
                {SYSTEM_STATUS_LABELS[system.status]}
              </span>
              <span className="text-[11px] text-[#9CA3AF]">
                {PURCHASE_PHASE_LABELS[system.scenario.phase]} · {system.scenario.category} · {system.scenario.audience}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {systemNameEditing ? (
                <input
                  autoFocus
                  value={systemNameValue}
                  onChange={(e) => setSystemNameValue(e.target.value)}
                  onBlur={handleSystemRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSystemRename();
                    if (e.key === 'Escape') setSystemNameEditing(false);
                  }}
                  className="text-lg font-semibold text-[#1F2937] bg-[#EFF4FF] border border-[#4F7BF7] rounded px-2 py-0.5 outline-none"
                  style={{ fontSize: '18px', fontWeight: 600 }}
                />
              ) : (
                <h1
                  className="text-lg font-semibold text-[#1F2937] cursor-pointer hover:text-[#4F7BF7] transition-colors flex items-center gap-1.5"
                  onClick={() => { setSystemNameValue(system.name); setSystemNameEditing(true); }}
                >
                  {system.name}
                  <Pencil size={13} className="text-[#9CA3AF] opacity-0 hover:opacity-100 transition-opacity" />
                </h1>
              )}
              {hasChanges && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-[11px] text-[#F59E0B] font-medium"
                >
                  ● 有未保存的更改
                </motion.span>
              )}
              {lastSaved && !hasChanges && (
                <span className="text-[11px] text-[#10B981] flex items-center gap-0.5">
                  <Check size={11} /> 已保存
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => handleSave()}
            disabled={saving || !hasChanges}
          >
            {saving ? <Check size={14} className="mr-1 text-[#10B981]" /> : <Save size={14} className="mr-1" />}
            保存
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye size={14} className="mr-1" />
            预览
          </Button>
          {system.status !== 'published' && (
            <Button
              size="sm"
              className="h-8 text-xs bg-[#10B981] hover:bg-[#059669] text-white"
              onClick={() => setPublishOpen(true)}
            >
              <Rocket size={14} className="mr-1" />
              发布
            </Button>
          )}
          <div className="w-px h-5 bg-[#E5E7EB] mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setLeftPanelOpen((v) => !v)}
            title={leftPanelOpen ? '收起左侧面板' : '展开左侧面板'}
          >
            {leftPanelOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setRightPanelOpen((v) => !v)}
            title={rightPanelOpen ? '收起右侧面板' : '展开右侧面板'}
          >
            {rightPanelOpen ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </Button>
        </div>
      </div>

      {/* ====== Three-panel layout ====== */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Atomic Tag Library */}
        <AnimatePresence initial={false}>
          {leftPanelOpen && (
            <motion.div
              key="left-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
              className="flex-shrink-0 overflow-hidden"
            >
              <AtomicTagPanel
                atomicTags={atomicTags}
                onDragStart={(tag) => setDraggedAtomicTag(tag)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center panel - Tree Canvas */}
        <div className="flex-1 overflow-hidden">
          <TreeCanvas
            systemName={system.name}
            nodes={nodes}
            atomicTags={atomicTags}
            selectedNodeId={selectedNodeId}
            draggedAtomicTag={draggedAtomicTag}
            onSelectNode={setSelectedNodeId}
            onUpdateNodes={handleUpdateNodes}
            onUpdateNode={handleUpdateNode}
            onAddNode={handleAddNode}
            onDeleteNode={handleDeleteNode}
            onLinkAtomicTag={handleLinkAtomicTag}
            onUnlinkAtomicTag={handleUnlinkAtomicTag}
          />
        </div>

        {/* Right panel - Properties */}
        <AnimatePresence initial={false}>
          {rightPanelOpen && (
            <motion.div
              key="right-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
              className="flex-shrink-0 overflow-hidden"
            >
              <PropertiesPanel
                node={selectedNode}
                nodes={nodes}
                atomicTags={atomicTags}
                systemName={system.name}
                onUpdateNode={handleUpdateNode}
                onUnlinkAtomicTag={handleUnlinkAtomicTag}
                onLinkAtomicTag={handleLinkAtomicTag}
                onDeleteNode={handleDeleteNode}
                onClose={() => setSelectedNodeId(null)}
                onNavigateToNode={(nodeId) => setSelectedNodeId(nodeId)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ====== Publish Dialog ====== */}
      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <AlertDialogContent className="max-w-[440px]">
          <AlertDialogHeader className="items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#ECFDF5] flex items-center justify-center mb-2">
              <Rocket size={24} className="text-[#10B981]" />
            </div>
            <AlertDialogTitle className="text-base font-semibold">确认发布标签体系？</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[#6B7280]">
              发布后该标签体系将可用于评论标注任务。请确保节点结构和引用关系已配置完成。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-[#F9FAFB] rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">体系名称</span>
              <span className="font-medium text-[#1F2937]">{system.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">节点总数</span>
              <span className="font-medium text-[#1F2937]">{nodeCount}个</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">已引用原子标签</span>
              <span className="font-medium text-[#1F2937]">{referencedCount}个</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish} className="bg-[#10B981] hover:bg-[#059669] text-white">
              确认发布
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ====== Preview Dialog ====== */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">标签体系预览</DialogTitle>
            <DialogDescription className="text-sm text-[#9CA3AF]">
              {system.name}
            </DialogDescription>
          </DialogHeader>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-[#F9FAFB] rounded-lg p-3 text-center">
              <div className="text-xl font-semibold text-[#1F2937]">{nodeCount}</div>
              <div className="text-xs text-[#9CA3AF]">节点总数</div>
            </div>
            <div className="bg-[#F9FAFB] rounded-lg p-3 text-center">
              <div className="text-xl font-semibold text-[#1F2937]">{referencedCount}</div>
              <div className="text-xs text-[#9CA3AF]">已引用标签</div>
            </div>
            <div className="bg-[#F9FAFB] rounded-lg p-3 text-center">
              <div className="text-xl font-semibold text-[#1F2937]">
                {nodes.filter((n) => n.level === 1).length}
              </div>
              <div className="text-xs text-[#9CA3AF]">一级节点</div>
            </div>
          </div>

          {/* Tree preview */}
          <div className="space-y-2">
            {nodes
              .filter((n) => n.level === 1)
              .sort((a, b) => a.order - b.order)
              .map((root) => (
                <PreviewTreeNode
                  key={root.id}
                  node={root}
                  nodes={nodes}
                  atomicTags={atomicTags}
                  depth={0}
                />
              ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

/* ================================================================== */
/*  Preview Tree Node (recursive, read-only)                           */
/* ================================================================== */

function PreviewTreeNode({
  node,
  nodes,
  atomicTags,
  depth,
}: {
  node: TagNode;
  nodes: TagNode[];
  atomicTags: AtomicTag[];
  depth: number;
}) {
  const children = nodes
    .filter((n) => n.parentId === node.id)
    .sort((a, b) => a.order - b.order);
  const tag = node.atomicTagId
    ? atomicTags.find((t) => t.id === node.atomicTagId)
    : null;

  return (
    <div className={cn('ml-4', depth === 0 && 'ml-0')}>
      <div className="flex items-center gap-2 py-1.5">
        <span
          className={cn(
            'w-2 h-2 rounded-full',
            depth === 0 ? 'bg-[#4F7BF7]' : depth === 1 ? 'bg-[#10B981]' : 'bg-[#D1D5DB]'
          )}
        />
        <span className={cn('text-sm', depth === 0 && 'font-medium text-[#1F2937]')}>
          {node.name}
        </span>
        {tag && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: TAG_CATEGORY_COLORS[tag.category].bg,
              color: TAG_CATEGORY_COLORS[tag.category].text,
            }}
          >
            ◆ {tag.name}
          </span>
        )}
      </div>
      {children.map((child) => (
        <PreviewTreeNode key={child.id} node={child} nodes={nodes} atomicTags={atomicTags} depth={depth + 1} />
      ))}
    </div>
  );
}
