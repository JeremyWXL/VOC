import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  LayoutGrid,
  LayoutList,
  Pencil,
  Copy,
  MoreVertical,
  Trash2,
  Archive,
  Rocket,
  FolderTree,
  MessageSquare,
  ClipboardCheck,
  Eye,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import {
  type TagSystem,
  type SystemStatus,
  SYSTEM_STATUS_LABELS,
  PURCHASE_PHASE_LABELS,
} from '@/types';
import { EmptySystemIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

const statusColors: Record<SystemStatus, { badge: string; text: string; dot: string; bar: string }> = {
  draft:    { badge: 'bg-[#FFFBEB] text-[#F59E0B] border-[#FEF3C7]', text: 'text-[#F59E0B]', dot: 'bg-[#F59E0B]', bar: 'bg-[#F59E0B]' },
  published:{ badge: 'bg-[#ECFDF5] text-[#10B981] border-[#D1FAE5]', text: 'text-[#10B981]', dot: 'bg-[#10B981]', bar: 'bg-[#10B981]' },
  archived: { badge: 'bg-[#F3F4F6] text-[#9CA3AF] border-[#E5E7EB]', text: 'text-[#9CA3AF]', dot: 'bg-[#9CA3AF]', bar: 'bg-[#9CA3AF]' },
};

const phaseOptions = [
  { value: 'all', label: '全部阶段' },
  { value: 'pre_purchase', label: '购前' },
  { value: 'post_purchase', label: '购后' },
];
const categoryOptions = ['全部品类', '零食', '饮品', '生鲜', '美妆', '母婴', '家居', '数码'];
const audienceOptions = ['全部客群', '年轻客群', '家庭客群', '中老年客群', '白领客群', '学生客群', '全量客群', '新手父母'];
const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
];
const sortOptions = [
  { value: 'updated_desc', label: '最近更新' },
  { value: 'updated_asc', label: '最早更新' },
  { value: 'name_asc', label: '名称 A-Z' },
  { value: 'name_desc', label: '名称 Z-A' },
  { value: 'nodes_desc', label: '节点数量 多到少' },
  { value: 'nodes_asc', label: '节点数量 少到多' },
];

type ViewMode = 'card' | 'list';
type CreateStep = 1 | 2 | 3;

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function TagSystemsPage() {
  const navigate = useNavigate();
  const { tagSystems, addTagSystem, updateTagSystem, deleteTagSystem, duplicateTagSystem } = useData();

  /* --- filters --- */
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState('全部品类');
  const [audienceFilter, setAudienceFilter] = useState('全部客群');
  const [sortBy, setSortBy] = useState('updated_desc');
  const [viewMode, setViewMode] = useState<ViewMode>('card');

  /* --- modals --- */
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<CreateStep>(1);
  const [deleteTarget, setDeleteTarget] = useState<TagSystem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<TagSystem | null>(null);
  const [publishTarget, setPublishTarget] = useState<TagSystem | null>(null);

  /* --- create form state --- */
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPhase, setFormPhase] = useState<'pre_purchase' | 'post_purchase'>('post_purchase');
  const [formCategory, setFormCategory] = useState('零食');
  const [formAudience, setFormAudience] = useState('年轻客群');

  /* --- filtered & sorted --- */
  const filtered = useMemo(() => {
    let list = [...tagSystems];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      list = list.filter((s) => s.status === statusFilter);
    }
    if (phaseFilter !== 'all') {
      list = list.filter((s) => s.scenario.phase === phaseFilter);
    }
    if (categoryFilter !== '全部品类') {
      list = list.filter((s) => s.scenario.category === categoryFilter);
    }
    if (audienceFilter !== '全部客群') {
      list = list.filter((s) => s.scenario.audience === audienceFilter);
    }
    list.sort((a, b) => {
      switch (sortBy) {
        case 'updated_desc': return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'updated_asc': return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case 'name_asc': return a.name.localeCompare(b.name);
        case 'name_desc': return b.name.localeCompare(a.name);
        case 'nodes_desc': return b.nodeCount - a.nodeCount;
        case 'nodes_asc': return a.nodeCount - b.nodeCount;
        default: return 0;
      }
    });
    return list;
  }, [tagSystems, search, statusFilter, phaseFilter, categoryFilter, audienceFilter, sortBy]);

  /* --- stats --- */
  const stats = useMemo(() => ({
    all: tagSystems.length,
    draft: tagSystems.filter((s) => s.status === 'draft').length,
    published: tagSystems.filter((s) => s.status === 'published').length,
    archived: tagSystems.filter((s) => s.status === 'archived').length,
  }), [tagSystems]);

  /* --- actions --- */
  const resetCreateForm = useCallback(() => {
    setCreateStep(1);
    setFormName('');
    setFormDesc('');
    setFormPhase('post_purchase');
    setFormCategory('零食');
    setFormAudience('年轻客群');
  }, []);

  const handleCreate = useCallback(() => {
    if (!formName.trim()) return;
    const system = addTagSystem({
      name: formName.trim(),
      description: formDesc.trim() || undefined,
      scenario: {
        phase: formPhase,
        category: formCategory,
        audience: formAudience,
      },
      status: 'draft',
    });
    setCreateOpen(false);
    resetCreateForm();
    toast.success('标签体系创建成功');
    // Optionally navigate to editor
    setTimeout(() => navigate(`/tag-system-editor/${system.id}`), 300);
  }, [formName, formDesc, formPhase, formCategory, formAudience, addTagSystem, resetCreateForm, navigate]);

  const handleDuplicate = useCallback((sys: TagSystem) => {
    const dup = duplicateTagSystem(sys.id);
    if (dup) {
      toast.success(`已复制为「${dup.name}」`);
    }
  }, [duplicateTagSystem]);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteTagSystem(deleteTarget.id);
    setDeleteTarget(null);
    toast.success('标签体系已删除');
  }, [deleteTarget, deleteTagSystem]);

  const handleToggleStatus = useCallback((sys: TagSystem, target: SystemStatus) => {
    updateTagSystem(sys.id, { status: target });
    toast.success(target === 'published' ? '标签体系已发布' : target === 'archived' ? '标签体系已归档' : '状态已更新');
  }, [updateTagSystem]);

  /* --- render --- */
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="max-w-[1440px] mx-auto"
    >
      {/* ====== Page Header ====== */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-semibold text-[#111827] tracking-tight">标签体系管理</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">管理场景化标签体系，构建多维度的评论分析框架</p>
        </div>
        <Button
          onClick={() => { resetCreateForm(); setCreateOpen(true); }}
          className="bg-[#4F7BF7] hover:bg-[#3A63D9] text-white h-9 px-4"
        >
          <Plus size={16} className="mr-1.5" />
          新建标签体系
        </Button>
      </div>

      {/* ====== Stats Cards ====== */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {([
          { key: 'all', label: '全部体系', color: '#4F7BF7', bg: '#EFF4FF' },
          { key: 'draft', label: '草稿', color: '#F59E0B', bg: '#FFFBEB' },
          { key: 'published', label: '已发布', color: '#10B981', bg: '#ECFDF5' },
          { key: 'archived', label: '已归档', color: '#9CA3AF', bg: '#F3F4F6' },
        ] as const).map((s) => (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
            className="bg-white rounded-xl shadow-md p-5 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.bg }}>
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
            </div>
            <div>
              <div className="text-2xl font-semibold text-[#111827]">{stats[s.key]}</div>
              <div className="text-xs text-[#9CA3AF]">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ====== Filter Bar ====== */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, delay: 0.08 }}
        className="bg-white rounded-xl shadow-md px-5 py-3.5 mb-4 flex items-center gap-3 flex-wrap"
      >
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <Input
            placeholder="搜索体系名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-[260px] h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[120px] text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {statusOptions.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger className="h-9 w-[130px] text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {phaseOptions.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-[130px] text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {categoryOptions.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={audienceFilter} onValueChange={setAudienceFilter}>
          <SelectTrigger className="h-9 w-[130px] text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {audienceOptions.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-9 w-[150px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {sortOptions.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* ====== View Toggle ====== */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="inline-flex rounded-lg bg-white border border-[#E5E7EB] overflow-hidden shadow-sm">
          <button
            onClick={() => setViewMode('card')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm transition-all',
              viewMode === 'card' ? 'bg-[#4F7BF7] text-white' : 'text-[#4B5563] hover:bg-[#F3F4F6]'
            )}
          >
            <LayoutGrid size={14} /> 卡片
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm transition-all',
              viewMode === 'list' ? 'bg-[#4F7BF7] text-white' : 'text-[#4B5563] hover:bg-[#F3F4F6]'
            )}
          >
            <LayoutList size={14} /> 列表
          </button>
        </div>
        <span className="text-xs text-[#9CA3AF]">共 {filtered.length} 个标签体系</span>
      </div>

      {/* ====== Content ====== */}
      {tagSystems.length === 0 ? (
        <EmptyState onCreate={() => { resetCreateForm(); setCreateOpen(true); }} />
      ) : filtered.length === 0 ? (
        <NoResults onClear={() => { setSearch(''); setStatusFilter('all'); setPhaseFilter('all'); setCategoryFilter('全部品类'); setAudienceFilter('全部客群'); }} />
      ) : (
        <AnimatePresence mode="wait">
          {viewMode === 'card' ? (
            <CardView
              key="card"
              systems={filtered}
              onEdit={(s) => navigate(`/tag-system-editor/${s.id}`)}
              onDuplicate={handleDuplicate}
              onDelete={setDeleteTarget}
              onArchive={setArchiveTarget}
              onPublish={setPublishTarget}
            />
          ) : (
            <ListView
              key="list"
              systems={filtered}
              onEdit={(s) => navigate(`/tag-system-editor/${s.id}`)}
              onDuplicate={handleDuplicate}
              onDelete={setDeleteTarget}
              onArchive={setArchiveTarget}
              onPublish={setPublishTarget}
            />
          )}
        </AnimatePresence>
      )}

      {/* ====== Create Modal ====== */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); resetCreateForm(); } }}>
        <DialogContent className="max-w-[640px] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-lg font-semibold">新建标签体系</DialogTitle>
            <DialogDescription className="text-sm text-[#9CA3AF]">
              步骤 {createStep} / 3
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 min-h-[280px]">
            <AnimatePresence mode="wait">
              {createStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1.5">
                      体系名称 <span className="text-[#EF4444]">*</span>
                    </label>
                    <Input
                      placeholder="如：购后评论-零食品类-年轻客群"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      maxLength={50}
                      className="h-10"
                    />
                    <p className="text-xs text-[#9CA3AF] mt-1">建议使用「评论阶段-品类-客群」的命名方式，便于后续管理</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1.5">描述说明</label>
                    <textarea
                      placeholder="描述该标签体系的使用场景和分析目标..."
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      maxLength={300}
                      rows={4}
                      className="w-full rounded-md border border-[#D1D5DB] bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F7BF7] focus-visible:ring-offset-2 resize-none"
                    />
                    <p className="text-xs text-[#9CA3AF] mt-1 text-right">{formDesc.length}/300</p>
                  </div>
                </motion.div>
              )}
              {createStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-2">
                      评论阶段 <span className="text-[#EF4444]">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['pre_purchase', 'post_purchase'] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setFormPhase(p)}
                          className={cn(
                            'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all text-center',
                            formPhase === p
                              ? 'border-[#4F7BF7] bg-[#EFF4FF] text-[#4F7BF7]'
                              : 'border-[#D1D5DB] bg-white text-[#4B5563] hover:bg-[#F9FAFB]'
                          )}
                        >
                          {p === 'pre_purchase' ? <MessageSquare size={24} /> : <ClipboardCheck size={24} />}
                          <span className="text-sm font-medium">{PURCHASE_PHASE_LABELS[p]}评论</span>
                          <span className="text-xs opacity-70">
                            {p === 'pre_purchase' ? '分析购买前的咨询、比价、种草等评论' : '分析购买后的评价、晒单、反馈等评论'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#374151] mb-1.5">
                        所属品类 <span className="text-[#EF4444]">*</span>
                      </label>
                      <Select value={formCategory} onValueChange={setFormCategory}>
                        <SelectTrigger className="w-full h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {categoryOptions.filter((c) => c !== '全部品类').map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#374151] mb-1.5">
                        目标客群 <span className="text-[#EF4444]">*</span>
                      </label>
                      <Select value={formAudience} onValueChange={setFormAudience}>
                        <SelectTrigger className="w-full h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {audienceOptions.filter((a) => a !== '全部客群').map((a) => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </motion.div>
              )}
              {createStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="bg-[#F9FAFB] rounded-lg p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9CA3AF]">体系名称</span>
                      <span className="font-medium text-[#1F2937]">{formName || '未填写'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9CA3AF]">描述</span>
                      <span className="text-[#374151] max-w-[300px] text-right line-clamp-2">{formDesc || '无'}</span>
                    </div>
                    <div className="h-px bg-[#E5E7EB]" />
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9CA3AF]">评论阶段</span>
                      <span className="font-medium text-[#1F2937]">{PURCHASE_PHASE_LABELS[formPhase]}评论</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9CA3AF]">所属品类</span>
                      <span className="font-medium text-[#1F2937]">{formCategory}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9CA3AF]">目标客群</span>
                      <span className="font-medium text-[#1F2937]">{formAudience}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <DialogFooter className="px-6 pb-6 pt-2">
            <div className="flex items-center gap-2 w-full justify-end">
              {createStep > 1 && (
                <Button variant="outline" onClick={() => setCreateStep((s) => (s - 1) as CreateStep)}>
                  ← 上一步
                </Button>
              )}
              {createStep < 3 ? (
                <Button
                  onClick={() => setCreateStep((s) => (s + 1) as CreateStep)}
                  disabled={createStep === 1 && !formName.trim()}
                  className="bg-[#4F7BF7] hover:bg-[#3A63D9] text-white"
                >
                  下一步 →
                </Button>
              ) : (
                <Button
                  onClick={handleCreate}
                  disabled={!formName.trim()}
                  className="bg-[#4F7BF7] hover:bg-[#3A63D9] text-white"
                >
                  完成创建
                </Button>
              )}
              <Button variant="ghost" onClick={() => { setCreateOpen(false); resetCreateForm(); }}>取消</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Delete Confirmation ====== */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[440px]">
          <AlertDialogHeader className="items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#FEF2F2] flex items-center justify-center mb-2">
              <Trash2 size={24} className="text-[#EF4444]" />
            </div>
            <AlertDialogTitle className="text-base font-semibold">确认删除标签体系？</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[#6B7280]">
              删除后该标签体系及其所有节点配置将无法恢复。已标注的评论数据不受影响，但将无法继续使用该体系进行新的标注任务。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget && (
            <div className="bg-[#F9FAFB] rounded-lg p-3 flex items-center gap-3 border-l-4 border-l-[#FCA5A5]">
              <div>
                <div className="text-sm font-medium text-[#1F2937]">{deleteTarget.name}</div>
                <div className="text-xs text-[#9CA3AF]">{deleteTarget.nodeCount}个节点 · {SYSTEM_STATUS_LABELS[deleteTarget.status]}</div>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-[#EF4444] hover:bg-[#DC2626] text-white">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ====== Archive Confirmation ====== */}
      <AlertDialog open={!!archiveTarget} onOpenChange={() => setArchiveTarget(null)}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader className="items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#FFFBEB] flex items-center justify-center mb-2">
              <Archive size={24} className="text-[#F59E0B]" />
            </div>
            <AlertDialogTitle className="text-base font-semibold">确认归档此标签体系？</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[#6B7280]">
              归档后该标签体系将不再可用于新的评论标注任务，但已有标注数据不受影响。可随时取消归档恢复使用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (archiveTarget) handleToggleStatus(archiveTarget, 'archived'); setArchiveTarget(null); }} className="bg-[#F59E0B] hover:bg-[#D97706] text-white">
              确认归档
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ====== Publish Confirmation ====== */}
      <AlertDialog open={!!publishTarget} onOpenChange={() => setPublishTarget(null)}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader className="items-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#ECFDF5] flex items-center justify-center mb-2">
              <Rocket size={24} className="text-[#10B981]" />
            </div>
            <AlertDialogTitle className="text-base font-semibold">确认发布此标签体系？</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[#6B7280]">
              发布后该标签体系将可用于评论标注任务。请确保节点结构和引用关系已配置完成。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (publishTarget) handleToggleStatus(publishTarget, 'published'); setPublishTarget(null); }} className="bg-[#10B981] hover:bg-[#059669] text-white">
              确认发布
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/* ====== Empty State ====== */
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-xl shadow-md p-16 text-center flex flex-col items-center"
    >
      <EmptySystemIcon className="mb-4 opacity-40" />
      <h3 className="text-lg font-semibold text-[#1F2937] mb-1">暂无标签体系</h3>
      <p className="text-sm text-[#9CA3AF] mb-6">创建第一个标签体系，开始构建评论分析框架</p>
      <Button onClick={onCreate} className="bg-[#4F7BF7] hover:bg-[#3A63D9] text-white">
        <Plus size={16} className="mr-1.5" />
        新建标签体系
      </Button>
    </motion.div>
  );
}

/* ====== No Results ====== */
function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-xl shadow-md p-16 text-center flex flex-col items-center"
    >
      <Search size={48} className="text-[#D1D5DB] mb-4" />
      <h3 className="text-lg font-semibold text-[#1F2937] mb-1">未找到匹配的标签体系</h3>
      <p className="text-sm text-[#9CA3AF] mb-6">尝试调整筛选条件或搜索关键词</p>
      <Button variant="outline" onClick={onClear}>清除筛选</Button>
    </motion.div>
  );
}

/* ====== Card View ====== */
function CardView({
  systems,
  onEdit,
  onDuplicate,
  onDelete,
  onArchive,
  onPublish,
}: {
  systems: TagSystem[];
  onEdit: (s: TagSystem) => void;
  onDuplicate: (s: TagSystem) => void;
  onDelete: (s: TagSystem) => void;
  onArchive: (s: TagSystem) => void;
  onPublish: (s: TagSystem) => void;
}) {
  return (
    <motion.div
      key="card-view"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    >
      {systems.map((sys, i) => {
        const sc = statusColors[sys.status];
        return (
          <motion.div
            key={sys.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.04 }}
            className={cn(
              'bg-white rounded-xl shadow-md overflow-hidden group relative transition-all duration-200 hover:shadow-lg hover:-translate-y-[3px]',
            )}
          >
            {/* Status bar */}
            <div className={cn('h-1 transition-all duration-200 group-hover:h-1.5', sc.bar)} />
            <div
              className="p-5 cursor-pointer"
              onClick={() => onEdit(sys)}
            >
              {/* Scenario tags */}
              <div className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF] mb-3">
                <span className={cn('w-2 h-2 rounded-full', sc.dot)} />
                {PURCHASE_PHASE_LABELS[sys.scenario.phase]}评论 · {sys.scenario.category} · {sys.scenario.audience}
              </div>

              {/* Name */}
              <h3 className="text-[16px] font-semibold text-[#111827] mb-1.5 line-clamp-2 group-hover:text-[#4F7BF7] transition-colors">
                {sys.name}
              </h3>

              {/* Description */}
              <p className="text-xs text-[#9CA3AF] line-clamp-2 mb-4 min-h-[2rem]">
                {sys.description || '暂无描述'}
              </p>

              {/* Divider */}
              <div className="h-px bg-[#E5E7EB] mb-3" />

              {/* Stats */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1 text-xs text-[#6B7280]">
                  <FolderTree size={13} />
                  {sys.nodeCount}个节点
                </div>
                <span className={cn('text-[11px] font-medium px-2.5 py-0.5 rounded-full border', sc.badge)}>
                  {SYSTEM_STATUS_LABELS[sys.status]}
                </span>
              </div>

              {/* Footer */}
              <div className="text-[11px] text-[#9CA3AF] mb-4">
                最近更新: {formatRelativeTime(sys.updatedAt)} · {sys.createdBy}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => onEdit(sys)}>
                  <Pencil size={13} className="mr-1" /> 编辑
                </Button>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => onDuplicate(sys)}>
                  <Copy size={13} className="mr-1" /> 复制
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 px-2">
                      <MoreVertical size={13} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(sys)}>
                      <Eye size={14} className="mr-2" /> 查看详情
                    </DropdownMenuItem>
                    {sys.status === 'draft' && (
                      <DropdownMenuItem onClick={() => onPublish(sys)}>
                        <Rocket size={14} className="mr-2" /> 发布
                      </DropdownMenuItem>
                    )}
                    {sys.status === 'published' && (
                      <DropdownMenuItem onClick={() => onArchive(sys)}>
                        <Archive size={14} className="mr-2" /> 归档
                      </DropdownMenuItem>
                    )}
                    {sys.status === 'archived' && (
                      <DropdownMenuItem onClick={() => onPublish(sys)}>
                        <Rocket size={14} className="mr-2" /> 取消归档
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete(sys)} className="text-[#EF4444] focus:text-[#EF4444]">
                      <Trash2 size={14} className="mr-2" /> 删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

/* ====== List View ====== */
function ListView({
  systems,
  onEdit,
  onDuplicate,
  onDelete,
  onArchive,
  onPublish,
}: {
  systems: TagSystem[];
  onEdit: (s: TagSystem) => void;
  onDuplicate: (s: TagSystem) => void;
  onDelete: (s: TagSystem) => void;
  onArchive: (s: TagSystem) => void;
  onPublish: (s: TagSystem) => void;
}) {
  return (
    <motion.div
      key="list-view"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-xl shadow-md overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F9FAFB] text-left">
              <th className="px-4 py-3 text-xs font-medium text-[#6B7280] w-[30%]">体系名称</th>
              <th className="px-4 py-3 text-xs font-medium text-[#6B7280] w-[22%]">适用场景</th>
              <th className="px-4 py-3 text-xs font-medium text-[#6B7280] w-[10%]">节点数量</th>
              <th className="px-4 py-3 text-xs font-medium text-[#6B7280] w-[10%]">状态</th>
              <th className="px-4 py-3 text-xs font-medium text-[#6B7280] w-[16%]">更新时间</th>
              <th className="px-4 py-3 text-xs font-medium text-[#6B7280] w-[80px] text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {systems.map((sys, i) => {
              const sc = statusColors[sys.status];
              return (
                <motion.tr
                  key={sys.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.04 }}
                  className="border-t border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                  onClick={() => onEdit(sys)}
                >
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-[#1F2937]">{sys.name}</div>
                    <div className="text-xs text-[#9CA3AF] truncate max-w-[280px]">{sys.description || '暂无描述'}</div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-[#6B7280]">
                    {PURCHASE_PHASE_LABELS[sys.scenario.phase]} · {sys.scenario.category} · {sys.scenario.audience}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-medium text-[#1F2937]">{sys.nodeCount}</span>
                    <span className="text-xs text-[#9CA3AF] ml-0.5">个节点</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={cn('text-[11px] font-medium px-2.5 py-0.5 rounded-full border', sc.badge)}>
                      {SYSTEM_STATUS_LABELS[sys.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-[#9CA3AF]">
                    {formatRelativeTime(sys.updatedAt)}
                  </td>
                  <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical size={15} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(sys)}>
                          <Pencil size={14} className="mr-2" /> 编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDuplicate(sys)}>
                          <Copy size={14} className="mr-2" /> 复制
                        </DropdownMenuItem>
                        {sys.status === 'draft' && (
                          <DropdownMenuItem onClick={() => onPublish(sys)}>
                            <Rocket size={14} className="mr-2" /> 发布
                          </DropdownMenuItem>
                        )}
                        {sys.status === 'published' && (
                          <DropdownMenuItem onClick={() => onArchive(sys)}>
                            <Archive size={14} className="mr-2" /> 归档
                          </DropdownMenuItem>
                        )}
                        {sys.status === 'archived' && (
                          <DropdownMenuItem onClick={() => onPublish(sys)}>
                            <Rocket size={14} className="mr-2" /> 取消归档
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onDelete(sys)} className="text-[#EF4444] focus:text-[#EF4444]">
                          <Trash2 size={14} className="mr-2" /> 删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
