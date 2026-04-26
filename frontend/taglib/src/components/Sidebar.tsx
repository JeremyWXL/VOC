import { useLocation, useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  emoji: string;
  action: () => void;
  isExternal?: boolean;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Runtime iframe detection (must be inside component to avoid build-time tree-shaking)
  const isInIframe = typeof window !== 'undefined' && window.parent !== window;
  if (isInIframe) return null;

  const navItems: NavItem[] = [
    {
      label: '打标模式',
      emoji: '🏷️',
      action: () => {
        window.parent.postMessage({ type: 'switch-mode', mode: 'tag' }, '*');
      },
      isExternal: true,
    },
    {
      label: '标签库管理',
      emoji: '📚',
      action: () => {
        navigate('/tag-systems');
      },
    },
    {
      label: '任务看板',
      emoji: '📊',
      action: () => {
        window.parent.postMessage({ type: 'switch-mode', mode: 'dashboard' }, '*');
      },
      isExternal: true,
    },
    {
      label: '审核模式',
      emoji: '🔍',
      action: () => {
        window.parent.postMessage({ type: 'switch-mode', mode: 'audit' }, '*');
      },
      isExternal: true,
    },
  ];

  const isActive = (item: NavItem) => {
    if (item.isExternal) return false;
    return location.pathname === '/tag-systems' || location.pathname.startsWith('/tag-system-editor');
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-14 bottom-0 flex flex-col transition-all duration-300 z-40',
        collapsed ? 'w-16' : 'w-60'
      )}
      style={{ backgroundColor: '#001529' }}
    >
      {/* Flat Nav List */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <li key={item.label}>
                <button
                  onClick={item.action}
                  className={cn(
                    'relative w-full flex items-center gap-3 h-10 rounded transition-all duration-150 group',
                    active
                      ? 'bg-[#1890ff]/20'
                      : 'hover:bg-[#1890ff]/10',
                    collapsed ? 'justify-center px-0' : 'px-3'
                  )}
                  style={{
                    color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                  }}
                >
                  {/* Active indicator */}
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r"
                      style={{ backgroundColor: '#1890ff' }}
                    />
                  )}
                  <span className="flex-shrink-0 text-base">{item.emoji}</span>
                  {!collapsed && (
                    <span className="text-[13px] font-medium">{item.label}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t border-[#1890ff]/20 p-2">
        <button
          onClick={onToggle}
          className={cn(
            'w-full flex items-center h-9 rounded transition-all duration-150 hover:bg-[#1890ff]/10',
            collapsed ? 'justify-center' : 'justify-center gap-2'
          )}
          style={{ color: 'rgba(255,255,255,0.65)' }}
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
