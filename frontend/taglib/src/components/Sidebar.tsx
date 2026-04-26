import { useLocation, useNavigate } from 'react-router';
import { Tag, FolderTree, RefreshCw, Users, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FC } from 'react';

interface MenuItem {
  label: string;
  path: string;
  icon: FC<{ size?: number; className?: string }>;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    title: '标签管理',
    items: [
      { label: '原子标签', path: '/atomic-tags', icon: Tag },
      { label: '标签体系', path: '/tag-systems', icon: FolderTree },
    ],
  },
  {
    title: '数据关联',
    items: [
      { label: '同步追踪', path: '/sync-tracking', icon: RefreshCw },
    ],
  },
  {
    title: '系统设置',
    items: [
      { label: '用户管理', path: '/users', icon: Users },
      { label: '权限配置', path: '/permissions', icon: Shield },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-14 bottom-0 bg-[#1E293B] flex flex-col transition-all duration-300 z-40',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Menu Groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {menuGroups.map((group) => (
          <div key={group.title} className="mb-5">
            {!collapsed && (
              <div className="px-3 mb-1.5 text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">
                {group.title}
              </div>
            )}
            {collapsed && (
              <div className="mx-auto mb-2 w-8 h-px bg-[#334155]" />
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.path);
                const Icon = item.icon;
                return (
                  <li key={item.path}>
                    <button
                      onClick={() => navigate(item.path)}
                      className={cn(
                        'relative w-full flex items-center gap-3 h-10 rounded-md transition-all duration-150 group',
                        active
                          ? 'bg-[#334155] text-[#EFF4FF]'
                          : 'text-[#CBD5E1] hover:bg-[#293548] hover:text-[#F1F5F9]',
                        collapsed ? 'justify-center px-0' : 'px-3'
                      )}
                    >
                      {/* Active indicator */}
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r bg-[#4F7BF7]" />
                      )}
                      <Icon
                        size={20}
                        className={cn(
                          'flex-shrink-0',
                          active ? 'text-[#4F7BF7]' : 'text-[#94A3B8] group-hover:text-[#CBD5E1]'
                        )}
                      />
                      {!collapsed && (
                        <span className="text-[13px] font-medium">{item.label}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t border-[#334155] p-2">
        <button
          onClick={onToggle}
          className={cn(
            'w-full flex items-center h-9 rounded-md text-[#94A3B8] hover:bg-[#293548] hover:text-[#CBD5E1] transition-all duration-150',
            collapsed ? 'justify-center' : 'justify-center gap-2'
          )}
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {collapsed ? <ChevronRight size={18} /> : (
            <>
              <ChevronLeft size={16} />
              <span className="text-xs">收起侧边栏</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
