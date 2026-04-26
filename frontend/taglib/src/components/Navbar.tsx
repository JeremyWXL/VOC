import { Search, Bell } from 'lucide-react';

export default function Navbar() {
  const isInIframe = typeof window !== 'undefined' && window.parent !== window;
  if (isInIframe) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-4">
      {/* Left: Logo + System Name */}
      <div className="flex items-center gap-3">
        <div
          style={{
            width: 28,
            height: 28,
            background: 'linear-gradient(135deg,#1890ff,#40a9ff)',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          G
        </div>
        <span className="text-[15px] font-semibold text-[#111827] tracking-tight">
          VOC智能分析引擎
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <button
          className="w-9 h-9 flex items-center justify-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
          aria-label="搜索"
        >
          <Search size={18} />
        </button>

        <button
          className="relative w-9 h-9 flex items-center justify-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
          aria-label="通知"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EF4444]" />
        </button>
      </div>
    </header>
  );
}
