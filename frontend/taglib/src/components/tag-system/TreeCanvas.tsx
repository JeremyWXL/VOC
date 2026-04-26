import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Link2,
  Unlink,
  MoreHorizontal,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  TreePine,
} from 'lucide-react';
import type { TagNode, AtomicTag } from '@/types';
import { TAG_CATEGORY_COLORS } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface TreeCanvasProps {
  systemName: string;
  nodes: TagNode[];
  atomicTags: AtomicTag[];
  selectedNodeId: string | null;
  draggedAtomicTag: AtomicTag | null;
  onSelectNode: (id: string | null) => void;
  onUpdateNodes: (nodes: TagNode[]) => void;
  onUpdateNode: (nodeId: string, updates: Partial<TagNode>) => void;
  onAddNode: (parentId: string | undefined, level: 1 | 2 | 3) => void;
  onDeleteNode: (nodeId: string) => void;
  onLinkAtomicTag: (nodeId: string, tagId: string) => void;
  onUnlinkAtomicTag: (nodeId: string) => void;
}

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/* ================================================================== */
/*  TreeCanvas                                                         */
/* ================================================================== */

export default function TreeCanvas({
  systemName,
  nodes,
  atomicTags,
  selectedNodeId,
  draggedAtomicTag,
  onSelectNode,
  onUpdateNodes,
  onUpdateNode,
  onAddNode,
  onDeleteNode,
  onLinkAtomicTag,
  onUnlinkAtomicTag,
}: TreeCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  /* Keyboard shortcuts */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingNodeId) {
        if (e.key === 'Enter') { e.preventDefault(); finishEdit(); }
        if (e.key === 'Escape') { e.preventDefault(); setEditingNodeId(null); }
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        e.preventDefault();
        onDeleteNode(selectedNodeId);
      }
      if (e.key === 'Enter' && selectedNodeId) {
        e.preventDefault();
        startEdit(selectedNodeId);
      }
      if (e.key === 'Escape') {
        onSelectNode(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId, editingNodeId, onDeleteNode, onSelectNode]);

  /* edit helpers */
  const startEdit = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setEditingNodeId(nodeId);
    setEditValue(node.name);
  }, [nodes]);

  const finishEdit = useCallback(() => {
    if (!editingNodeId) return;
    const trimmed = editValue.trim();
    if (trimmed) {
      onUpdateNode(editingNodeId, { name: trimmed });
    }
    setEditingNodeId(null);
  }, [editingNodeId, editValue, onUpdateNode]);

  /* expand / collapse */
  const toggleExpand = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    onUpdateNode(nodeId, { isExpanded: !node.isExpanded });
  }, [nodes, onUpdateNode]);

  /* reorder siblings */
  const reorderNode = useCallback((nodeId: string, direction: 'up' | 'down') => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const siblings = nodes.filter((n) => n.parentId === node.parentId).sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex((s) => s.id === nodeId);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= siblings.length) return;

    const updated = nodes.map((n) => {
      if (n.id === nodeId) return { ...n, order: siblings[newIdx].order };
      if (n.id === siblings[newIdx].id) return { ...n, order: node.order };
      return n;
    });
    onUpdateNodes(updated);
  }, [nodes, onUpdateNodes]);

  /* drag & drop for atomic tags */
  const handleDragOver = useCallback((e: React.DragEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedAtomicTag) setDropTargetId(nodeId);
  }, [draggedAtomicTag]);

  const handleDragLeave = useCallback(() => {
    setDropTargetId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedAtomicTag) {
      onLinkAtomicTag(nodeId, draggedAtomicTag.id);
      toast.success(`已关联原子标签「${draggedAtomicTag.name}」`);
    }
    setDropTargetId(null);
  }, [draggedAtomicTag, onLinkAtomicTag]);

  /* get children helper */
  const getChildren = useCallback((parentId: string) =>
    nodes.filter((n) => n.parentId === parentId).sort((a, b) => a.order - b.order),
  [nodes]);

  const getReferencedTag = useCallback((atomicTagId?: string) => {
    if (!atomicTagId) return null;
    return atomicTags.find((t) => t.id === atomicTagId) ?? null;
  }, [atomicTags]);

  /* build tree */
  const rootNodes = nodes.filter((n) => n.level === 1).sort((a, b) => a.order - b.order);

  return (
    <div className="h-full flex flex-col bg-[#FAFBFC] relative">
      {/* Dot grid background */}
      <div
        className="absolute inset-0 opacity-[0.35] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #D1D5DB 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* Canvas with zoom */}
      <div className="flex-1 overflow-auto p-8 relative">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', transition: 'transform 200ms ease-out' }}
        >
          {/* Root */}
          <div className="flex flex-col items-center">
            <div className="mb-6 px-6 py-3 bg-white rounded-xl shadow-md border border-[#E5E7EB] flex items-center gap-2">
              <TreePine size={18} className="text-[#4F7BF7]" />
              <span className="text-[15px] font-semibold text-[#1F2937]">{systemName}</span>
              <span className="text-[11px] text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded-full">根节点</span>
            </div>

            {/* Connector line */}
            <div className="w-px h-6 bg-[#D1D5DB] mb-2" />

            {/* Level 1 nodes */}
            <div className="flex gap-6 items-start">
              {rootNodes.map((node) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  selected={selectedNodeId === node.id}
                  editing={editingNodeId === node.id}
                  editDisplayValue={editValue}
                  dropTarget={dropTargetId === node.id}
                  referencedTag={getReferencedTag(node.atomicTagId)}
                  onSelect={() => onSelectNode(node.id)}
                  onToggleExpand={() => toggleExpand(node.id)}
                  onStartEdit={() => startEdit(node.id)}
                  onEditDisplayChange={setEditValue}
                  onFinishEdit={finishEdit}
                  onEditCancel={() => setEditingNodeId(null)}
                  onAddChild={() => onAddNode(node.id, 2)}
                  onDelete={() => onDeleteNode(node.id)}
                  onReorder={(d) => reorderNode(node.id, d)}
                  onLinkTag={(tagId) => onLinkAtomicTag(node.id, tagId)}
                  onUnlinkTag={() => onUnlinkAtomicTag(node.id)}
                  onDragOverCard={(e) => handleDragOver(e, node.id)}
                  onDragLeaveCard={handleDragLeave}
                  onDropCard={(e) => handleDrop(e, node.id)}
                  /* pass down for recursive children */
                  nodes={nodes}
                  atomicTags={atomicTags}
                  selectedNodeId={selectedNodeId}
                  editingNodeId={editingNodeId}
                  dropTargetId={dropTargetId}
                  parentSetEditValue={setEditValue}
                  parentFinishEdit={finishEdit}
                  parentEditCancel={() => setEditingNodeId(null)}
                  onSelectNode={onSelectNode}
                  onToggleExpandNode={toggleExpand}
                  onStartEditNode={startEdit}
                  onAddNode={onAddNode}
                  onDeleteNode={onDeleteNode}
                  onReorderNode={reorderNode}
                  onLinkAtomicTag={onLinkAtomicTag}
                  onUnlinkAtomicTag={onUnlinkAtomicTag}
                  onDragOverNode={handleDragOver}
                  onDragLeaveNode={handleDragLeave}
                  onDropNode={handleDrop}
                  getReferencedTag={getReferencedTag}
                  getChildren={getChildren}
                />
              ))}
            </div>

            {/* Empty state */}
            {rootNodes.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-8 flex flex-col items-center"
              >
                <div className="text-sm text-[#9CA3AF] mb-3">暂无节点，添加一级标签开始构建</div>
                <button
                  onClick={() => onAddNode(undefined, 1)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#4F7BF7] text-white rounded-lg text-sm hover:bg-[#3A63D9] transition-colors"
                >
                  <Plus size={15} /> 添加一级标签
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-md border border-[#E5E7EB] flex items-center">
        <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} className="p-2 hover:bg-[#F3F4F6] rounded-l-lg transition-colors">
          <ZoomOut size={15} className="text-[#6B7280]" />
        </button>
        <span className="text-xs text-[#6B7280] w-12 text-center font-medium">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))} className="p-2 hover:bg-[#F3F4F6] transition-colors">
          <ZoomIn size={15} className="text-[#6B7280]" />
        </button>
        <button onClick={() => setZoom(1)} className="p-2 hover:bg-[#F3F4F6] rounded-r-lg border-l border-[#E5E7EB] transition-colors">
          <RotateCcw size={13} className="text-[#6B7280]" />
        </button>
      </div>

      {/* Floating add root button */}
      {rootNodes.length > 0 && (
        <div className="absolute top-4 right-4">
          <button
            onClick={() => onAddNode(undefined, 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg shadow-md border border-[#E5E7EB] text-xs text-[#4F7BF7] hover:bg-[#EFF4FF] transition-colors"
          >
            <Plus size={13} /> 添加一级标签
          </button>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  NodeCard                                                           */
/* ================================================================== */

interface NodeCardProps {
  node: TagNode;
  selected: boolean;
  editing: boolean;
  editDisplayValue: string;
  dropTarget: boolean;
  referencedTag: AtomicTag | null;
  onSelect: () => void;
  onToggleExpand: () => void;
  onStartEdit: () => void;
  onEditDisplayChange: (v: string) => void;
  onFinishEdit: () => void;
  onEditCancel: () => void;
  onAddChild: () => void;
  onDelete: () => void;
  onReorder: (d: 'up' | 'down') => void;
  onLinkTag: (tagId: string) => void;
  onUnlinkTag: () => void;
  onDragOverCard: (e: React.DragEvent) => void;
  onDragLeaveCard: () => void;
  onDropCard: (e: React.DragEvent) => void;
  /* Parent-passed for recursive children */
  nodes: TagNode[];
  atomicTags: AtomicTag[];
  selectedNodeId: string | null;
  editingNodeId: string | null;
  dropTargetId: string | null;
  parentSetEditValue: (v: string) => void;
  parentFinishEdit: () => void;
  parentEditCancel: () => void;
  onSelectNode: (id: string | null) => void;
  onToggleExpandNode: (id: string) => void;
  onStartEditNode: (id: string) => void;
  onAddNode: (parentId: string | undefined, level: 1 | 2 | 3) => void;
  onDeleteNode: (nodeId: string) => void;
  onReorderNode: (nodeId: string, d: 'up' | 'down') => void;
  onLinkAtomicTag: (nodeId: string, tagId: string) => void;
  onUnlinkAtomicTag: (nodeId: string) => void;
  onDragOverNode: (e: React.DragEvent, nodeId: string) => void;
  onDragLeaveNode: () => void;
  onDropNode: (e: React.DragEvent, nodeId: string) => void;
  getReferencedTag: (id?: string) => AtomicTag | null;
  getChildren: (pid: string) => TagNode[];
}

function NodeCard({
  node,
  selected,
  editing,
  editDisplayValue,
  dropTarget,
  referencedTag,
  onSelect,
  onToggleExpand,
  onStartEdit,
  onEditDisplayChange,
  onFinishEdit,
  onEditCancel,
  onAddChild,
  onDelete,
  onReorder,
  onUnlinkTag,
  onDragOverCard,
  onDragLeaveCard,
  onDropCard,
  nodes,
  atomicTags,
  selectedNodeId,
  editingNodeId,
  dropTargetId,
  parentSetEditValue,
  parentFinishEdit,
  parentEditCancel,
  onSelectNode,
  onToggleExpandNode,
  onStartEditNode,
  onAddNode,
  onDeleteNode,
  onReorderNode,
  onLinkAtomicTag,
  onUnlinkAtomicTag,
  onDragOverNode,
  onDragLeaveNode,
  onDropNode,
  getReferencedTag,
  getChildren,
}: NodeCardProps) {
  const hasChildrenRaw = getChildren(node.id).length > 0;
  const isExpanded = node.isExpanded !== false;

  const levelBadgeColors: Record<number, string> = {
    1: 'bg-[#EFF4FF] text-[#4F7BF7]',
    2: 'bg-[#ECFDF5] text-[#10B981]',
    3: 'bg-[#FEF3C7] text-[#92400E]',
  };

  return (
    <div className="flex flex-col items-center">
      {/* Node card */}
      <motion.div
        layout
        initial={{ opacity: 0, y: 12, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        onClick={onSelect}
        onDragOver={onDragOverCard}
        onDragLeave={onDragLeaveCard}
        onDrop={onDropCard}
        className={cn(
          'relative bg-white rounded-xl shadow-md border min-w-[240px] max-w-[300px] cursor-pointer transition-all duration-150 group',
          selected && !editing && 'border-[#4F7BF7] ring-2 ring-[#4F7BF7]/20 shadow-lg',
          dropTarget && 'border-[#4F7BF7] border-dashed bg-[#EFF4FF]',
          !selected && !dropTarget && 'border-[#E5E7EB] hover:border-[#ADC5FF] hover:shadow-lg',
          editing && 'ring-2 ring-[#4F7BF7]/30',
        )}
      >
        {/* Left accent bar for selected */}
        {selected && !editing && <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r bg-[#4F7BF7]" />}

        <div className="px-4 py-3">
          {/* Top row */}
          <div className="flex items-center gap-2">
            {/* Expand/collapse */}
            {hasChildrenRaw ? (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#F3F4F6] transition-colors flex-shrink-0"
              >
                {isExpanded ? <ChevronDown size={14} className="text-[#9CA3AF]" /> : <ChevronRight size={14} className="text-[#9CA3AF]" />}
              </button>
            ) : (
              <span className="w-5 flex-shrink-0" />
            )}

            {/* Name (edit or display) */}
            {editing ? (
              <input
                autoFocus
                value={editDisplayValue}
                onChange={(e) => onEditDisplayChange(e.target.value)}
                onBlur={onFinishEdit}
                onKeyDown={(e) => { if (e.key === 'Enter') onFinishEdit(); if (e.key === 'Escape') onEditCancel(); }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 text-sm font-medium bg-[#EFF4FF] border border-[#4F7BF7] rounded px-1.5 py-0.5 outline-none min-w-0"
              />
            ) : (
              <span
                className={cn('flex-1 text-sm font-medium truncate', selected ? 'text-[#4F7BF7]' : 'text-[#1F2937]', node.level === 1 && 'text-[15px]')}
                onDoubleClick={(e) => { e.stopPropagation(); onStartEdit(); }}
              >
                {node.name}
              </span>
            )}

            {/* Actions dropdown */}
            {!editing && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button onClick={(e) => e.stopPropagation()} className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#F3F4F6] transition-colors opacity-0 group-hover:opacity-100">
                    <MoreHorizontal size={14} className="text-[#9CA3AF]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {node.level < 3 && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAddChild(); }}>
                      <Plus size={13} className="mr-2" /> 添加子节点
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStartEdit(); }}>
                    <Pencil size={13} className="mr-2" /> 重命名
                  </DropdownMenuItem>
                  {node.atomicTagId ? (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUnlinkTag(); }}>
                      <Unlink size={13} className="mr-2" /> 取消关联
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem disabled>
                      <Link2 size={13} className="mr-2" /> 关联原子标签
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onReorder('up'); }}>
                    <ArrowUp size={13} className="mr-2" /> 上移
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onReorder('down'); }}>
                    <ArrowDown size={13} className="mr-2" /> 下移
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-[#EF4444] focus:text-[#EF4444]">
                    <Trash2 size={13} className="mr-2" /> 删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Bottom row: badges */}
          <div className="flex items-center gap-2 mt-2 pl-7 flex-wrap">
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', levelBadgeColors[node.level])}>
              {node.level === 1 ? '一级' : node.level === 2 ? '二级' : '三级'}
            </span>
            {hasChildrenRaw && <span className="text-[10px] text-[#9CA3AF]">{getChildren(node.id).length}个子节点</span>}
            {referencedTag && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1"
                style={{ backgroundColor: TAG_CATEGORY_COLORS[referencedTag.category].bg, color: TAG_CATEGORY_COLORS[referencedTag.category].text }}
              >
                <span className="text-[8px]">&#9670;</span>
                {referencedTag.name}
              </span>
            )}
          </div>
        </div>

        {/* Quick add child button on hover */}
        {node.level < 3 && !editing && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddChild(); }}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#4F7BF7] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-[#3A63D9] shadow-sm"
            title="添加子节点"
          >
            <Plus size={13} />
          </button>
        )}
      </motion.div>

      {/* Children */}
      <AnimatePresence>
        {hasChildrenRaw && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-visible"
          >
            <div className="w-px h-5 bg-[#D1D5DB] mx-auto" />
            <div className="flex gap-4 items-start">
              {getChildren(node.id).map((child) => (
                <NodeCard
                  key={child.id}
                  node={child}
                  selected={selectedNodeId === child.id}
                  editing={editingNodeId === child.id}
                  editDisplayValue={editDisplayValue}
                  dropTarget={dropTargetId === child.id}
                  referencedTag={getReferencedTag(child.atomicTagId)}
                  onSelect={() => onSelectNode(child.id)}
                  onToggleExpand={() => onToggleExpandNode(child.id)}
                  onStartEdit={() => onStartEditNode(child.id)}
                  onEditDisplayChange={parentSetEditValue}
                  onFinishEdit={parentFinishEdit}
                  onEditCancel={parentEditCancel}
                  onAddChild={() => onAddNode(child.id, 3)}
                  onDelete={() => onDeleteNode(child.id)}
                  onReorder={(d) => onReorderNode(child.id, d)}
                  onLinkTag={(tagId) => onLinkAtomicTag(child.id, tagId)}
                  onUnlinkTag={() => onUnlinkAtomicTag(child.id)}
                  onDragOverCard={(e) => onDragOverNode(e, child.id)}
                  onDragLeaveCard={onDragLeaveNode}
                  onDropCard={(e) => onDropNode(e, child.id)}
                  nodes={nodes}
                  atomicTags={atomicTags}
                  selectedNodeId={selectedNodeId}
                  editingNodeId={editingNodeId}
                  dropTargetId={dropTargetId}
                  parentSetEditValue={parentSetEditValue}
                  parentFinishEdit={parentFinishEdit}
                  parentEditCancel={parentEditCancel}
                  onSelectNode={onSelectNode}
                  onToggleExpandNode={onToggleExpandNode}
                  onStartEditNode={onStartEditNode}
                  onAddNode={onAddNode}
                  onDeleteNode={onDeleteNode}
                  onReorderNode={onReorderNode}
                  onLinkAtomicTag={onLinkAtomicTag}
                  onUnlinkAtomicTag={onUnlinkAtomicTag}
                  onDragOverNode={onDragOverNode}
                  onDragLeaveNode={onDragLeaveNode}
                  onDropNode={onDropNode}
                  getReferencedTag={getReferencedTag}
                  getChildren={getChildren}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
