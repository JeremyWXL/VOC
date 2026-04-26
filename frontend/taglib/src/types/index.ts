export type TagCategory = 'quality' | 'logistics' | 'price' | 'service' | 'experience' | 'packaging' | 'other';
export type TagStatus = 'active' | 'disabled';
export type SystemStatus = 'draft' | 'published' | 'archived';
export type ChangeType = 'rename' | 'split' | 'merge' | 'delete' | 'category_change';
export type PurchasePhase = 'pre_purchase' | 'post_purchase';

export interface AtomicTag {
  id: string;
  name: string;
  category: TagCategory;
  description?: string;
  usageCount: number;
  status: TagStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface TagSystem {
  id: string;
  name: string;
  scenario: {
    phase: PurchasePhase;
    category: string;
    audience: string;
  };
  description?: string;
  nodeCount: number;
  status: SystemStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface TagNode {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  parentId?: string;
  atomicTagId?: string;
  order: number;
  isExpanded?: boolean;
}

export interface TagTreeData {
  systemId: string;
  nodes: TagNode[];
}

export interface SyncRecord {
  id: string;
  atomicTagId: string;
  atomicTagName: string;
  changeType: ChangeType;
  oldValue: string;
  newValue: string;
  affectedSystems: {
    systemId: string;
    systemName: string;
    synced: boolean;
  }[];
  createdAt: string;
  createdBy: string;
}

export const TAG_CATEGORY_LABELS: Record<TagCategory, string> = {
  quality: '质量类',
  logistics: '物流类',
  price: '价格类',
  service: '服务类',
  experience: '体验类',
  packaging: '包装类',
  other: '其他',
};

export const TAG_CATEGORY_COLORS: Record<TagCategory, { bg: string; text: string }> = {
  quality: { bg: '#DBEAFE', text: '#1E40AF' },
  logistics: { bg: '#D1FAE5', text: '#065F46' },
  price: { bg: '#FEF3C7', text: '#92400E' },
  service: { bg: '#E9D5FF', text: '#6B21A8' },
  experience: { bg: '#FCE7F3', text: '#9D174D' },
  packaging: { bg: '#FFEDD5', text: '#9A3412' },
  other: { bg: '#F3F4F6', text: '#4B5563' },
};

export const TAG_STATUS_LABELS: Record<TagStatus, string> = {
  active: '启用中',
  disabled: '已停用',
};

export const SYSTEM_STATUS_LABELS: Record<SystemStatus, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
};

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  rename: '重命名',
  split: '拆分',
  merge: '合并',
  delete: '删除',
  category_change: '分类变更',
};

export const PURCHASE_PHASE_LABELS: Record<PurchasePhase, string> = {
  pre_purchase: '购前',
  post_purchase: '购后',
};
