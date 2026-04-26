import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, GripVertical } from 'lucide-react';
import type { AtomicTag, TagCategory } from '@/types';
import { TAG_CATEGORY_LABELS, TAG_CATEGORY_COLORS } from '@/types';
import { Input } from '@/components/ui/input';

interface AtomicTagPanelProps {
  atomicTags: AtomicTag[];
  onDragStart: (tag: AtomicTag) => void;
}

export default function AtomicTagPanel({ atomicTags, onDragStart }: AtomicTagPanelProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categories: TagCategory[] = ['quality', 'logistics', 'price', 'service', 'experience', 'packaging', 'other'];

  const filtered = useMemo(() => {
    let list = [...atomicTags];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    if (categoryFilter !== 'all') {
      list = list.filter((t) => t.category === categoryFilter);
    }
    return list;
  }, [atomicTags, search, categoryFilter]);

  const grouped = useMemo(() => {
    const map = new Map<TagCategory, AtomicTag[]>();
    for (const cat of categories) {
      const items = filtered.filter((t) => t.category === cat);
      if (items.length > 0) map.set(cat, items);
    }
    return map;
  }, [filtered]);

  return (
    <div className="h-full flex flex-col bg-white border-r border-[#E5E7EB]">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider mb-3">原子标签库</h3>
        <div className="relative mb-2">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <Input
            placeholder="搜索原子标签..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${categoryFilter === 'all' ? 'bg-[#4F7BF7] text-white' : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'}`}
          >
            全部
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className="text-[11px] px-2 py-0.5 rounded-full transition-colors"
              style={
                categoryFilter === cat
                  ? { backgroundColor: TAG_CATEGORY_COLORS[cat].bg, color: TAG_CATEGORY_COLORS[cat].text }
                  : { backgroundColor: '#F3F4F6', color: '#6B7280' }
              }
            >
              {TAG_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Tag list */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-xs text-[#9CA3AF]">未找到匹配的标签</div>
        ) : (
          <div className="space-y-1">
            {Array.from(grouped.entries()).map(([cat, tags]) => (
              <div key={cat}>
                <div className="text-[10px] font-medium px-1.5 py-1 mt-2 uppercase tracking-wider flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: TAG_CATEGORY_COLORS[cat].text }}
                  />
                  <span style={{ color: TAG_CATEGORY_COLORS[cat].text }}>{TAG_CATEGORY_LABELS[cat]}</span>
                </div>
                {tags.map((tag, i) => (
                  <motion.div
                    key={tag.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    draggable
                    onDragStart={() => onDragStart(tag)}
                    className="flex items-center gap-2 px-2 py-2 rounded-md cursor-grab active:cursor-grabbing hover:bg-[#F9FAFB] group transition-colors"
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: TAG_CATEGORY_COLORS[tag.category].text }}
                    />
                    <span className="text-[13px] text-[#374151] flex-1 truncate">{tag.name}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: TAG_CATEGORY_COLORS[tag.category].bg,
                        color: TAG_CATEGORY_COLORS[tag.category].text,
                      }}
                    >
                      {TAG_CATEGORY_LABELS[tag.category]}
                    </span>
                    <GripVertical size={13} className="text-[#D1D5DB] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
