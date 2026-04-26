import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Tag, TrendingUp, Activity, Layers } from 'lucide-react';
import { initialAtomicTags } from '@/data/seedData';

import { TAG_CATEGORY_LABELS, TAG_CATEGORY_COLORS, TAG_STATUS_LABELS } from '@/types';
import { Input } from '@/components/ui/input';

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function AtomicTagsPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const tags = initialAtomicTags;

  const categories = useMemo(() => {
    const set = new Set(tags.map((t) => t.category));
    return Array.from(set);
  }, [tags]);

  const filtered = useMemo(() => {
    let list = [...tags];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)));
    }
    if (categoryFilter !== 'all') {
      list = list.filter((t) => t.category === categoryFilter);
    }
    return list;
  }, [tags, search, categoryFilter]);

  const stats = useMemo(() => ({
    total: tags.length,
    active: tags.filter((t) => t.status === 'active').length,
    categories: categories.length,
    avgUsage: tags.length > 0 ? Math.round(tags.reduce((sum, t) => sum + t.usageCount, 0) / tags.length) : 0,
  }), [tags, categories.length]);

  const isInIframe = typeof window !== 'undefined' && window.parent !== window;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={isInIframe ? 'w-full' : 'max-w-[1440px] mx-auto'}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-semibold text-[#111827] tracking-tight">原子标签管理</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">管理可复用的原子标签，供标签体系引用关联</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { icon: Tag, label: '原子标签总数', value: stats.total, color: '#1890ff', bg: '#e6f7ff' },
          { icon: Activity, label: '活跃标签', value: stats.active, color: '#52c41a', bg: '#f6ffed' },
          { icon: Layers, label: '分类数', value: stats.categories, color: '#faad14', bg: '#fffbe6' },
          { icon: TrendingUp, label: '平均引用次数', value: stats.avgUsage, color: '#722ed1', bg: '#f9f0ff' },
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

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md px-5 py-3.5 mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <Input
            placeholder="搜索标签名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-[260px] h-9 text-sm"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 px-3 text-sm border border-[#D1D5DB] rounded-md bg-white"
        >
          <option value="all">全部分类</option>
          {categories.map((c) => (
            <option key={c} value={c}>{TAG_CATEGORY_LABELS[c] || c}</option>
          ))}
        </select>
        <span className="text-xs text-[#9CA3AF] ml-auto">共 {filtered.length} 个标签</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F9FAFB] text-left">
                <th className="px-4 py-3 text-xs font-medium text-[#6B7280]">标签名称</th>
                <th className="px-4 py-3 text-xs font-medium text-[#6B7280]">分类</th>
                <th className="px-4 py-3 text-xs font-medium text-[#6B7280]">描述</th>
                <th className="px-4 py-3 text-xs font-medium text-[#6B7280]">引用次数</th>
                <th className="px-4 py-3 text-xs font-medium text-[#6B7280]">状态</th>
                <th className="px-4 py-3 text-xs font-medium text-[#6B7280]">创建人</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tag, i) => (
                <motion.tr
                  key={tag.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                  className="border-t border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors"
                >
                  <td className="px-4 py-3.5 font-medium text-[#1F2937]">{tag.name}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: TAG_CATEGORY_COLORS[tag.category]?.bg || '#F3F4F6',
                        color: TAG_CATEGORY_COLORS[tag.category]?.text || '#6B7280',
                      }}
                    >
                      {TAG_CATEGORY_LABELS[tag.category] || tag.category}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-[#6B7280] max-w-[300px] truncate">
                    {tag.description || '-'}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-medium text-[#1F2937]">{tag.usageCount}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={cn(
                      'text-[11px] font-medium px-2.5 py-0.5 rounded-full border',
                      tag.status === 'active' ? 'bg-[#ECFDF5] text-[#10B981] border-[#D1FAE5]' :
                      tag.status === 'disabled' ? 'bg-[#F3F4F6] text-[#9CA3AF] border-[#E5E7EB]' :
                      'bg-[#FFFBEB] text-[#F59E0B] border-[#FEF3C7]'
                    )}>
                      {TAG_STATUS_LABELS[tag.status] || tag.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-[#9CA3AF]">{tag.createdBy}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-16 text-[#9CA3AF]">
            <Tag size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm">未找到匹配的原子标签</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
