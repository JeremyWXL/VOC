import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

export default function PermissionsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="max-w-[1440px] mx-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-[#1F2937] tracking-tight">权限配置</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">配置角色权限和访问控制策略</p>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-md p-10 text-center">
        <Shield size={48} className="mx-auto mb-4 text-[#D1D5DB]" />
        <p className="text-[#9CA3AF] text-sm">页面开发中</p>
      </div>
    </motion.div>
  );
}
