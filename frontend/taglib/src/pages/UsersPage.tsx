import { motion } from 'framer-motion';
import { Users } from 'lucide-react';

export default function UsersPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="max-w-[1440px] mx-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-[#1F2937] tracking-tight">用户管理</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">管理系统用户账号和权限</p>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-md p-10 text-center">
        <Users size={48} className="mx-auto mb-4 text-[#D1D5DB]" />
        <p className="text-[#9CA3AF] text-sm">页面开发中</p>
      </div>
    </motion.div>
  );
}
