import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  CheckCircle,
  Clock,
  ArrowUp,
  ArrowDown,
  Minus,
  Search,
  Filter,
  List,
  GitBranch,
  ChevronRight,
  X,
  Zap,
  Eye,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import type { SyncRecord, ChangeType, AtomicTag } from '@/types';
import {
  CHANGE_TYPE_LABELS,
  TAG_CATEGORY_LABELS,
  TAG_CATEGORY_COLORS,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptySyncIcon } from '@/components/icons';

/* ──────────────────────────────────────────────
   Types & Constants
   ────────────────────────────────────────────── */

type ViewMode = 'list' | 'timeline';
type DateRange = 'today' | 'week' | 'month' | 'custom';
type StatusFilter = 'all' | 'synced' | 'pending';

const CHANGE_TYPE_OPTIONS: { value: ChangeType | 'all'; label: string }[] = [
  { value: 'all', label: '全部类型' },
  { value: 'rename', label: '重命名' },
  { value: 'split', label: '拆分' },
  { value: 'merge', label: '合并' },
  { value: 'delete', label: '删除' },
  { value: 'category_change', label: '分类变更' },
];

const CHANGE_TYPE_META: Record<
  ChangeType,
  { color: string; bg: string; dot: string }
> = {
  rename: { color: '#3B82F6', bg: '#EFF6FF', dot: '#3B82F6' },
  split: { color: '#8B5CF6', bg: '#F5F3FF', dot: '#8B5CF6' },
  merge: { color: '#F97316', bg: '#FFF7ED', dot: '#F97316' },
  delete: { color: '#EF4444', bg: '#FEF2F2', dot: '#EF4444' },
  category_change: { color: '#EAB308', bg: '#FEFCE8', dot: '#EAB308' },
};

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'today', label: '今天' },
  { value: 'week', label: '近7天' },
  { value: 'month', label: '近30天' },
  { value: 'custom', label: '自定义' },
];

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'synced', label: '已同步' },
  { value: 'pending', label: '待处理' },
];

/* ──────────────────────────────────────────────
   Utility Functions
   ────────────────────────────────────────────── */

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 7) return `${diffDay}天前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateGroup(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) return '今天';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  )
    return '昨天';

  return date.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function isThisMonth(timestamp: string): boolean {
  const date = new Date(timestamp);
  const now = new Date();
  return (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function isThisWeek(timestamp: string): boolean {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDay = diffMs / (1000 * 60 * 60 * 24);
  return diffDay >= 0 && diffDay < 7;
}

function isTodayFn(timestamp: string): boolean {
  const date = new Date(timestamp);
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function isRecordSynced(record: SyncRecord): boolean {
  return record.affectedSystems.length > 0 && record.affectedSystems.every((s) => s.synced);
}

function getRecordSyncProgress(record: SyncRecord): { synced: number; total: number } {
  const synced = record.affectedSystems.filter((s) => s.synced).length;
  return { synced, total: record.affectedSystems.length };
}

function getAtomicTagCategory(
  tagId: string,
  atomicTags: AtomicTag[]
): string | undefined {
  return atomicTags.find((t) => t.id === tagId)?.category;
}

/* ──────────────────────────────────────────────
   Sub-Components
   ────────────────────────────────────────────── */

/* Stats Card */
interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: number | string;
  label: string;
  trend?: number;
  suffix?: string;
  delay?: number;
}

function StatCard({ icon, iconBg, iconColor, value, label, trend, suffix, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="bg-white rounded-xl shadow-md p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: iconBg }}
        >
          <span style={{ color: iconColor }}>{icon}</span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-[#111827]">
            {value}
            {suffix && <span className="text-sm font-normal text-[#9CA3AF] ml-1">{suffix}</span>}
          </div>
        </div>
      </div>
      <div className="mt-2 text-sm text-[#6B7280]">{label}</div>
      {trend !== undefined && (
        <div className="mt-1.5 flex items-center gap-1 text-xs">
          {trend > 0 ? (
            <>
              <ArrowUp size={12} className="text-[#10B981]" />
              <span className="text-[#10B981]">{trend}%</span>
            </>
          ) : trend < 0 ? (
            <>
              <ArrowDown size={12} className="text-[#EF4444]" />
              <span className="text-[#EF4444]">{Math.abs(trend)}%</span>
            </>
          ) : (
            <>
              <Minus size={12} className="text-[#9CA3AF]" />
              <span className="text-[#9CA3AF]">0%</span>
            </>
          )}
          <span className="text-[#9CA3AF] ml-0.5">vs 上周</span>
        </div>
      )}
    </motion.div>
  );
}

/* Change Type Badge */
function ChangeTypeBadge({ type }: { type: ChangeType }) {
  const meta = CHANGE_TYPE_META[type];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: meta.bg, color: meta.color }}
    >
      {CHANGE_TYPE_LABELS[type]}
    </span>
  );
}

/* Sync Status Indicator */
function SyncStatusIndicator({ record }: { record: SyncRecord }) {
  const progress = getRecordSyncProgress(record);
  if (progress.total === 0) {
    return (
      <div className="flex items-center gap-1.5 text-[#9CA3AF] text-sm">
        <CheckCircle size={14} />
        <span>无影响</span>
      </div>
    );
  }
  if (isRecordSynced(record)) {
    return (
      <div className="flex items-center gap-1.5 text-[#10B981] text-sm">
        <CheckCircle size={14} />
        <span>已自动同步</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-[#F59E0B] text-sm">
      <AlertTriangle size={14} />
      <span>
        {progress.synced}/{progress.total} 已同步
      </span>
    </div>
  );
}

/* Progress Bar */
function SyncProgressBar({ record }: { record: SyncRecord }) {
  const { synced, total } = getRecordSyncProgress(record);
  if (total === 0) return null;
  const pct = Math.round((synced / total) * 100);
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[#6B7280]">
          {synced}/{total} 已同步
        </span>
        <span className="text-xs text-[#6B7280]">{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: pct === 100 ? '#10B981' : '#F59E0B' }}
        />
      </div>
    </div>
  );
}

/* ─── Toast Notification ─── */
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed top-16 right-4 z-[100] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
            className={cn(
              'flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg min-w-[280px] max-w-[360px]',
              toast.type === 'success' && 'bg-white border-l-4 border-[#10B981]',
              toast.type === 'warning' && 'bg-white border-l-4 border-[#F59E0B]',
              toast.type === 'info' && 'bg-white border-l-4 border-[#3B82F6]'
            )}
          >
            {toast.type === 'success' && <CheckCircle size={16} className="text-[#10B981] flex-shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle size={16} className="text-[#F59E0B] flex-shrink-0" />}
            {toast.type === 'info' && <Zap size={16} className="text-[#3B82F6] flex-shrink-0" />}
            <span className="text-sm text-[#1F2937]">{toast.message}</span>
            <button onClick={() => onRemove(toast.id)} className="ml-auto text-[#9CA3AF] hover:text-[#6B7280]">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ─── Detail Drawer ─── */
interface DetailDrawerProps {
  record: SyncRecord | null;
  onClose: () => void;
  atomicTags: AtomicTag[];
  onManualSync: (recordId: string, systemId: string) => void;
  onSyncAll: (recordId: string) => void;
}

function DetailDrawer({ record, onClose, atomicTags, onManualSync, onSyncAll }: DetailDrawerProps) {
  if (!record) return null;

  const progress = getRecordSyncProgress(record);
  const category = getAtomicTagCategory(record.atomicTagId, atomicTags);
  const meta = CHANGE_TYPE_META[record.changeType];

  return (
    <AnimatePresence>
      {record && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/45"
            onClick={onClose}
          />
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
            className="fixed top-0 right-0 bottom-0 w-[480px] max-w-full bg-white z-50 shadow-xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-3">
                <ChangeTypeBadge type={record.changeType} />
                <h2 className="text-lg font-semibold text-[#1F2937]">{record.atomicTagName}</h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#6B7280] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Overview */}
              <div className="bg-[#FAFBFC] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B7280]">变更时间</span>
                  <span className="text-sm text-[#1F2937]">{formatDateTime(record.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B7280]">变更人</span>
                  <span className="text-sm text-[#1F2937]">{record.createdBy}</span>
                </div>
                {category && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#6B7280]">所属分类</span>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: TAG_CATEGORY_COLORS[category as keyof typeof TAG_CATEGORY_COLORS]?.bg,
                        color: TAG_CATEGORY_COLORS[category as keyof typeof TAG_CATEGORY_COLORS]?.text,
                      }}
                    >
                      {TAG_CATEGORY_LABELS[category as keyof typeof TAG_CATEGORY_LABELS] || category}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#6B7280]">同步状态</span>
                  <SyncStatusIndicator record={record} />
                </div>
              </div>

              {/* Change Diff */}
              <div>
                <h3 className="text-sm font-semibold text-[#1F2937] mb-3">变更内容</h3>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-[#F3F4F6] rounded-lg p-3 text-center">
                    <div className="text-xs text-[#9CA3AF] mb-1">变更前</div>
                    <div className="text-sm text-[#4B5563] font-medium truncate">{record.oldValue || '—'}</div>
                  </div>
                  <ChevronRight size={20} className="text-[#9CA3AF] flex-shrink-0" />
                  <div
                    className="flex-1 rounded-lg p-3 text-center"
                    style={{ backgroundColor: `${meta.color}10` }}
                  >
                    <div className="text-xs mb-1" style={{ color: meta.color }}>
                      变更后
                    </div>
                    <div className="text-sm font-medium truncate" style={{ color: meta.color }}>
                      {record.newValue || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Affected Systems */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#1F2937]">
                    影响范围 — {record.affectedSystems.length} 个标签体系
                  </h3>
                  {progress.synced < progress.total && progress.total > 0 && (
                    <Button size="sm" onClick={() => onSyncAll(record.id)}>
                      <Zap size={14} className="mr-1" />
                      全部同步
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  {record.affectedSystems.map((sys, idx) => (
                    <motion.div
                      key={sys.systemId}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04, duration: 0.2 }}
                      className="flex items-center justify-between p-3 rounded-lg border border-[#E5E7EB] bg-white"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: sys.synced ? '#10B981' : '#F59E0B' }}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[#1F2937] truncate">{sys.systemName}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        {sys.synced ? (
                          <span className="inline-flex items-center gap-1 text-xs text-[#10B981]">
                            <CheckCircle size={12} />
                            已同步
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2"
                            onClick={() => onManualSync(record.id, sys.systemId)}
                          >
                            <Zap size={12} className="mr-1" />
                            立即同步
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {record.affectedSystems.length === 0 && (
                    <div className="text-center py-6 text-sm text-[#9CA3AF]">
                      该变更未影响任何标签体系
                    </div>
                  )}
                </div>
              </div>

              {/* Sync Timeline */}
              {record.affectedSystems.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#1F2937] mb-3">同步时间线</h3>
                  <div className="space-y-0">
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#4F7BF7]" />
                        <div className="w-px h-8 bg-[#E5E7EB]" />
                      </div>
                      <div>
                        <div className="text-sm text-[#1F2937]">变更发起</div>
                        <div className="text-xs text-[#9CA3AF]">{formatRelativeTime(record.createdAt)}</div>
                      </div>
                    </div>
                    {record.affectedSystems.map((sys) => (
                      <div key={sys.systemId} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: sys.synced ? '#10B981' : '#D1D5DB' }}
                          />
                          <div className="w-px h-8 bg-[#E5E7EB]" />
                        </div>
                        <div>
                          <div className="text-sm text-[#1F2937]">
                            {sys.systemName}
                            {sys.synced ? ' — 已同步' : ' — 待同步'}
                          </div>
                          <div className="text-xs text-[#9CA3AF]">
                            {sys.synced ? '自动同步完成' : '等待手动确认'}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: isRecordSynced(record) ? '#10B981' : '#D1D5DB' }}
                        />
                      </div>
                      <div>
                        <div
                          className="text-sm font-medium"
                          style={{ color: isRecordSynced(record) ? '#10B981' : '#9CA3AF' }}
                        >
                          {isRecordSynced(record) ? '全部同步完成' : '同步未完成'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─── Impact Analysis ─── */
function ImpactAnalysis({
  syncRecords,
  atomicTags,
}: {
  syncRecords: SyncRecord[];
  atomicTags: AtomicTag[];
}) {
  // Top 5 most frequently changed atomic tags
  const tagChangeCounts = useMemo(() => {
    const counts: Record<string, { name: string; count: number; category?: string }> = {};
    for (const rec of syncRecords) {
      if (!counts[rec.atomicTagId]) {
        const tag = atomicTags.find((t) => t.id === rec.atomicTagId);
        counts[rec.atomicTagId] = { name: rec.atomicTagName, count: 0, category: tag?.category };
      }
      counts[rec.atomicTagId].count += 1;
    }
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [syncRecords, atomicTags]);

  // Change type distribution
  const typeDistribution = useMemo(() => {
    const counts: Record<ChangeType, number> = {
      rename: 0,
      split: 0,
      merge: 0,
      delete: 0,
      category_change: 0,
    };
    for (const rec of syncRecords) {
      counts[rec.changeType]++;
    }
    const total = syncRecords.length || 1;
    return (Object.entries(counts) as [ChangeType, number][])
      .filter(([, c]) => c > 0)
      .map(([type, count]) => ({
        type,
        label: CHANGE_TYPE_LABELS[type],
        count,
        pct: Math.round((count / total) * 100),
        color: CHANGE_TYPE_META[type].color,
      }));
  }, [syncRecords]);

  // Most affected systems
  const affectedSystemsRank = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    for (const rec of syncRecords) {
      for (const sys of rec.affectedSystems) {
        if (!counts[sys.systemId]) {
          counts[sys.systemId] = { name: sys.systemName, count: 0 };
        }
        counts[sys.systemId].count += 1;
      }
    }
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [syncRecords]);

  const maxTagCount = tagChangeCounts[0]?.count || 1;
  const maxSysCount = affectedSystemsRank[0]?.count || 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="mt-6 space-y-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top changed tags */}
        <div className="bg-white rounded-xl shadow-md p-5">
          <h3 className="text-base font-semibold text-[#1F2937] mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-[#4F7BF7]" />
            变更最频繁的原子标签
          </h3>
          {tagChangeCounts.length > 0 ? (
            <div className="space-y-3">
              {tagChangeCounts.map((tag, idx) => (
                <motion.div
                  key={tag.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.2 }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#9CA3AF] w-4">{idx + 1}</span>
                      <span className="text-sm text-[#1F2937] font-medium">{tag.name}</span>
                      {tag.category && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: TAG_CATEGORY_COLORS[tag.category as keyof typeof TAG_CATEGORY_COLORS]?.bg,
                            color: TAG_CATEGORY_COLORS[tag.category as keyof typeof TAG_CATEGORY_COLORS]?.text,
                          }}
                        >
                          {TAG_CATEGORY_LABELS[tag.category as keyof typeof TAG_CATEGORY_LABELS]}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-[#4F7BF7]">{tag.count}次</span>
                  </div>
                  <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden ml-6">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(tag.count / maxTagCount) * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: idx * 0.05 }}
                      className="h-full rounded-full bg-[#4F7BF7]"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-[#9CA3AF]">暂无数据</div>
          )}
        </div>

        {/* Change type distribution */}
        <div className="bg-white rounded-xl shadow-md p-5">
          <h3 className="text-base font-semibold text-[#1F2937] mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-[#4F7BF7]" />
            变更类型分布
          </h3>
          {typeDistribution.length > 0 ? (
            <div className="space-y-3">
              {typeDistribution.map((item, idx) => (
                <motion.div
                  key={item.type}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.2 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-[#4B5563] flex-1">{item.label}</span>
                  <div className="flex-1 h-2 bg-[#F3F4F6] rounded-full overflow-hidden max-w-[120px]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.pct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut', delay: idx * 0.05 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                  </div>
                  <span className="text-sm font-medium text-[#1F2937] w-10 text-right">{item.pct}%</span>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-[#9CA3AF]">暂无数据</div>
          )}
        </div>

        {/* Most affected systems */}
        <div className="bg-white rounded-xl shadow-md p-5">
          <h3 className="text-base font-semibold text-[#1F2937] mb-4 flex items-center gap-2">
            <GitBranch size={16} className="text-[#4F7BF7]" />
            受影响最多的体系
          </h3>
          {affectedSystemsRank.length > 0 ? (
            <div className="space-y-3">
              {affectedSystemsRank.map((sys, idx) => (
                <motion.div
                  key={sys.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.2 }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#9CA3AF] w-4">{idx + 1}</span>
                      <span className="text-sm text-[#1F2937] font-medium truncate max-w-[180px]">
                        {sys.name}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-[#F59E0B]">{sys.count}次</span>
                  </div>
                  <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden ml-6">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(sys.count / maxSysCount) * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: idx * 0.05 }}
                      className="h-full rounded-full bg-[#F59E0B]"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-[#9CA3AF]">暂无数据</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   Main Page Component
   ────────────────────────────────────────────── */

export default function SyncTrackingPage() {
  const { syncRecords, atomicTags } = useData();

  // Filter states
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [changeTypeFilter, setChangeTypeFilter] = useState<ChangeType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [selectedRecord, setSelectedRecord] = useState<SyncRecord | null>(null);
  const [records, setRecords] = useState<SyncRecord[]>(syncRecords);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  // Sync records when data changes
  useEffect(() => {
    setRecords(syncRecords);
  }, [syncRecords]);

  // Add toast helper
  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = `toast-${++toastIdRef.current}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Real-time simulation: every 30s, randomly sync one pending system
  useEffect(() => {
    const interval = setInterval(() => {
      setRecords((prev) => {
        // Find records with pending systems
        const pendingRecords = prev.filter((r) => {
          const prog = getRecordSyncProgress(r);
          return prog.synced < prog.total;
        });
        if (pendingRecords.length === 0) return prev;

        // Pick random record
        const recIdx = Math.floor(Math.random() * pendingRecords.length);
        const targetRecord = pendingRecords[recIdx];
        const originalIdx = prev.findIndex((r) => r.id === targetRecord.id);
        if (originalIdx === -1) return prev;

        // Find first pending system and mark it synced
        const updatedSystems = targetRecord.affectedSystems.map((s) => {
          if (!s.synced) {
            // Only sync the first pending one per tick
            return { ...s, synced: true };
          }
          return s;
        });

        const newRecords = [...prev];
        newRecords[originalIdx] = { ...targetRecord, affectedSystems: updatedSystems };

        // Show toast if a system was synced
        const wasSynced = updatedSystems.some(
          (s, i) => s.synced && !targetRecord.affectedSystems[i].synced
        );
        if (wasSynced) {
          const sysName = targetRecord.affectedSystems.find(
            (s, i) => s.synced && !targetRecord.affectedSystems[i].synced
          )?.systemName;
          if (sysName) {
            addToast(`${sysName} 已自动同步更新`, 'success');
          }
        }

        return newRecords;
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [addToast]);

  // Manual sync handler
  const handleManualSync = useCallback(
    (recordId: string, systemId: string) => {
      setRecords((prev) =>
        prev.map((r) => {
          if (r.id !== recordId) return r;
          return {
            ...r,
            affectedSystems: r.affectedSystems.map((s) =>
              s.systemId === systemId ? { ...s, synced: true } : s
            ),
          };
        })
      );
      const sysName = records
        .find((r) => r.id === recordId)
        ?.affectedSystems.find((s) => s.systemId === systemId)?.systemName;
      addToast(`${sysName || '标签体系'} 已手动同步`, 'success');
    },
    [addToast, records]
  );

  // Sync all handler
  const handleSyncAll = useCallback(
    (recordId: string) => {
      setRecords((prev) =>
        prev.map((r) => {
          if (r.id !== recordId) return r;
          return {
            ...r,
            affectedSystems: r.affectedSystems.map((s) => ({ ...s, synced: true })),
          };
        })
      );
      addToast('全部体系已同步', 'success');
    },
    [addToast]
  );

  // Filtered records
  const filteredRecords = useMemo(() => {
    let result = [...records];

    // Date range filter
    if (dateRange === 'today') {
      result = result.filter((r) => isTodayFn(r.createdAt));
    } else if (dateRange === 'week') {
      result = result.filter((r) => isThisWeek(r.createdAt));
    } else if (dateRange === 'month') {
      result = result.filter((r) => isThisMonth(r.createdAt));
    }

    // Change type filter
    if (changeTypeFilter !== 'all') {
      result = result.filter((r) => r.changeType === changeTypeFilter);
    }

    // Status filter
    if (statusFilter === 'synced') {
      result = result.filter((r) => isRecordSynced(r));
    } else if (statusFilter === 'pending') {
      result = result.filter((r) => {
        const prog = getRecordSyncProgress(r);
        return prog.synced < prog.total && prog.total > 0;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.atomicTagName.toLowerCase().includes(q) ||
          r.oldValue.toLowerCase().includes(q) ||
          r.newValue.toLowerCase().includes(q)
      );
    }

    // Sort by createdAt desc
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return result;
  }, [records, dateRange, changeTypeFilter, statusFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const total = records.length;
    const pending = records.filter((r) => {
      const prog = getRecordSyncProgress(r);
      return prog.synced < prog.total && prog.total > 0;
    }).length;
    const thisMonth = records.filter((r) => isThisMonth(r.createdAt)).length;

    const totalSystems = records.reduce((sum, r) => sum + r.affectedSystems.length, 0);
    const syncedSystems = records.reduce(
      (sum, r) => sum + r.affectedSystems.filter((s) => s.synced).length,
      0
    );
    const autoSyncRate = totalSystems > 0 ? Math.round((syncedSystems / totalSystems) * 100) : 100;

    return { total, pending, thisMonth, autoSyncRate };
  }, [records]);

  // Group records by date for timeline view
  const groupedRecords = useMemo(() => {
    const groups: Record<string, SyncRecord[]> = {};
    for (const rec of filteredRecords) {
      const key = formatDateGroup(rec.createdAt);
      if (!groups[key]) groups[key] = [];
      groups[key].push(rec);
    }
    return Object.entries(groups);
  }, [filteredRecords]);

  // Clear filters
  const clearFilters = () => {
    setDateRange('month');
    setChangeTypeFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
  };

  const hasFilters = dateRange !== 'month' || changeTypeFilter !== 'all' || statusFilter !== 'all' || searchQuery !== '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="max-w-[1440px] mx-auto"
    >
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold text-[#111827] tracking-tight">同步追踪中心</h1>
        <p className="text-sm text-[#9CA3AF] mt-1">监控原子标签变更及其对标签体系的影响</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<RefreshCw size={22} />}
          iconBg="rgba(79,123,247,0.1)"
          iconColor="#4F7BF7"
          value={stats.total}
          label="总变更次数"
          trend={12}
          delay={0}
        />
        <StatCard
          icon={<Clock size={22} />}
          iconBg="rgba(245,158,11,0.1)"
          iconColor="#F59E0B"
          value={stats.pending}
          label="待处理变更"
          trend={stats.pending > 0 ? -8 : 0}
          delay={0.05}
        />
        <StatCard
          icon={<TrendingUp size={22} />}
          iconBg="rgba(16,185,129,0.1)"
          iconColor="#10B981"
          value={stats.thisMonth}
          label="本月变更"
          trend={5}
          delay={0.1}
        />
        <StatCard
          icon={<CheckCircle size={22} />}
          iconBg="rgba(16,185,129,0.1)"
          iconColor="#10B981"
          value={stats.autoSyncRate}
          label="自动同步率"
          suffix="%"
          trend={stats.autoSyncRate >= 95 ? 3 : -5}
          delay={0.15}
        />
      </div>

      {/* View Toggle + Filter Bar */}
      <div className="bg-white rounded-xl shadow-md mb-4 overflow-hidden">
        {/* Top: view toggle + quick stats */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('timeline')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                viewMode === 'timeline'
                  ? 'bg-[#EFF4FF] text-[#4F7BF7]'
                  : 'text-[#6B7280] hover:bg-[#F3F4F6]'
              )}
            >
              <GitBranch size={15} />
              时间线
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                viewMode === 'list'
                  ? 'bg-[#EFF4FF] text-[#4F7BF7]'
                  : 'text-[#6B7280] hover:bg-[#F3F4F6]'
              )}
            >
              <List size={15} />
              列表
            </button>
          </div>
          <div className="text-xs text-[#9CA3AF]">
            共 {filteredRecords.length} 条记录
            {stats.pending > 0 && (
              <span className="ml-2 text-[#F59E0B]">{stats.pending} 条待处理</span>
            )}
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          {/* Date range */}
          <div className="flex items-center gap-1 bg-[#F3F4F6] rounded-lg p-0.5">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  dateRange === opt.value
                    ? 'bg-white text-[#1F2937] shadow-sm'
                    : 'text-[#6B7280] hover:text-[#1F2937]'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Change type filter */}
          <div className="relative">
            <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
            <select
              value={changeTypeFilter}
              onChange={(e) => setChangeTypeFilter(e.target.value as ChangeType | 'all')}
              className="h-9 pl-8 pr-6 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#1F2937] focus:border-[#4F7BF7] focus:ring-1 focus:ring-[#D6E3FF] outline-none appearance-none cursor-pointer"
            >
              {CHANGE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="relative">
            <CheckCircle size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-9 pl-8 pr-6 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#1F2937] focus:border-[#4F7BF7] focus:ring-1 focus:ring-[#D6E3FF] outline-none appearance-none cursor-pointer"
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
            <Input
              placeholder="搜索标签名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-sm border-[#E5E7EB] focus:border-[#4F7BF7] focus:ring-[#D6E3FF]"
            />
          </div>

          {/* Clear filters */}
          <AnimatePresence>
            {hasFilters && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
              >
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-[#6B7280] hover:text-[#EF4444] hover:bg-[#FEF2F2] rounded-md transition-colors"
                >
                  <RotateCcw size={13} />
                  清除筛选
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content Area */}
      {filteredRecords.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-xl shadow-md p-12 text-center"
        >
          <EmptySyncIcon className="mx-auto mb-4 opacity-40" />
          <h3 className="text-lg font-medium text-[#1F2937] mb-1">暂无变更记录</h3>
          <p className="text-sm text-[#9CA3AF]">当前筛选条件下没有同步记录</p>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          {viewMode === 'list' ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-xl shadow-md overflow-hidden"
            >
              {/* List/Table View */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] whitespace-nowrap">变更时间</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] whitespace-nowrap">原子标签</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] whitespace-nowrap">变更类型</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] whitespace-nowrap min-w-[160px]">变更内容</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] whitespace-nowrap">影响范围</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6B7280] whitespace-nowrap w-[160px]">同步状态</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-[#6B7280] whitespace-nowrap">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((record, idx) => {
                      const category = getAtomicTagCategory(record.atomicTagId, atomicTags);
                      return (
                        <motion.tr
                          key={record.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: idx * 0.04,
                            duration: 0.2,
                            ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
                          }}
                          className="border-b border-[#F3F4F6] hover:bg-[#FAFBFC] transition-colors"
                        >
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="text-[#6B7280]">{formatRelativeTime(record.createdAt)}</span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-[#1F2937] font-medium">{record.atomicTagName}</span>
                              {category && (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded"
                                  style={{
                                    backgroundColor: TAG_CATEGORY_COLORS[category as keyof typeof TAG_CATEGORY_COLORS]?.bg,
                                    color: TAG_CATEGORY_COLORS[category as keyof typeof TAG_CATEGORY_COLORS]?.text,
                                  }}
                                >
                                  {TAG_CATEGORY_LABELS[category as keyof typeof TAG_CATEGORY_LABELS]}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <ChangeTypeBadge type={record.changeType} />
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1 text-[#4B5563] max-w-[200px] truncate">
                              <span className="truncate">{record.oldValue || '—'}</span>
                              <ChevronRight size={12} className="text-[#9CA3AF] flex-shrink-0" />
                              <span className="truncate font-medium text-[#1F2937]">{record.newValue || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="text-[#6B7280]">
                              影响 {record.affectedSystems.length} 个标签体系
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <SyncProgressBar record={record} />
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <button
                              onClick={() => setSelectedRecord(record)}
                              className="inline-flex items-center gap-1 text-xs text-[#4F7BF7] hover:text-[#3A63D9] font-medium transition-colors"
                            >
                              <Eye size={13} />
                              查看详情
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="timeline"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-xl shadow-md p-6"
            >
              {/* Timeline View */}
              <div className="space-y-6">
                {groupedRecords.map(([dateGroup, groupRecords], groupIdx) => (
                  <div key={dateGroup}>
                    {/* Date header */}
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-base font-semibold text-[#1F2937]">{dateGroup}</span>
                      <div className="flex-1 h-px bg-[#E5E7EB]" />
                      <span className="text-xs text-[#9CA3AF]">{groupRecords.length} 条记录</span>
                    </div>

                    {/* Timeline items */}
                    <div className="relative pl-6">
                      {/* Vertical line */}
                      <div className="absolute left-[15px] top-0 bottom-0 w-px bg-[#E5E7EB]" />

                      <div className="space-y-4">
                        {groupRecords.map((record, idx) => {
                          const meta = CHANGE_TYPE_META[record.changeType];
                          const time = new Date(record.createdAt).toLocaleTimeString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          });
                          const category = getAtomicTagCategory(record.atomicTagId, atomicTags);

                          return (
                            <motion.div
                              key={record.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{
                                delay: groupIdx * 0.06 + idx * 0.04,
                                duration: 0.25,
                                ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
                              }}
                              className="relative flex gap-4"
                            >
                              {/* Timeline dot */}
                              <div className="absolute left-[-17px] top-3 z-10">
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{
                                    delay: groupIdx * 0.06 + idx * 0.04 + 0.1,
                                    duration: 0.15,
                                  }}
                                  className="w-3 h-3 rounded-full border-2 border-white"
                                  style={{ backgroundColor: meta.dot }}
                                />
                              </div>

                              {/* Time */}
                              <div className="w-12 text-right flex-shrink-0 pt-2">
                                <span className="text-xs text-[#9CA3AF]">{time}</span>
                              </div>

                              {/* Card */}
                              <div className="flex-1 min-w-0">
                                <div
                                  className="p-4 rounded-lg border border-[#E5E7EB] hover:shadow-md hover:border-[#ADC5FF] transition-all duration-200 cursor-pointer bg-white"
                                  onClick={() => setSelectedRecord(record)}
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <ChangeTypeBadge type={record.changeType} />
                                    <span className="text-sm text-[#1F2937]">
                                      标签「{record.atomicTagName}」
                                      {record.changeType === 'rename' && `重命名为「${record.newValue}」`}
                                      {record.changeType === 'category_change' && `分类从「${record.oldValue}」调整为「${record.newValue}」`}
                                      {record.changeType === 'split' && `被拆分`}
                                      {record.changeType === 'merge' && `合并为「${record.newValue}」`}
                                      {record.changeType === 'delete' && `已删除`}
                                    </span>
                                    {category && (
                                      <span
                                        className="text-[10px] px-1.5 py-0.5 rounded ml-auto flex-shrink-0"
                                        style={{
                                          backgroundColor: TAG_CATEGORY_COLORS[category as keyof typeof TAG_CATEGORY_COLORS]?.bg,
                                          color: TAG_CATEGORY_COLORS[category as keyof typeof TAG_CATEGORY_COLORS]?.text,
                                        }}
                                      >
                                        {TAG_CATEGORY_LABELS[category as keyof typeof TAG_CATEGORY_LABELS]}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-4 text-xs text-[#6B7280] mb-2">
                                    <span>变更人: {record.createdBy}</span>
                                    <span>影响 {record.affectedSystems.length} 个标签体系</span>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <SyncStatusIndicator record={record} />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedRecord(record);
                                      }}
                                      className="inline-flex items-center gap-1 text-xs text-[#4F7BF7] hover:text-[#3A63D9] font-medium transition-colors"
                                    >
                                      <Eye size={13} />
                                      查看详情
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Impact Analysis Section */}
      {filteredRecords.length > 0 && (
        <ImpactAnalysis syncRecords={filteredRecords} atomicTags={atomicTags} />
      )}

      {/* Detail Drawer */}
      <AnimatePresence>
        {selectedRecord && (
          <DetailDrawer
            record={selectedRecord}
            onClose={() => setSelectedRecord(null)}
            atomicTags={atomicTags}
            onManualSync={handleManualSync}
            onSyncAll={handleSyncAll}
          />
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </motion.div>
  );
}
