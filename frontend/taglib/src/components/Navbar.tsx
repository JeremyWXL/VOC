import { useState } from 'react';
import { Search, Bell, ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { LogoIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

export default function Navbar() {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-4">
      {/* Left: Logo + System Name */}
      <div className="flex items-center gap-3">
        <LogoIcon className="flex-shrink-0" />
        <span className="text-[15px] font-semibold text-[#111827] tracking-tight">
          VOC标签库管理系统
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

        {/* User dropdown */}
        <div className="relative ml-1">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-md hover:bg-[#F3F4F6] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#4F7BF7] flex items-center justify-center text-white text-sm font-medium">
              管
            </div>
            <span className="text-sm text-[#374151] hidden sm:block">管理员</span>
            <ChevronDown
              size={14}
              className={cn(
                'text-[#9CA3AF] transition-transform duration-200',
                userMenuOpen && 'rotate-180'
              )}
            />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-1 z-50">
                <div className="px-3 py-2 border-b border-[#F3F4F6]">
                  <p className="text-sm font-medium text-[#1F2937]">管理员</p>
                  <p className="text-xs text-[#9CA3AF]">admin@voc-system.com</p>
                </div>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB] transition-colors">
                  <User size={15} />
                  个人中心
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB] transition-colors">
                  <Settings size={15} />
                  账号设置
                </button>
                <div className="border-t border-[#F3F4F6] mt-1 pt-1">
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEF2F2] transition-colors">
                    <LogOut size={15} />
                    退出登录
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
