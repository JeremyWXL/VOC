import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import {
  Tag,
  FolderTree,
  Rocket,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  RefreshCw,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/context/DataContext';
import { CHANGE_TYPE_LABELS, SYSTEM_STATUS_LABELS } from '@/types';
import type { ChangeType, SystemStatus } from '@/types';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

const changeTypeBadge: Record<ChangeType, { bg: string; text: string; label: string }> = {
  rename: { bg: 'bg-[#EFF4FF]', text: 'text-[#1E40AF]', label: CHANGE_TYPE_LABELS.rename },
  split: { bg: 'bg-[#FEF3C7]', text: 'text-[#92400E]', label: CHANGE_TYPE_LABELS.split },
  merge: { bg: 'bg-[#FCE7F3]', text: 'text-[#9D174D]', label: CHANGE_TYPE_LABELS.merge },
  delete: { bg: 'bg-[#FEF2F2]', text: 'text-[#991B1B]', label: CHANGE_TYPE_LABELS.delete },
  category_change: { bg: 'bg-[#E9D5FF]', text: 'text-[#6B21A8]', label: CHANGE_TYPE_LABELS.category_change },
};

const systemStatusBadge: Record<SystemStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-[#F3F4F6]', text: 'text-[#6B7280]', label: SYSTEM_STATUS_LABELS.draft },
  published: { bg: 'bg-[#ECFDF5]', text: 'text-[#065F46]', label: SYSTEM_STATUS_LABELS.published },
  archived: { bg: 'bg-[#FEF2F2]', text: 'text-[#991B1B]', label: SYSTEM_STATUS_LABELS.archived },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { atomicTags, tagSystems, syncRecords } = useData();

  const stats = useMemo(
    () => ({
      totalAtomicTags: atomicTags.length,
      activeAtomicTags: atomicTags.filter((t) => t.status === 'active').length,
      totalSystems: tagSystems.length,
      publishedSystems: tagSystems.filter((s) => s.status === 'published').length,
      pendingSync: syncRecords.filter((r) => r.affectedSystems.some((s) => !s.synced)).length,
      totalSync: syncRecords.length,
    }),
    [atomicTags, tagSystems, syncRecords]
  );

  const recentSyncs = useMemo(() => syncRecords.slice(0, 6), [syncRecords]);

  const recentSystems = useMemo(
    () =>
      [...tagSystems]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5),
    [tagSystems]
  );

  const statCards = [
    {
      label: '原子标签总数',
      value: stats.totalAtomicTags,
      sub: `${stats.activeAtomicTags} 个启用中`,
      icon: Tag,
      iconBg: 'bg-[#EFF4FF]',
      iconColor: 'text-[#4F7BF7]',
      onClick: () => navigate('/atomic-tags'),
    },
    {
      label: '标签体系总数',
      value: stats.totalSystems,
      sub: `${stats.publishedSystems} 个已发布`,
      icon: FolderTree,
      iconBg: 'bg-[#ECFDF5]',
      iconColor: 'text-[#10B981]',
      onClick: () => navigate('/tag-systems'),
    },
    {
      label: '已发布体系数',
      value: stats.publishedSystems,
      sub: '运行中',
      icon: Rocket,
      iconBg: 'bg-[#DBEAFE]',
      iconColor: 'text-[#2563EB]',
      onClick: () => navigate('/tag-systems'),
    },
    {
      label: '待同步变更数',
      value: stats.pendingSync,
      sub: stats.pendingSync > 0 ? '需要处理' : '全部同步',
      icon: AlertTriangle,
      iconBg: stats.pendingSync > 0 ? 'bg-[#FEF3C7]' : 'bg-[#ECFDF5]',
      iconColor: stats.pendingSync > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]',
      onClick: () => navigate('/sync-tracking'),
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-[1440px] mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-[#1F2937] tracking-tight">
            工作台
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            {getGreeting()}，欢迎回到 VOC 标签库管理系统
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-[13px] border-[#E5E7EB] text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#1F2937]"
            onClick={() => navigate('/atomic-tags')}
          >
            <Plus size={15} />
            新建原子标签
          </Button>
          <Button
            size="sm"
            className="h-9 gap-1.5 text-[13px] bg-[#4F7BF7] hover:bg-[#3A63D9] text-white"
            onClick={() => navigate('/tag-systems')}
          >
            <Plus size={15} />
            新建标签体系
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.label}
              className="cursor-pointer border-0 shadow-md hover:shadow-lg transition-shadow duration-200 rounded-xl bg-white"
              onClick={card.onClick}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#6B7280] mb-1">{card.label}</p>
                    <p className="text-[28px] font-semibold text-[#111827] leading-tight">{card.value}</p>
                    <p className="text-[12px] text-[#9CA3AF] mt-1">{card.sub}</p>
                  </div>
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', card.iconBg)}>
                    <Icon size={20} className={card.iconColor} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </motion.div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent sync activity */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="border-0 shadow-md rounded-xl bg-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <RefreshCw size={18} className="text-[#4F7BF7]" />
                  <h2 className="text-[16px] font-semibold text-[#1F2937]">最近同步记录</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-[13px] text-[#4F7BF7] hover:bg-[#EFF4FF] gap-1"
                  onClick={() => navigate('/sync-tracking')}
                >
                  查看全部
                  <ChevronRight size={14} />
                </Button>
              </div>

              {recentSyncs.length === 0 ? (
                <div className="text-center py-10 text-[#9CA3AF]">
                  <RefreshCw size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">暂无同步记录</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentSyncs.map((record) => {
                    const badge = changeTypeBadge[record.changeType];
                    const allSynced = record.affectedSystems.every((s) => s.synced);
                    return (
                      <div
                        key={record.id}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#FAFBFC] transition-colors group"
                      >
                        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', allSynced ? 'bg-[#10B981]' : 'bg-[#F59E0B]')} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-[#1F2937]">{record.atomicTagName}</span>
                            <Badge
                              className={cn('text-[11px] font-medium border-0 px-2 py-0.5', badge.bg, badge.text)}
                            >
                              {badge.label}
                            </Badge>
                          </div>
                          <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                            {record.oldValue} → {record.newValue || '(删除)'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {allSynced ? (
                            <CheckCircle2 size={16} className="text-[#10B981]" />
                          ) : (
                            <Clock size={16} className="text-[#F59E0B]" />
                          )}
                          <span className="text-[12px] text-[#9CA3AF]">{formatDate(record.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent systems */}
        <motion.div variants={itemVariants}>
          <Card className="border-0 shadow-md rounded-xl bg-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FolderTree size={18} className="text-[#4F7BF7]" />
                  <h2 className="text-[16px] font-semibold text-[#1F2937]">最近更新体系</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-[13px] text-[#4F7BF7] hover:bg-[#EFF4FF] gap-1"
                  onClick={() => navigate('/tag-systems')}
                >
                  查看全部
                  <ChevronRight size={14} />
                </Button>
              </div>

              {recentSystems.length === 0 ? (
                <div className="text-center py-10 text-[#9CA3AF]">
                  <FolderTree size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">暂无标签体系</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentSystems.map((system) => {
                    const status = systemStatusBadge[system.status];
                    return (
                      <div
                        key={system.id}
                        className="p-3 rounded-lg hover:bg-[#FAFBFC] transition-colors cursor-pointer group"
                        onClick={() => navigate(`/tag-system-editor/${system.id}`)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-[#1F2937] group-hover:text-[#4F7BF7] transition-colors truncate">
                            {system.name}
                          </span>
                          <ArrowUpRight size={14} className="text-[#D1D5DB] group-hover:text-[#4F7BF7] transition-colors flex-shrink-0" />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={cn('text-[11px] font-medium border-0 px-2 py-0.5', status.bg, status.text)}>
                            {status.label}
                          </Badge>
                          <span className="text-[12px] text-[#9CA3AF]">
                            {system.nodeCount} 个节点
                          </span>
                          <span className="text-[12px] text-[#9CA3AF]">
                            {formatDate(system.updatedAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
