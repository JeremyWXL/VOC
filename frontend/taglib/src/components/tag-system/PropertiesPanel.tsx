import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Link2, Trash2, Search } from 'lucide-react';
import type { TagNode, AtomicTag } from '@/types';
import { TAG_CATEGORY_COLORS, TAG_CATEGORY_LABELS } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PropertiesPanelProps {
  node: TagNode | null;
  nodes: TagNode[];
  atomicTags: AtomicTag[];
  systemName: string;
  onUpdateNode: (nodeId: string, updates: Partial<TagNode>) => void;
  onUnlinkAtomicTag: (nodeId: string) => void;
  onLinkAtomicTag: (nodeId: string, tagId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onClose: () => void;
  onNavigateToNode: (nodeId: string) => void;
}

export default function PropertiesPanel({
  node,
  nodes,
  atomicTags,
  systemName,
  onUpdateNode,
  onUnlinkAtomicTag,
  onLinkAtomicTag,
  onDeleteNode,
  onClose,
  onNavigateToNode,
}: PropertiesPanelProps) {
  const [linkSearch, setLinkSearch] = useState('');
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  const referencedTag = useMemo(() => {
    if (!node?.atomicTagId) return null;
    return atomicTags.find((t) => t.id === node.atomicTagId) ?? null;
  }, [node, atomicTags]);

  const parentNode = useMemo(() => {
    if (!node?.parentId) return null;
    return nodes.find((n) => n.id === node.parentId) ?? null;
  }, [node, nodes]);

  const children = useMemo(() => {
    if (!node) return [];
    return nodes.filter((n) => n.parentId === node.id).sort((a, b) => a.order - b.order);
  }, [node, nodes]);

  const path = useMemo(() => {
    if (!node) return [];
    const result: TagNode[] = [];
    let current: TagNode | undefined = node;
    while (current) {
      result.unshift(current);
      if (!current.parentId) break;
      current = nodes.find((n) => n.id === current!.parentId);
    }
    return result;
  }, [node, nodes]);

  const availableTags = useMemo(() => {
    let list = atomicTags.filter((t) => t.status === 'active');
    if (linkSearch.trim()) {
      const q = linkSearch.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    // Exclude already referenced tags
    const referencedIds = new Set(nodes.filter((n) => n.atomicTagId && n.id !== node?.id).map((n) => n.atomicTagId));
    return list.filter((t) => !referencedIds.has(t.id));
  }, [atomicTags, linkSearch, nodes, node]);

  if (!node) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[#9CA3AF] p-6">
        <div className="w-16 h-16 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-3">
          <Search size={24} className="text-[#D1D5DB]" />
        </div>
        <p className="text-sm">选择一个节点查看属性</p>
      </div>
    );
  }

  const handleNameSubmit = () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== node.name) {
      onUpdateNode(node.id, { name: trimmed });
    }
    setEditingName(false);
  };

  const levelLabels: Record<number, string> = { 1: '一级节点', 2: '二级节点', 3: '三级节点' };
  const levelBadgeColors: Record<number, string> = {
    1: 'bg-[#EFF4FF] text-[#4F7BF7]',
    2: 'bg-[#ECFDF5] text-[#10B981]',
    3: 'bg-[#FEF3C7] text-[#92400E]',
  };

  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 20, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="h-full flex flex-col bg-white border-l border-[#E5E7EB]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
        <div>
          <h3 className="text-sm font-semibold text-[#1F2937]">节点属性</h3>
          {path.length > 1 && (
            <div className="text-[11px] text-[#9CA3AF] mt-0.5 truncate max-w-[240px]">
              {systemName}
              {path.slice(0, -1).map((p) => (
                <span key={p.id}> <span className="mx-0.5">&gt;</span> {p.name}</span>
              ))}
            </div>
          )}
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-md hover:bg-[#F3F4F6] flex items-center justify-center transition-colors">
          <X size={15} className="text-[#9CA3AF]" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Node name */}
        <div>
          <label className="block text-xs font-medium text-[#6B7280] mb-1.5">节点名称</label>
          {editingName ? (
            <Input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSubmit();
                if (e.key === 'Escape') setEditingName(false);
              }}
              className="h-8 text-sm"
            />
          ) : (
            <div
              onClick={() => { setNameValue(node.name); setEditingName(true); }}
              className="text-sm font-medium text-[#1F2937] px-3 py-1.5 rounded-md border border-[#E5E7EB] cursor-pointer hover:border-[#4F7BF7] hover:bg-[#FAFBFC] transition-colors truncate"
            >
              {node.name}
            </div>
          )}
        </div>

        {/* Level */}
        <div>
          <label className="block text-xs font-medium text-[#6B7280] mb-1.5">节点层级</label>
          <span className={`inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full ${levelBadgeColors[node.level]}`}>
            {levelLabels[node.level]}
          </span>
        </div>

        {/* Parent */}
        {parentNode && (
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1.5">父节点</label>
            <button
              onClick={() => onNavigateToNode(parentNode.id)}
              className="text-sm text-[#4F7BF7] hover:underline"
            >
              {parentNode.name}
            </button>
          </div>
        )}

        {/* Atomic tag reference */}
        <div>
          <label className="block text-xs font-medium text-[#6B7280] mb-1.5">原子标签引用</label>
          {referencedTag ? (
            <div
              className="rounded-lg p-3 border"
              style={{
                backgroundColor: TAG_CATEGORY_COLORS[referencedTag.category].bg + '80',
                borderColor: TAG_CATEGORY_COLORS[referencedTag.category].bg,
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: TAG_CATEGORY_COLORS[referencedTag.category].text }}
                  />
                  <span className="text-sm font-medium" style={{ color: TAG_CATEGORY_COLORS[referencedTag.category].text }}>
                    {referencedTag.name}
                  </span>
                </div>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: TAG_CATEGORY_COLORS[referencedTag.category].bg,
                    color: TAG_CATEGORY_COLORS[referencedTag.category].text,
                  }}
                >
                  {TAG_CATEGORY_LABELS[referencedTag.category]}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => { setShowLinkPicker(true); setLinkSearch(''); }}
                  className="text-[11px] text-[#4F7BF7] hover:underline"
                >
                  更换
                </button>
                <button
                  onClick={() => onUnlinkAtomicTag(node.id)}
                  className="text-[11px] text-[#EF4444] hover:underline"
                >
                  解除引用
                </button>
              </div>
            </div>
          ) : showLinkPicker ? (
            <div className="border border-[#E5E7EB] rounded-lg p-2">
              <div className="relative mb-2">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <Input
                  placeholder="搜索标签..."
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                  className="h-7 text-xs pl-7"
                  autoFocus
                />
              </div>
              <div className="max-h-[180px] overflow-y-auto space-y-0.5">
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      onLinkAtomicTag(node.id, tag.id);
                      setShowLinkPicker(false);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#F3F4F6] text-left transition-colors"
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: TAG_CATEGORY_COLORS[tag.category].text }}
                    />
                    <span className="text-xs text-[#374151] flex-1">{tag.name}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: TAG_CATEGORY_COLORS[tag.category].bg,
                        color: TAG_CATEGORY_COLORS[tag.category].text,
                      }}
                    >
                      {TAG_CATEGORY_LABELS[tag.category]}
                    </span>
                  </button>
                ))}
                {availableTags.length === 0 && (
                  <div className="text-center py-3 text-xs text-[#9CA3AF]">无可用标签</div>
                )}
              </div>
              <button
                onClick={() => setShowLinkPicker(false)}
                className="mt-1 text-[11px] text-[#9CA3AF] hover:text-[#6B7280]"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setShowLinkPicker(true); setLinkSearch(''); }}
              className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-[#D1D5DB] rounded-lg text-xs text-[#6B7280] hover:border-[#4F7BF7] hover:text-[#4F7BF7] hover:bg-[#EFF4FF] transition-colors"
            >
              <Link2 size={13} />
              引用原子标签
            </button>
          )}
        </div>

        {/* Children list (for level 1 & 2) */}
        {children.length > 0 && node.level < 3 && (
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1.5">
              子节点 ({children.length}个)
            </label>
            <div className="space-y-1">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => onNavigateToNode(child.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#F3F4F6] text-left transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D1D5DB]" />
                  <span className="text-xs text-[#374151] flex-1 truncate">{child.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[#E5E7EB]">
        <Button
          variant="outline"
          className="w-full text-[#EF4444] border-[#FCA5A5] hover:bg-[#FEF2F2] hover:text-[#EF4444]"
          onClick={() => onDeleteNode(node.id)}
        >
          <Trash2 size={14} className="mr-1.5" />
          删除此节点
        </Button>
      </div>
    </motion.div>
  );
}
