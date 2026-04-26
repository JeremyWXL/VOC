import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { ChevronRight, Home } from 'lucide-react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

const routeLabelMap: Record<string, string> = {
  '/': '工作台',
  '/atomic-tags': '原子标签',
  '/tag-systems': '标签体系',
  '/tag-system-editor': '编辑标签体系',
  '/sync-tracking': '同步追踪',
  '/users': '用户管理',
  '/permissions': '权限配置',
};

interface BreadcrumbItem {
  label: string;
  path?: string;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Auto-collapse sidebar on narrow screens
  useEffect(() => {
    const checkWidth = () => {
      if (window.innerWidth < 1440) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    };
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  // Build breadcrumbs
  const breadcrumbs: BreadcrumbItem[] = [{ label: '工作台', path: '/' }];
  const pathParts = location.pathname.split('/').filter(Boolean);
  if (pathParts.length > 0) {
    const basePath = `/${pathParts[0]}`;
    const baseLabel = routeLabelMap[basePath];
    if (baseLabel) {
      breadcrumbs.push({
        label: baseLabel,
        path: basePath,
      });
    }
    if (pathParts.length > 1 && !pathParts[0].includes('tag-system-editor')) {
      breadcrumbs.push({ label: pathParts[1] });
    }
  }

  return (
    <div className="min-h-[100dvh]">
      <Navbar />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />

      {/* Main Content */}
      <main
        className={cn(
          'pt-14 min-h-[100dvh] transition-all duration-300 bg-[#FAFBFC]',
          sidebarCollapsed ? 'pl-16' : 'pl-60'
        )}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
          className="p-6"
        >
          {/* Breadcrumb */}
          {location.pathname !== '/' && (
            <nav className="flex items-center gap-1.5 mb-5 text-sm">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-1 text-[#9CA3AF] hover:text-[#4F7BF7] transition-colors"
              >
                <Home size={14} />
                <span>首页</span>
              </button>
              {breadcrumbs.slice(1).map((crumb, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <ChevronRight size={14} className="text-[#D1D5DB]" />
                  {crumb.path ? (
                    <button
                      onClick={() => crumb.path && navigate(crumb.path)}
                      className="text-[#6B7280] hover:text-[#4F7BF7] transition-colors"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className="text-[#1F2937] font-medium">{crumb.label}</span>
                  )}
                </div>
              ))}
            </nav>
          )}

          {children}
        </motion.div>
      </main>
    </div>
  );
}
