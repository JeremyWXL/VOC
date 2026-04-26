import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FolderTree,
  Tag,
  Activity,
  Layers,
  TrendingUp,
  Clock,
  GitPullRequest,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { initialAtomicTags, initialSyncRecords } from '@/data/seedData';
import { TAG_CATEGORY_LABELS, TAG_CATEGORY_COLORS } from '@/types';

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function Dashboard() {
  const { tagSystems, isLoading } = useData();
  const atomicTags = initialAtomicTags;
  const syncRecords = initialSyncRecords;

  const systemStats = useMemo(() => ({
    total: tagSystems.length,
    published: tagSystems.filter((s) => s.status === 'published').length,
    draft: tagSystems.filter((s) => s.status === 'draft').length,
    archived: tagSystems.filter((s) => s.status === 'archived').length,
  }), [tagSystems]);

  const tagStats = useMemo(() => ({
    total: atomicTags.length,
    active: atomicTags.filter((t) => t.status === 'active').length,
    disabled: atomicTags.filter((t) => t.status === 'disabled').length,
    categories: Array.from(new Set(atomicTags.map((t) => t.category))).length,
  }), [atomicTags]);

  const categoryDist = useMemo(() => {
    const map: Record<string, number> = {};
    atomicTags.forEach((t) => {
      map[t.category] = (map[t.category] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [atomicTags]);

  const isInIframe = typeof window !== 'undefined' && window.parent !== window;
  const containerClass = isInIframe ? 'w-full' : 'max-w-[1440px] mx-auto';

  if (isLoading) {
    return (
      <div className={`${containerClass} flex items-center justify-center py-20`}>
        <div className="text-[#9CA3AF] text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={containerClass}
    >
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold text-[#111827] tracking-tight">标签管理工作台</h1>
        <p className="text-sm text-[#9CA3AF] mt-1">概览标签体系与原子标签的使用情况</p>
      </div>

      {/* Tag System Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { icon: FolderTree, label: '标签体系总数', value: systemStats.total, color: '#1890ff', bg: '#e6f7ff' },
          { icon: TrendingUp, label: '已发布', value: systemStats.published, color: '#52c41a', bg: '#f6ffed' },
          { icon: Activity, label: '草稿', value: systemStats.draft, color: '#faad14', bg: '#fffbe6' },
          { icon: Layers, label: '已归档', value: systemStats.archived, color: '#8c8c8c', bg: '#f5f5f5' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.05 }}
            className="bg-white rounded-xl shadow-md p-5 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.bg }}>
              <s.icon size={20} style={{ color: s.color }} />
            </div>
            <div>
              <div className="text-2xl font-semibold text-[#111827]">{s.value}</div>
              <div className="text-xs text-[#9CA3AF]">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Atomic Tag Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { icon: Tag, label: '原子标签总数', value: tagStats.total, color: '#722ed1', bg: '#f9f0ff' },
          { icon: TrendingUp, label: '活跃标签', value: tagStats.active, color: '#52c41a', bg: '#f6ffed' },
          { icon: Activity, label: '停用标签', value: tagStats.disabled, color: '#ff4d4f', bg: '#fff1f0' },
          { icon: Layers, label: '分类数', value: tagStats.categories, color: '#13c2c2', bg: '#e6fffb' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.2 + i * 0.05 }}
            className="bg-white rounded-xl shadow-md p-5 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.bg }}>
              <s.icon size={20} style={{ color: s.color }} />
            </div>
            <div>
              <div className="text-2xl font-semibold text-[#111827]">{s.value}</div>
              <div className="text-xs text-[#9CA3AF]">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-2 gap-4">
        {/* Category Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="bg-white rounded-xl shadow-md p-5"
        >
          <h3 className="text-base font-semibold text-[#111827] mb-4">原子标签分类分布</h3>
          <div className="space-y-3">
            {categoryDist.map(([cat, count]) => {
              const max = categoryDist[0][1];
              const pct = Math.round((count / max) * 100);
              const label = (TAG_CATEGORY_LABELS as Record<string, string>)[cat] || cat;
              const color = (TAG_CATEGORY_COLORS as Record<string, { bg: string; text: string }>)[cat]?.bg || '#1890ff';
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-[#374151]">{label}</span>
                    <span className="text-sm font-medium text-[#111827]">{count}</span>
                  </div>
                  <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Recent Sync Records */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="bg-white rounded-xl shadow-md p-5"
        >
          <h3 className="text-base font-semibold text-[#111827] mb-4">最近同步记录</h3>
          <div className="space-y-3">
            {syncRecords.slice(0, 5).map((record) => (
              <div
                key={record.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-[#F9FAFB] hover:bg-[#F3F4F6] transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-[#EFF4FF] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <GitPullRequest size={14} className="text-[#1890ff]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#1F2937]">{record.atomicTagName}</span>
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full',
                        record.changeType === 'rename' ? 'bg-[#EFF4FF] text-[#1890ff]' :
                        record.changeType === 'merge' ? 'bg-[#F9F0FF] text-[#722ed1]' :
                        'bg-[#FFFBE6] text-[#faad14]'
                      )}
                    >
                      {record.changeType === 'rename' ? '重命名' :
                       record.changeType === 'merge' ? '合并' : '分类变更'}
                    </span>
                  </div>
                  <div className="text-xs text-[#9CA3AF] mt-0.5">
                    影响 {record.affectedSystems.length} 个体系 · {record.createdBy}
                  </div>
                </div>
                <div className="text-xs text-[#9CA3AF] flex items-center gap-1 flex-shrink-0">
                  <Clock size={12} />
                  {new Date(record.createdAt).toLocaleDateString('zh-CN')}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
