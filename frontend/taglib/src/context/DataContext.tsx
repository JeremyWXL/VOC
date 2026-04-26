import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { TagSystem, TagNode, PurchasePhase } from '@/types';
import { api } from '@/api/client';
import type { ApiTagSystem } from '@/api/client';
import { csvToNodes, nodesToCsv } from '@/utils/csvTree';
import { toast } from 'sonner';

function mapApiToTagSystem(api: ApiTagSystem): TagSystem {
  return {
    id: api.id,
    name: api.name,
    scenario: {
      phase: 'post_purchase' as PurchasePhase,
      category: api.scene_type || '',
      audience: '',
    },
    description: api.description || '',
    nodeCount: api.csv_content ? Math.max(0, api.csv_content.split('\n').filter(l => l.trim()).length - 1) : 0,
    status: api.is_preset ? 'published' : 'draft',
    createdAt: api.created_at || '',
    updatedAt: api.updated_at || '',
    createdBy: api.is_preset ? '系统预置' : '用户',
  };
}

export interface DataContextValue {
  tagSystems: TagSystem[];
  tagTrees: Record<string, TagNode[]>;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  addTagSystem: (system: Omit<TagSystem, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'nodeCount'>) => Promise<TagSystem>;
  updateTagSystem: (id: string, updates: Partial<TagSystem>) => Promise<void>;
  deleteTagSystem: (id: string) => Promise<void>;
  duplicateTagSystem: (id: string) => Promise<TagSystem | null>;
  updateTagTree: (systemId: string, nodes: TagNode[]) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

interface DataProviderProps {
  children: ReactNode;
}

const EMPTY_CSV_TEMPLATE = '一级标签,二级标签,三级标签,四级标签';

export function DataProvider({ children }: DataProviderProps) {
  const [tagSystems, setTagSystems] = useState<TagSystem[]>([]);
  const [tagTrees, setTagTrees] = useState<Record<string, TagNode[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { items } = await api.listTagSystems();
      const systems = items.map(mapApiToTagSystem);
      setTagSystems(systems);

      const trees: Record<string, TagNode[]> = {};
      await Promise.all(
        items.map(async (item) => {
          trees[item.id] = csvToNodes(item.csv_content || '');
        })
      );
      setTagTrees(trees);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载数据失败';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const addTagSystem = useCallback(
    async (system: Omit<TagSystem, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'nodeCount'>): Promise<TagSystem> => {
      setError(null);
      try {
        const created = await api.createTagSystem({
          name: system.name,
          csv_content: EMPTY_CSV_TEMPLATE,
          scene_type: system.scenario?.category,
          description: system.description,
        });
        toast.success('标签体系已创建');
        await refreshData();
        return mapApiToTagSystem(created);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '创建标签体系失败';
        setError(msg);
        toast.error(msg);
        throw err;
      }
    },
    [refreshData]
  );

  const updateTagSystem = useCallback(
    async (id: string, updates: Partial<TagSystem>): Promise<void> => {
      setError(null);
      try {
        const currentSystem = tagSystems.find((s) => s.id === id);
        const currentTree = tagTrees[id] || [];
        const csvContent = nodesToCsv(currentTree);

        await api.updateTagSystem(id, {
          name: updates.name ?? currentSystem?.name ?? '',
          csv_content: csvContent,
          scene_type: updates.scenario?.category ?? currentSystem?.scenario.category ?? '',
          description: updates.description ?? currentSystem?.description ?? '',
        });
        toast.success('标签体系已更新');
        await refreshData();
      } catch (err) {
        const msg = err instanceof Error ? err.message : '更新标签体系失败';
        setError(msg);
        toast.error(msg);
        throw err;
      }
    },
    [tagSystems, tagTrees, refreshData]
  );

  const deleteTagSystem = useCallback(
    async (id: string): Promise<void> => {
      setError(null);
      try {
        await api.deleteTagSystem(id);
        toast.success('标签体系已删除');
        await refreshData();
      } catch (err) {
        const msg = err instanceof Error ? err.message : '删除标签体系失败';
        setError(msg);
        toast.error(msg);
        throw err;
      }
    },
    [refreshData]
  );

  const duplicateTagSystem = useCallback(
    async (id: string): Promise<TagSystem | null> => {
      setError(null);
      try {
        const copied = await api.copyTagSystem(id);
        toast.success('标签体系已复制');
        await refreshData();
        return mapApiToTagSystem(copied);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '复制标签体系失败';
        setError(msg);
        toast.error(msg);
        return null;
      }
    },
    [refreshData]
  );

  const updateTagTree = useCallback(
    async (systemId: string, nodes: TagNode[]): Promise<void> => {
      setError(null);
      try {
        const currentSystem = tagSystems.find((s) => s.id === systemId);
        const csvContent = nodesToCsv(nodes);
        await api.updateTagSystem(systemId, {
          name: currentSystem?.name ?? '',
          csv_content: csvContent,
          scene_type: currentSystem?.scenario.category ?? '',
          description: currentSystem?.description ?? '',
        });
        toast.success('标签树已更新');
        await refreshData();
      } catch (err) {
        const msg = err instanceof Error ? err.message : '更新标签树失败';
        setError(msg);
        toast.error(msg);
        throw err;
      }
    },
    [tagSystems, refreshData]
  );

  const value: DataContextValue = {
    tagSystems,
    tagTrees,
    isLoading,
    error,
    refreshData,
    addTagSystem,
    updateTagSystem,
    deleteTagSystem,
    duplicateTagSystem,
    updateTagTree,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
