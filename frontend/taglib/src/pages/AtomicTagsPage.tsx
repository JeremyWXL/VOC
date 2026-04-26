import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Upload,
  Search,
  RefreshCw,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  AlertTriangle,
  Scissors,
  ArrowRight,
  FolderTree,
  CheckSquare,
  Square,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import {
  type AtomicTag,
  type TagCategory,
  type TagStatus,
  type TagSystem,
  type TagNode,
  type SyncRecord,
  TAG_CATEGORY_LABELS,
  TAG_CATEGORY_COLORS,
  TAG_STATUS_LABELS,
  CHANGE_TYPE_LABELS,
} from '@/types';
import { EmptyTagIcon } from '@/components/icons';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

/* ───────────────────── animation helpers ───────────────────── */
const easeOut = [0.4, 0, 0.2, 1] as [number, number, number, number];

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: easeOut } },
};

/* ───────────────────── category helpers ───────────────────── */
const CATEGORIES: TagCategory[] = [
  'quality',
  'logistics',
  'price',
  'service',
  'experience',
  'packaging',
  'other',
];



/* ───────────────────── format date ───────────────────── */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ───────────────────── relative time ───────────────────── */
function relativeTime(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return formatDate(iso);
}

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */
export default function AtomicTagsPage() {
  const {
    atomicTags,
    tagSystems,
    tagTrees,
    syncRecords,
    addAtomicTag,
    updateAtomicTag,
    deleteAtomicTag,
    splitAtomicTag,
    refreshData,
  } = useData();

  /* ── local state ── */
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TagCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TagStatus>('all');
  const [sortBy, setSortBy] = useState<'updatedAt' | 'usageCount' | 'name' | 'createdAt'>('updatedAt');
  const [sortDesc, setSortDesc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkBar, setShowBulkBar] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTag, setEditTag] = useState<AtomicTag | null>(null);
  const [deleteTag, setDeleteTag] = useState<AtomicTag | null>(null);
  const [splitTag, setSplitTag] = useState<AtomicTag | null>(null);
  const [detailTag, setDetailTag] = useState<AtomicTag | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  /* ── derived: filtered & sorted data ── */
  const filtered = useMemo(() => {
    let data = [...atomicTags];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter(
        (t) => t.name.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== 'all') {
      data = data.filter((t) => t.category === categoryFilter);
    }

    if (statusFilter !== 'all') {
      data = data.filter((t) => t.status === statusFilter);
    }

    data.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name, 'zh');
      else if (sortBy === 'usageCount') cmp = a.usageCount - b.usageCount;
      else if (sortBy === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sortDesc ? -cmp : cmp;
    });

    return data;
  }, [atomicTags, search, categoryFilter, statusFilter, sortBy, sortDesc]);

  /* ── pagination ── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPageSafe - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPageSafe, pageSize]);

  /* ── stats ── */
  const stats = useMemo(() => {
    const total = atomicTags.length;
    const quality = atomicTags.filter((t) => t.category === 'quality').length;
    const logistics = atomicTags.filter((t) => t.category === 'logistics').length;
    const price = atomicTags.filter((t) => t.category === 'price').length;
    return { total, quality, logistics, price };
  }, [atomicTags]);

  /* ── handlers ── */
  const clearFilters = useCallback(() => {
    setSearch('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setSortBy('updatedAt');
    setSortDesc(true);
    setCurrentPage(1);
  }, []);

  const toggleSelectAll = useCallback(() => {
    const pageIds = paginated.map((t) => t.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) {
      pageIds.forEach((id) => next.delete(id));
    } else {
      pageIds.forEach((id) => next.add(id));
    }
    setSelectedIds(next);
    setShowBulkBar(next.size > 0);
  }, [paginated, selectedIds]);

  const toggleSelectRow = useCallback(
    (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedIds(next);
      setShowBulkBar(next.size > 0);
    },
    [selectedIds]
  );

  const handleBulkEnable = useCallback(() => {
    selectedIds.forEach((id) => updateAtomicTag(id, { status: 'active' }));
    setSelectedIds(new Set());
    setShowBulkBar(false);
  }, [selectedIds, updateAtomicTag]);

  const handleBulkDisable = useCallback(() => {
    selectedIds.forEach((id) => updateAtomicTag(id, { status: 'disabled' }));
    setSelectedIds(new Set());
    setShowBulkBar(false);
  }, [selectedIds, updateAtomicTag]);

  const handleBulkDelete = useCallback(() => {
    selectedIds.forEach((id) => deleteAtomicTag(id));
    setSelectedIds(new Set());
    setShowBulkBar(false);
  }, [selectedIds, deleteAtomicTag]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setShowBulkBar(false);
  }, []);

  const handleCreate = useCallback(
    (form: { name: string; category: TagCategory; description: string; status: TagStatus }) => {
      addAtomicTag(form);
      setCreateOpen(false);
    },
    [addAtomicTag]
  );

  const handleEdit = useCallback(
    (id: string, form: { name: string; category: TagCategory; description: string; status: TagStatus }) => {
      updateAtomicTag(id, form);
      setEditTag(null);
    },
    [updateAtomicTag]
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteAtomicTag(id);
      setDeleteTag(null);
    },
    [deleteAtomicTag]
  );

  const handleSplit = useCallback(
    (id: string, newTags: Array<{ name: string; category: TagCategory; description: string; status: TagStatus }>) => {
      splitAtomicTag(
        id,
        newTags.map((t) => ({ ...t }))
      );
      setSplitTag(null);
    },
    [splitAtomicTag]
  );

  const isAllPageSelected = paginated.length > 0 && paginated.every((t) => selectedIds.has(t.id));
  const isSomePageSelected = paginated.some((t) => selectedIds.has(t.id));

  /* ═══════════════════════ render ═══════════════════════ */
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: easeOut }}
      className="max-w-[1440px] mx-auto"
    >
      {/* ═══════════ Page Header ═══════════ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: easeOut }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6"
      >
        <div>
          <h1 className="text-[28px] font-semibold text-[#111827] tracking-tight leading-tight">
            原子标签管理
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            管理最小可复用的标签单元，原子标签的变更将自动同步至所有引用的标签体系
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05, duration: 0.25 }}
          className="flex items-center gap-3"
        >
          <Button
            variant="outline"
            className="h-9 px-4 text-sm gap-2"
            onClick={() => setImportOpen(true)}
          >
            <Upload size={15} />
            批量导入
          </Button>
          <Button
            className="h-9 px-4 text-sm gap-2 bg-[#4F7BF7] hover:bg-[#3A63D9] text-white"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={15} />
            新建原子标签
          </Button>
        </motion.div>
      </motion.div>

      {/* ═══════════ Stats Cards ═══════════ */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="flex flex-wrap gap-3 mb-4"
      >
        <StatCard
          label="全部标签"
          count={stats.total}
          dotColor="#9CA3AF"
          selected={categoryFilter === 'all'}
          onClick={() => { setCategoryFilter('all'); setCurrentPage(1); }}
        />
        <StatCard
          label="质量类"
          count={stats.quality}
          dotColor={TAG_CATEGORY_COLORS.quality.text}
          selected={categoryFilter === 'quality'}
          onClick={() => { setCategoryFilter('quality'); setCurrentPage(1); }}
        />
        <StatCard
          label="物流类"
          count={stats.logistics}
          dotColor={TAG_CATEGORY_COLORS.logistics.text}
          selected={categoryFilter === 'logistics'}
          onClick={() => { setCategoryFilter('logistics'); setCurrentPage(1); }}
        />
        <StatCard
          label="价格类"
          count={stats.price}
          dotColor={TAG_CATEGORY_COLORS.price.text}
          selected={categoryFilter === 'price'}
          onClick={() => { setCategoryFilter('price'); setCurrentPage(1); }}
        />
      </motion.div>

      {/* ═══════════ Filter & Search Bar ═══════════ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.25 }}
        className="bg-white rounded-xl shadow-md px-5 py-4 mb-4 flex flex-wrap items-center gap-3"
      >
        {/* Search */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none"
          />
          <Input
            ref={searchRef}
            placeholder="搜索标签名称..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className={cn(
              'pl-9 h-9 text-sm border-[#D1D5DB] rounded-lg transition-all duration-200',
              searchFocused ? 'w-[360px]' : 'w-[280px]'
            )}
          />
        </div>

        {/* Category Filter */}
        <Select
          value={categoryFilter}
          onValueChange={(v) => { setCategoryFilter(v as TagCategory | 'all'); setCurrentPage(1); }}
        >
          <SelectTrigger className="h-9 w-[140px] text-sm border-[#D1D5DB] rounded-lg">
            <SelectValue placeholder="全部分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {TAG_CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v as 'all' | TagStatus); setCurrentPage(1); }}
        >
          <SelectTrigger className="h-9 w-[120px] text-sm border-[#D1D5DB] rounded-lg">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="active">启用</SelectItem>
            <SelectItem value="disabled">停用</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select
          value={`${sortBy}-${sortDesc ? 'desc' : 'asc'}`}
          onValueChange={(v) => {
            const [field, order] = v.split('-');
            setSortBy(field as typeof sortBy);
            setSortDesc(order === 'desc');
          }}
        >
          <SelectTrigger className="h-9 w-[160px] text-sm border-[#D1D5DB] rounded-lg">
            <SlidersHorizontal size={14} className="mr-1 text-[#9CA3AF]" />
            <SelectValue placeholder="排序方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updatedAt-desc">最近更新</SelectItem>
            <SelectItem value="updatedAt-asc">最早更新</SelectItem>
            <SelectItem value="usageCount-desc">引用最多</SelectItem>
            <SelectItem value="usageCount-asc">引用最少</SelectItem>
            <SelectItem value="name-asc">名称 A-Z</SelectItem>
            <SelectItem value="name-desc">名称 Z-A</SelectItem>
            <SelectItem value="createdAt-desc">最近创建</SelectItem>
            <SelectItem value="createdAt-asc">最早创建</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {/* Clear filters */}
        {(search || categoryFilter !== 'all' || statusFilter !== 'all') && (
          <Button variant="ghost" className="h-9 text-sm text-[#4F7BF7]" onClick={clearFilters}>
            清除筛选
          </Button>
        )}

        {/* Refresh */}
        <Button variant="ghost" className="h-9 w-9 p-0 text-[#6B7280]" onClick={refreshData} aria-label="刷新">
          <RefreshCw size={16} />
        </Button>
      </motion.div>

      {/* ═══════════ Data Table ═══════════ */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F3F4F6] hover:bg-[#F3F4F6] h-11">
                <TableHead className="w-[44px] px-3">
                  <button
                    className="flex items-center justify-center"
                    onClick={toggleSelectAll}
                    aria-label={isAllPageSelected ? '取消全选' : '全选'}
                  >
                    {isAllPageSelected ? (
                      <CheckSquare size={18} className="text-[#4F7BF7]" />
                    ) : isSomePageSelected ? (
                      <div className="relative">
                        <Square size={18} className="text-[#4F7BF7]" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-2 h-2 bg-[#4F7BF7] rounded-sm" />
                        </div>
                      </div>
                    ) : (
                      <Square size={18} className="text-[#D1D5DB]" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="text-xs text-[#4B5563] font-medium px-4">标签名称</TableHead>
                <TableHead className="text-xs text-[#4B5563] font-medium px-4 w-[140px]">分类</TableHead>
                <TableHead className="text-xs text-[#4B5563] font-medium px-4">描述</TableHead>
                <TableHead className="text-xs text-[#4B5563] font-medium px-4 w-[120px]">引用次数</TableHead>
                <TableHead className="text-xs text-[#4B5563] font-medium px-4 w-[110px]">状态</TableHead>
                <TableHead className="text-xs text-[#4B5563] font-medium px-4 w-[140px]">创建时间</TableHead>
                <TableHead className="text-xs text-[#4B5563] font-medium px-4 w-[60px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-[300px] text-center">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                    >
                      <EmptyTagIcon className="mx-auto mb-4 opacity-40" />
                      <p className="text-[#1F2937] font-medium text-lg mb-1">
                        {search || categoryFilter !== 'all' || statusFilter !== 'all'
                          ? '没有找到匹配的标签'
                          : '暂无原子标签'}
                      </p>
                      <p className="text-sm text-[#9CA3AF] mb-4">
                        {search || categoryFilter !== 'all' || statusFilter !== 'all'
                          ? '尝试调整筛选条件'
                          : '点击上方「新建原子标签」创建第一个标签'}
                      </p>
                      {(search || categoryFilter !== 'all' || statusFilter !== 'all') && (
                        <Button variant="outline" className="text-sm" onClick={clearFilters}>
                          清除筛选条件
                        </Button>
                      )}
                    </motion.div>
                  </TableCell>
                </TableRow>
              ) : (
                <AnimatePresence mode="popLayout">
                  {paginated.map((tag, i) => (
                    <motion.tr
                      key={tag.id}
                      layout
                      variants={staggerItem}
                      initial="hidden"
                      animate="show"
                      exit={{ opacity: 0, y: -5, transition: { duration: 0.15 } }}
                      custom={i}
                      className={cn(
                        'h-[52px] border-b border-[#F3F4F6] transition-colors duration-100 hover:bg-[#F9FAFB] group',
                        selectedIds.has(tag.id) && 'bg-[#EFF4FF]'
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-3">
                        <button
                          className="flex items-center justify-center"
                          onClick={() => toggleSelectRow(tag.id)}
                          aria-label={selectedIds.has(tag.id) ? '取消选择' : '选择'}
                        >
                          {selectedIds.has(tag.id) ? (
                            <CheckSquare size={18} className="text-[#4F7BF7]" />
                          ) : (
                            <Square size={18} className="text-[#D1D5DB] group-hover:text-[#9CA3AF]" />
                          )}
                        </button>
                      </td>

                      {/* Tag Name */}
                      <td className="px-4">
                        <button
                          className="text-left"
                          onClick={() => setDetailTag(tag)}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: TAG_CATEGORY_COLORS[tag.category].text }}
                            />
                            <span className="text-sm font-medium text-[#1F2937]">{tag.name}</span>
                          </div>
                          <div className="text-[11px] text-[#9CA3AF] mt-0.5 pl-4">
                            创建于 {formatDate(tag.createdAt)}
                          </div>
                        </button>
                      </td>

                      {/* Category */}
                      <td className="px-4">
                        <Badge
                          className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border-0"
                          style={{
                            backgroundColor: TAG_CATEGORY_COLORS[tag.category].bg,
                            color: TAG_CATEGORY_COLORS[tag.category].text,
                          }}
                        >
                          {TAG_CATEGORY_LABELS[tag.category]}
                        </Badge>
                      </td>

                      {/* Description */}
                      <td className="px-4">
                        <span className="text-sm text-[#4B5563] truncate block max-w-[240px]">
                          {tag.description || '-'}
                        </span>
                      </td>

                      {/* Usage Count */}
                      <td className="px-4">
                        <button
                          className="text-left"
                          onClick={() => setDetailTag(tag)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.min(100, (tag.usageCount / Math.max(...atomicTags.map((t) => t.usageCount), 1)) * 100)}%`,
                                  backgroundColor: tag.usageCount > 0 ? '#4F7BF7' : '#E5E7EB',
                                }}
                              />
                            </div>
                            <span className={cn(
                              'text-sm font-medium',
                              tag.usageCount > 0 ? 'text-[#1F2937]' : 'text-[#9CA3AF]'
                            )}>
                              {tag.usageCount}
                            </span>
                          </div>
                        </button>
                      </td>

                      {/* Status */}
                      <td className="px-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={tag.status === 'active'}
                            onCheckedChange={(checked) =>
                              updateAtomicTag(tag.id, { status: checked ? 'active' : 'disabled' })
                            }
                            className="data-[state=checked]:bg-[#4F7BF7]"
                          />
                          <span
                            className={cn(
                              'text-xs',
                              tag.status === 'active' ? 'text-[#065F46]' : 'text-[#9CA3AF]'
                            )}
                          >
                            {TAG_STATUS_LABELS[tag.status]}
                          </span>
                        </div>
                      </td>

                      {/* Created At */}
                      <td className="px-4 text-sm text-[#6B7280]">
                        {relativeTime(tag.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-4">
                        <div className="relative group/action">
                          <ActionMenu
                            onEdit={() => setEditTag(tag)}
                            onDelete={() => setDeleteTag(tag)}
                            onViewDetail={() => setDetailTag(tag)}
                            onSplit={() => setSplitTag(tag)}
                          />
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#F3F4F6]">
            <div className="text-sm text-[#6B7280]">
              共 <span className="font-medium text-[#1F2937]">{filtered.length}</span> 条
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}
              >
                <SelectTrigger className="h-8 w-[100px] text-xs border-[#D1D5DB]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50].map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      每页 {s} 条
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1 ml-2">
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-md border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-40"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPageSafe <= 1}
                  aria-label="上一页"
                >
                  <ChevronLeft size={15} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={cn(
                      'w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors',
                      p === currentPageSafe
                        ? 'bg-[#4F7BF7] text-white'
                        : 'text-[#6B7280] hover:bg-[#F3F4F6]'
                    )}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-md border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-40"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPageSafe >= totalPages}
                  aria-label="下一页"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════ Bulk Operations Bar ═══════════ */}
      <AnimatePresence>
        {showBulkBar && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: easeOut }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#1F2937] text-white rounded-xl px-5 py-2.5 flex items-center gap-4 shadow-xl"
          >
            <span className="text-sm">
              已选择 <span className="font-semibold">{selectedIds.size}</span> 项
            </span>
            <div className="w-px h-5 bg-[#374151]" />
            <button
              className="text-sm px-3 py-1.5 rounded-md hover:bg-[#374151] transition-colors flex items-center gap-1.5"
              onClick={handleBulkEnable}
            >
              <CheckSquare size={14} />
              批量启用
            </button>
            <button
              className="text-sm px-3 py-1.5 rounded-md hover:bg-[#374151] transition-colors flex items-center gap-1.5"
              onClick={handleBulkDisable}
            >
              <X size={14} />
              批量停用
            </button>
            <button
              className="text-sm px-3 py-1.5 rounded-md hover:bg-[#374151] transition-colors flex items-center gap-1.5 text-[#FCA5A5]"
              onClick={handleBulkDelete}
            >
              <Trash2 size={14} />
              批量删除
            </button>
            <button
              className="ml-2 w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#374151] text-[#9CA3AF]"
              onClick={clearSelection}
              aria-label="关闭"
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════ Modals ═══════════ */}
      <CreateEditModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
      />
      <CreateEditModal
        open={editTag !== null}
        onClose={() => setEditTag(null)}
        onSave={(form) => editTag && handleEdit(editTag.id, form)}
        tag={editTag}
      />
      <DeleteModal
        open={deleteTag !== null}
        onClose={() => setDeleteTag(null)}
        onConfirm={() => deleteTag && handleDelete(deleteTag.id)}
        tag={deleteTag}
      />
      <SplitModal
        open={splitTag !== null}
        onClose={() => setSplitTag(null)}
        onSplit={(newTags) => splitTag && handleSplit(splitTag.id, newTags)}
        tag={splitTag}
      />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      {/* ═══════════ Detail Drawer ═══════════ */}
      <DetailDrawer
        tag={detailTag}
        onClose={() => setDetailTag(null)}
        tagSystems={tagSystems}
        tagTrees={tagTrees}
        syncRecords={syncRecords}
        onEdit={(tag) => { setDetailTag(null); setEditTag(tag); }}
      />
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   StatCard
   ═══════════════════════════════════════════════════════════ */
function StatCard({
  label,
  count,
  dotColor,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  dotColor: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -2, boxShadow: '0 8px 12px -2px rgba(0,0,0,0.1)' }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cn(
        'cursor-pointer select-none bg-white rounded-xl shadow-md px-5 py-4 flex flex-col min-w-[120px] transition-all duration-150 border-2',
        selected ? 'border-[#4F7BF7] bg-[#EFF4FF]' : 'border-transparent'
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
        <span className="text-[12px] text-[#6B7280]">{label}</span>
      </div>
      <span className="text-[22px] font-semibold text-[#111827] leading-tight">{count}</span>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ActionMenu
   ═══════════════════════════════════════════════════════════ */
function ActionMenu({
  onEdit,
  onDelete,
  onViewDetail,
  onSplit,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onViewDetail: () => void;
  onSplit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="w-8 h-8 flex items-center justify-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
        onClick={() => setOpen(!open)}
        aria-label="更多操作"
      >
        <MoreVertical size={16} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: easeOut }}
            style={{ originX: 1, originY: 0 }}
            className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-1 z-30"
          >
            <button
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB] transition-colors"
              onClick={() => { onEdit(); setOpen(false); }}
            >
              <Pencil size={14} className="text-[#6B7280]" />
              编辑
            </button>
            <button
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB] transition-colors"
              onClick={() => { onSplit(); setOpen(false); }}
            >
              <Scissors size={14} className="text-[#6B7280]" />
              拆分标签
            </button>
            <button
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB] transition-colors"
              onClick={() => { onViewDetail(); setOpen(false); }}
            >
              <Eye size={14} className="text-[#6B7280]" />
              查看引用详情
            </button>
            <div className="my-1 h-px bg-[#F3F4F6]" />
            <button
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
              onClick={() => { onDelete(); setOpen(false); }}
            >
              <Trash2 size={14} className="text-[#EF4444]" />
              删除
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CreateEditModal
   ═══════════════════════════════════════════════════════════ */
function CreateEditModal({
  open,
  onClose,
  onSave,
  tag,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (form: { name: string; category: TagCategory; description: string; status: TagStatus }) => void;
  tag?: AtomicTag | null;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TagCategory>('quality');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TagStatus>('active');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEdit = !!tag;

  useEffect(() => {
    if (open && tag) {
      setName(tag.name);
      setCategory(tag.category);
      setDescription(tag.description ?? '');
      setStatus(tag.status);
      setErrors({});
    } else if (open) {
      setName('');
      setCategory('quality');
      setDescription('');
      setStatus('active');
      setErrors({});
    }
  }, [open, tag]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = '请输入标签名称';
    else if (name.trim().length > 20) e.name = '最多20个字符';
    if (!category) e.category = '请选择分类';
    if (description.length > 200) e.description = '最多200个字符';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({ name: name.trim(), category, description: description.trim(), status });
    if (!isEdit) {
      setName('');
      setCategory('quality');
      setDescription('');
      setStatus('active');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[560px] p-0 overflow-hidden rounded-xl">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="text-lg font-semibold text-[#1F2937]">
            {isEdit ? '编辑原子标签' : '新建原子标签'}
          </DialogTitle>
        </DialogHeader>

        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
          className="px-6 pb-6 space-y-4"
        >
          {/* Name */}
          <motion.div variants={staggerItem}>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              标签名称 <span className="text-[#EF4444]">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：质量好"
              className={cn('h-9 rounded-lg', errors.name && 'border-[#EF4444] bg-[#FEF2F2]')}
            />
            {errors.name && <p className="text-xs text-[#EF4444] mt-1">{errors.name}</p>}
          </motion.div>

          {/* Category */}
          <motion.div variants={staggerItem}>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              标签分类 <span className="text-[#EF4444]">*</span>
            </label>
            <Select value={category} onValueChange={(v) => setCategory(v as TagCategory)}>
              <SelectTrigger className={cn('h-9 rounded-lg', errors.category && 'border-[#EF4444] bg-[#FEF2F2]')}>
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {TAG_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-xs text-[#EF4444] mt-1">{errors.category}</p>}
            <p className="text-xs text-[#9CA3AF] mt-1">
              分类决定标签的语义归属，创建后可在标签体系中引用
            </p>
          </motion.div>

          {/* Description */}
          <motion.div variants={staggerItem}>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">描述说明</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="补充说明该标签的含义和使用场景..."
              rows={3}
              className={cn('rounded-lg resize-none text-sm', errors.description && 'border-[#EF4444] bg-[#FEF2F2]')}
            />
            <div className="flex justify-between mt-1">
              {errors.description ? (
                <p className="text-xs text-[#EF4444]">{errors.description}</p>
              ) : (
                <span />
              )}
              <span className="text-[11px] text-[#9CA3AF]">{description.length}/200</span>
            </div>
          </motion.div>

          {/* Status */}
          <motion.div variants={staggerItem}>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">标签状态</label>
            <div className="flex items-center gap-3">
              <Switch
                checked={status === 'active'}
                onCheckedChange={(checked) => setStatus(checked ? 'active' : 'disabled')}
                className="data-[state=checked]:bg-[#4F7BF7]"
              />
              <span className="text-sm text-[#374151]">{status === 'active' ? '启用' : '停用'}</span>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-1">
              停用后该标签在标签体系中将显示为灰显状态
            </p>
          </motion.div>

          {/* Actions */}
          <motion.div variants={staggerItem} className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" className="h-9 px-5 text-sm rounded-md" onClick={onClose}>
              取消
            </Button>
            {!isEdit && (
              <Button
                variant="outline"
                className="h-9 px-5 text-sm rounded-md"
                onClick={() => {
                  if (!validate()) return;
                  onSave({ name: name.trim(), category, description: description.trim(), status });
                  setName('');
                  setCategory('quality');
                  setDescription('');
                  setStatus('active');
                }}
              >
                保存并继续创建
              </Button>
            )}
            <Button
              className="h-9 px-5 text-sm rounded-md bg-[#4F7BF7] hover:bg-[#3A63D9] text-white"
              onClick={handleSave}
            >
              保存
            </Button>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════
   DeleteModal
   ═══════════════════════════════════════════════════════════ */
function DeleteModal({
  open,
  onClose,
  onConfirm,
  tag,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  tag: AtomicTag | null;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (open) setConfirmed(false);
  }, [open]);

  const handleConfirm = () => {
    if (!confirmed) {
      setShake(true);
      setTimeout(() => setShake(false), 300);
      return;
    }
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[400px] p-0 overflow-hidden rounded-xl">
        <motion.div
          animate={shake ? { x: [0, -4, 4, -4, 4, 0] } : {}}
          transition={{ duration: 0.3 }}
          className="px-6 pt-6 pb-6 text-center"
        >
          <AlertTriangle size={48} className="mx-auto text-[#EF4444] mb-4" />
          <DialogTitle className="text-lg font-semibold text-[#1F2937] mb-2">
            确认删除标签？
          </DialogTitle>
          <DialogDescription className="text-sm text-[#6B7280] mb-4">
            删除后将无法恢复，且引用该标签的标签体系中相关节点将被标记为「引用失效」。
            {tag && tag.usageCount > 0 && (
              <span className="block mt-2">
                此操作影响 <span className="font-semibold text-[#EF4444]">{tag.usageCount}</span> 个标签体系中的相关节点。
              </span>
            )}
          </DialogDescription>

          <Badge className="bg-[#FEF2F2] text-[#EF4444] hover:bg-[#FEF2F2] rounded-full text-[11px] font-medium mb-5">
            影响 {tag?.usageCount ?? 0} 个体系
          </Badge>

          <label className="flex items-start gap-2.5 text-left px-2 mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[#D1D5DB] text-[#4F7BF7] accent-[#4F7BF7]"
            />
            <span className="text-sm text-[#4B5563]">
              我了解删除的影响并确认删除
            </span>
          </label>

          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" className="h-9 px-5 text-sm rounded-md" onClick={onClose}>
              取消
            </Button>
            <Button
              className={cn(
                'h-9 px-5 text-sm rounded-md text-white',
                confirmed
                  ? 'bg-[#EF4444] hover:bg-[#DC2626]'
                  : 'bg-[#FCA5A5] cursor-not-allowed'
              )}
              onClick={handleConfirm}
              disabled={!confirmed}
            >
              确认删除
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════
   SplitModal
   ═══════════════════════════════════════════════════════════ */
function SplitModal({
  open,
  onClose,
  onSplit,
  tag,
}: {
  open: boolean;
  onClose: () => void;
  onSplit: (newTags: Array<{ name: string; category: TagCategory; description: string; status: TagStatus }>) => void;
  tag: AtomicTag | null;
}) {
  const [tag1, setTag1] = useState({ name: '', category: 'quality' as TagCategory, description: '', status: 'active' as TagStatus });
  const [tag2, setTag2] = useState({ name: '', category: 'quality' as TagCategory, description: '', status: 'active' as TagStatus });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && tag) {
      setTag1({ name: `${tag.name}（非常）`, category: tag.category, description: '', status: 'active' });
      setTag2({ name: `${tag.name}（一般）`, category: tag.category, description: '', status: 'active' });
      setErrors({});
    }
  }, [open, tag]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!tag1.name.trim()) e.tag1 = '请输入第一个标签名称';
    if (!tag2.name.trim()) e.tag2 = '请输入第二个标签名称';
    if (tag1.name.trim() === tag2.name.trim()) e.tag2 = '两个标签名称不能相同';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSplit = () => {
    if (!validate()) return;
    onSplit([
      { name: tag1.name.trim(), category: tag1.category, description: tag1.description, status: tag1.status },
      { name: tag2.name.trim(), category: tag2.category, description: tag2.description, status: tag2.status },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[640px] p-0 overflow-hidden rounded-xl">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="text-lg font-semibold text-[#1F2937]">
            拆分标签「{tag?.name}」
          </DialogTitle>
          <DialogDescription className="text-sm text-[#6B7280]">
            将原标签拆分为两个新标签，原标签将被自动停用
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {/* Visual flow */}
          <div className="flex items-center gap-3 py-2">
            <div className="flex-1 bg-[#F3F4F6] rounded-lg px-4 py-3 text-center">
              <span className="text-sm font-medium text-[#9CA3AF] line-through">{tag?.name}</span>
              <div className="text-[11px] text-[#9CA3AF] mt-0.5">原标签将被停用</div>
            </div>
            <ArrowRight size={20} className="text-[#D1D5DB] flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="bg-[#EFF4FF] rounded-lg px-3 py-2 text-center text-sm font-medium text-[#4F7BF7]">
                新标签 1
              </div>
              <div className="bg-[#EFF4FF] rounded-lg px-3 py-2 text-center text-sm font-medium text-[#4F7BF7]">
                新标签 2
              </div>
            </div>
          </div>

          {/* Tag 1 */}
          <div className="border border-[#E5E7EB] rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-medium text-[#374151]">新标签 1</h4>
            <div>
              <label className="block text-xs text-[#6B7280] mb-1">名称 *</label>
              <Input
                value={tag1.name}
                onChange={(e) => setTag1({ ...tag1, name: e.target.value })}
                className={cn('h-9 rounded-lg text-sm', errors.tag1 && 'border-[#EF4444] bg-[#FEF2F2]')}
              />
              {errors.tag1 && <p className="text-xs text-[#EF4444] mt-1">{errors.tag1}</p>}
            </div>
            <div className="flex gap-3">
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">分类</label>
                <Select value={tag1.category} onValueChange={(v) => setTag1({ ...tag1, category: v as TagCategory })}>
                  <SelectTrigger className="h-9 w-[140px] rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{TAG_CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-[#6B7280] mb-1">描述</label>
                <Input
                  value={tag1.description}
                  onChange={(e) => setTag1({ ...tag1, description: e.target.value })}
                  placeholder="描述（可选）"
                  className="h-9 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* Tag 2 */}
          <div className="border border-[#E5E7EB] rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-medium text-[#374151]">新标签 2</h4>
            <div>
              <label className="block text-xs text-[#6B7280] mb-1">名称 *</label>
              <Input
                value={tag2.name}
                onChange={(e) => setTag2({ ...tag2, name: e.target.value })}
                className={cn('h-9 rounded-lg text-sm', errors.tag2 && 'border-[#EF4444] bg-[#FEF2F2]')}
              />
              {errors.tag2 && <p className="text-xs text-[#EF4444] mt-1">{errors.tag2}</p>}
            </div>
            <div className="flex gap-3">
              <div>
                <label className="block text-xs text-[#6B7280] mb-1">分类</label>
                <Select value={tag2.category} onValueChange={(v) => setTag2({ ...tag2, category: v as TagCategory })}>
                  <SelectTrigger className="h-9 w-[140px] rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{TAG_CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-[#6B7280] mb-1">描述</label>
                <Input
                  value={tag2.description}
                  onChange={(e) => setTag2({ ...tag2, description: e.target.value })}
                  placeholder="描述（可选）"
                  className="h-9 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button variant="outline" className="h-9 px-5 text-sm rounded-md" onClick={onClose}>
              取消
            </Button>
            <Button
              className="h-9 px-5 text-sm rounded-md bg-[#4F7BF7] hover:bg-[#3A63D9] text-white"
              onClick={handleSplit}
            >
              确认拆分
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════
   ImportModal
   ═══════════════════════════════════════════════════════════ */
function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[640px] p-0 overflow-hidden rounded-xl">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="text-lg font-semibold text-[#1F2937]">
            批量导入原子标签
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6">
          {/* Steps */}
          <div className="flex items-center gap-2 mb-6">
            {['下载模板', '上传文件', '确认导入'].map((label, i) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium',
                    i + 1 === step
                      ? 'bg-[#4F7BF7] text-white'
                      : i + 1 < step
                      ? 'bg-[#10B981] text-white'
                      : 'bg-[#F3F4F6] text-[#9CA3AF]'
                  )}
                >
                  {i + 1 < step ? <CheckSquare size={14} /> : i + 1}
                </div>
                <span
                  className={cn(
                    'text-xs font-medium',
                    i + 1 === step ? 'text-[#4F7BF7]' : 'text-[#6B7280]'
                  )}
                >
                  {label}
                </span>
                {i < 2 && <div className="flex-1 h-px bg-[#E5E7EB]" />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="text-center py-6"
              >
                <Download size={48} className="mx-auto text-[#4F7BF7] mb-4" />
                <p className="text-sm text-[#6B7280] mb-1">
                  请下载模板文件，按格式填写标签信息后上传
                </p>
                <p className="text-xs text-[#9CA3AF] mb-5">包含：标签名称、分类、描述三列</p>
                <Button
                  className="bg-[#4F7BF7] hover:bg-[#3A63D9] text-white h-9 px-6"
                  onClick={() => setStep(2)}
                >
                  <Download size={15} className="mr-2" />
                  下载模板
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  className="border-2 border-dashed border-[#D1D5DB] rounded-xl p-10 text-center hover:border-[#4F7BF7] hover:bg-[#EFF4FF] transition-all duration-150 cursor-pointer"
                  onClick={() => setStep(3)}
                >
                  <Upload size={48} className="mx-auto text-[#9CA3AF] mb-3" />
                  <p className="text-sm text-[#6B7280] mb-1">拖拽文件到此处，或点击上传</p>
                  <p className="text-xs text-[#9CA3AF]">支持 .xlsx, .csv 格式，单次最多 500 条</p>
                </div>
                <div className="flex justify-between mt-4">
                  <Button variant="outline" className="h-9 text-sm" onClick={() => setStep(1)}>
                    上一步
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 text-sm"
                    onClick={() => setStep(3)}
                  >
                    下一步
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="bg-[#F9FAFB] rounded-lg p-4 mb-4 text-center">
                  <p className="text-sm text-[#4B5563] mb-2">
                    共检测到 <span className="font-semibold text-[#1F2937]">16</span> 条记录
                  </p>
                  <div className="flex items-center justify-center gap-4 text-xs">
                    <span className="text-[#065F46]">新增: 16条</span>
                    <span className="text-[#92400E]">更新: 0条</span>
                    <span className="text-[#EF4444]">冲突: 0条</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" className="h-9 text-sm" onClick={() => setStep(2)}>
                    返回修改
                  </Button>
                  <Button
                    className="h-9 text-sm bg-[#4F7BF7] hover:bg-[#3A63D9] text-white"
                    onClick={onClose}
                  >
                    确认导入
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════
   DetailDrawer
   ═══════════════════════════════════════════════════════════ */
function DetailDrawer({
  tag,
  onClose,
  tagSystems,
  tagTrees,
  syncRecords,
  onEdit,
}: {
  tag: AtomicTag | null;
  onClose: () => void;
  tagSystems: TagSystem[];
  tagTrees: Record<string, TagNode[]>;
  syncRecords: SyncRecord[];
  onEdit: (tag: AtomicTag) => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'systems' | 'history'>('overview');

  if (!tag) return null;

  // Find systems that reference this tag
  const referencingSystems = useMemo(() => {
    return Object.entries(tagTrees)
      .filter(([, nodes]) => nodes.some((n) => n.atomicTagId === tag.id))
      .map(([sysId, nodes]) => {
        const sys = tagSystems.find((s) => s.id === sysId);
        const nodePaths = nodes
          .filter((n) => n.atomicTagId === tag.id)
          .map((n) => {
            const parts: string[] = [n.name];
            let current: TagNode | undefined = nodes.find((p) => p.id === n.parentId);
            while (current) {
              parts.unshift(current.name);
              const nextId = current.parentId;
              current = nextId ? nodes.find((p) => p.id === nextId) : undefined;
            }
            return parts.join(' > ');
          });
        return { sysId, sysName: sys?.name ?? sysId, sys, nodePaths };
      });
  }, [tag, tagTrees, tagSystems]);

  // Find sync records for this tag
  const tagSyncRecords = useMemo(
    () => syncRecords.filter((r) => r.atomicTagId === tag.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [syncRecords, tag]
  );

  return (
    <Drawer open={!!tag} onOpenChange={(v) => !v && onClose()} direction="right">
      <DrawerContent className="w-[480px] sm:max-w-[480px] rounded-l-xl p-0 overflow-hidden">
        {/* Header */}
        <DrawerHeader className="px-6 py-4 border-b border-[#F3F4F6]">
          <div className="flex items-start justify-between">
            <div>
              <DrawerTitle className="text-lg font-semibold text-[#1F2937] flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: TAG_CATEGORY_COLORS[tag.category].text }}
                />
                {tag.name}
              </DrawerTitle>
              <p className="text-xs text-[#9CA3AF] mt-1">
                ID: {tag.id} · 创建于 {formatDate(tag.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="w-8 h-8 flex items-center justify-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6]"
                onClick={() => { onClose(); onEdit(tag); }}
                aria-label="编辑"
              >
                <Pencil size={16} />
              </button>
              <button
                className="w-8 h-8 flex items-center justify-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6]"
                onClick={onClose}
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4 border-b border-[#F3F4F6]">
            {[
              { key: 'overview' as const, label: '概览' },
              { key: 'systems' as const, label: `引用体系 (${referencingSystems.length})` },
              { key: 'history' as const, label: `变更记录 (${tagSyncRecords.length})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'pb-2 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.key
                    ? 'text-[#4F7BF7] border-[#4F7BF7]'
                    : 'text-[#6B7280] border-transparent hover:text-[#374151]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </DrawerHeader>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#F9FAFB] rounded-lg p-3">
                    <span className="text-xs text-[#9CA3AF]">分类</span>
                    <div className="mt-1">
                      <Badge
                        className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border-0"
                        style={{
                          backgroundColor: TAG_CATEGORY_COLORS[tag.category].bg,
                          color: TAG_CATEGORY_COLORS[tag.category].text,
                        }}
                      >
                        {TAG_CATEGORY_LABELS[tag.category]}
                      </Badge>
                    </div>
                  </div>
                  <div className="bg-[#F9FAFB] rounded-lg p-3">
                    <span className="text-xs text-[#9CA3AF]">状态</span>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          tag.status === 'active' ? 'bg-[#10B981]' : 'bg-[#9CA3AF]'
                        )}
                      />
                      <span className="text-sm text-[#1F2937]">{TAG_STATUS_LABELS[tag.status]}</span>
                    </div>
                  </div>
                  <div className="bg-[#F9FAFB] rounded-lg p-3">
                    <span className="text-xs text-[#9CA3AF]">引用次数</span>
                    <p className="text-sm font-medium text-[#1F2937] mt-1">
                      {tag.usageCount} 个标签体系
                    </p>
                  </div>
                  <div className="bg-[#F9FAFB] rounded-lg p-3">
                    <span className="text-xs text-[#9CA3AF]">创建人</span>
                    <p className="text-sm text-[#1F2937] mt-1">{tag.createdBy}</p>
                  </div>
                </div>

                {tag.description && (
                  <div>
                    <span className="text-xs text-[#9CA3AF]">描述</span>
                    <p className="text-sm text-[#4B5563] mt-1 bg-[#F9FAFB] rounded-lg p-3">{tag.description}</p>
                  </div>
                )}

                <div>
                  <span className="text-xs text-[#9CA3AF]">时间信息</span>
                  <div className="mt-1 space-y-1 text-sm text-[#4B5563]">
                    <div className="flex justify-between">
                      <span>创建时间</span>
                      <span>{formatDate(tag.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>更新时间</span>
                      <span>{formatDate(tag.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'systems' && (
              <motion.div
                key="systems"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-2"
              >
                {referencingSystems.length === 0 ? (
                  <div className="text-center py-10">
                    <FolderTree size={48} className="mx-auto text-[#D1D5DB] mb-3" />
                    <p className="text-sm text-[#9CA3AF]">暂无标签体系引用此标签</p>
                  </div>
                ) : (
                  referencingSystems.map((ref, i) => (
                    <motion.div
                      key={ref.sysId}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2, ease: easeOut }}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#F9FAFB] transition-colors cursor-pointer group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1F2937] truncate">{ref.sysName}</p>
                        {ref.sys && (
                          <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                            {ref.sys.scenario.phase === 'pre_purchase' ? '购前' : '购后'}评论 · {ref.sys.scenario.category}品类 · {ref.sys.scenario.audience}
                          </p>
                        )}
                        {ref.nodePaths.map((path) => (
                          <p key={path} className="text-[11px] text-[#9CA3AF]">{path}</p>
                        ))}
                      </div>
                      <ChevronRight size={16} className="text-[#D1D5DB] group-hover:text-[#9CA3AF] flex-shrink-0" />
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {tagSyncRecords.length === 0 ? (
                  <div className="text-center py-10">
                    <RefreshCw size={48} className="mx-auto text-[#D1D5DB] mb-3" />
                    <p className="text-sm text-[#9CA3AF]">暂无变更记录</p>
                  </div>
                ) : (
                  tagSyncRecords.map((record, i) => (
                    <motion.div
                      key={record.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2, ease: easeOut }}
                      className="border border-[#E5E7EB] rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge
                          className="text-[11px] font-medium rounded-full border-0 px-2 py-0.5"
                          style={{
                            backgroundColor:
                              record.changeType === 'rename'
                                ? '#EFF4FF'
                                : record.changeType === 'split'
                                ? '#FFFBEB'
                                : record.changeType === 'delete'
                                ? '#FEF2F2'
                                : '#F3F4F6',
                            color:
                              record.changeType === 'rename'
                                ? '#4F7BF7'
                                : record.changeType === 'split'
                                ? '#92400E'
                                : record.changeType === 'delete'
                                ? '#EF4444'
                                : '#4B5563',
                          }}
                        >
                          {CHANGE_TYPE_LABELS[record.changeType]}
                        </Badge>
                        <span className="text-[11px] text-[#9CA3AF]">{relativeTime(record.createdAt)}</span>
                      </div>
                      <p className="text-sm text-[#4B5563]">
                        <span className="line-through text-[#9CA3AF]">{record.oldValue}</span>
                        <ArrowRight size={12} className="inline mx-1.5 text-[#D1D5DB]" />
                        <span className="text-[#1F2937] font-medium">{record.newValue}</span>
                      </p>
                      {record.affectedSystems.length > 0 && (
                        <p className="text-[11px] text-[#9CA3AF] mt-1">
                          影响 {record.affectedSystems.length} 个标签体系
                        </p>
                      )}
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
