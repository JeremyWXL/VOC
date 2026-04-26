import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { AtomicTag, TagSystem, TagNode, SyncRecord, ChangeType, SystemStatus } from '@/types';
import {
  initialAtomicTags,
  initialTagSystems,
  initialTagTrees,
  initialSyncRecords,
} from '@/data/seedData';

const STORAGE_KEYS = {
  atomicTags: 'voc-atomic-tags',
  tagSystems: 'voc-tag-systems',
  tagTrees: 'voc-tag-trees',
  syncRecords: 'voc-sync-records',
  initialized: 'voc-initialized',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to save ${key} to localStorage:`, e);
  }
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getCurrentUser(): string {
  return '当前用户';
}

function getTimestamp(): string {
  return new Date().toISOString();
}

export interface DataContextValue {
  atomicTags: AtomicTag[];
  tagSystems: TagSystem[];
  tagTrees: Record<string, TagNode[]>;
  syncRecords: SyncRecord[];
  addAtomicTag: (tag: Omit<AtomicTag, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'usageCount'>) => void;
  updateAtomicTag: (id: string, updates: Partial<AtomicTag>) => void;
  deleteAtomicTag: (id: string) => void;
  splitAtomicTag: (id: string, newTags: Array<Omit<AtomicTag, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'usageCount'>>) => void;
  addTagSystem: (system: Omit<TagSystem, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'nodeCount'>) => TagSystem;
  updateTagSystem: (id: string, updates: Partial<TagSystem>) => void;
  deleteTagSystem: (id: string) => void;
  duplicateTagSystem: (id: string) => TagSystem | null;
  updateTagTree: (systemId: string, nodes: TagNode[]) => void;
  refreshData: () => void;
  isLoading: boolean;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

function initializeData(): {
  atomicTags: AtomicTag[];
  tagSystems: TagSystem[];
  tagTrees: Record<string, TagNode[]>;
  syncRecords: SyncRecord[];
} {
  const alreadyInit = localStorage.getItem(STORAGE_KEYS.initialized);
  if (alreadyInit) {
    return {
      atomicTags: loadFromStorage<AtomicTag[]>(STORAGE_KEYS.atomicTags, initialAtomicTags),
      tagSystems: loadFromStorage<TagSystem[]>(STORAGE_KEYS.tagSystems, initialTagSystems),
      tagTrees: loadFromStorage<Record<string, TagNode[]>>(STORAGE_KEYS.tagTrees, initialTagTrees),
      syncRecords: loadFromStorage<SyncRecord[]>(STORAGE_KEYS.syncRecords, initialSyncRecords),
    };
  }

  localStorage.setItem(STORAGE_KEYS.initialized, 'true');
  saveToStorage(STORAGE_KEYS.atomicTags, initialAtomicTags);
  saveToStorage(STORAGE_KEYS.tagSystems, initialTagSystems);
  saveToStorage(STORAGE_KEYS.tagTrees, initialTagTrees);
  saveToStorage(STORAGE_KEYS.syncRecords, initialSyncRecords);

  return {
    atomicTags: initialAtomicTags,
    tagSystems: initialTagSystems,
    tagTrees: initialTagTrees,
    syncRecords: initialSyncRecords,
  };
}

interface DataProviderProps {
  children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [atomicTags, setAtomicTags] = useState<AtomicTag[]>([]);
  const [tagSystems, setTagSystems] = useState<TagSystem[]>([]);
  const [tagTrees, setTagTrees] = useState<Record<string, TagNode[]>>({});
  const [syncRecords, setSyncRecords] = useState<SyncRecord[]>([]);

  const refreshData = useCallback(() => {
    const data = initializeData();
    setAtomicTags(data.atomicTags);
    setTagSystems(data.tagSystems);
    setTagTrees(data.tagTrees);
    setSyncRecords(data.syncRecords);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const persistAtomicTags = useCallback((tags: AtomicTag[]) => {
    setAtomicTags(tags);
    saveToStorage(STORAGE_KEYS.atomicTags, tags);
  }, []);

  const persistTagSystems = useCallback((systems: TagSystem[]) => {
    setTagSystems(systems);
    saveToStorage(STORAGE_KEYS.tagSystems, systems);
  }, []);

  const persistTagTrees = useCallback((trees: Record<string, TagNode[]>) => {
    setTagTrees(trees);
    saveToStorage(STORAGE_KEYS.tagTrees, trees);
  }, []);

  const persistSyncRecords = useCallback((records: SyncRecord[]) => {
    setSyncRecords(records);
    saveToStorage(STORAGE_KEYS.syncRecords, records);
  }, []);

  const createSyncRecord = useCallback(
    (
      atomicTag: AtomicTag,
      changeType: ChangeType,
      oldValue: string,
      newValue: string,
      currentTrees: Record<string, TagNode[]>,
      currentSystems: TagSystem[]
    ): SyncRecord => {
      const affectedSystems = Object.entries(currentTrees)
        .filter(([, nodes]) => nodes.some((n) => n.atomicTagId === atomicTag.id))
        .map(([sysId]) => {
          const sys = currentSystems.find((s) => s.id === sysId);
          return {
            systemId: sysId,
            systemName: sys?.name ?? sysId,
            synced: true,
          };
        });

      return {
        id: generateId('sync'),
        atomicTagId: atomicTag.id,
        atomicTagName: atomicTag.name,
        changeType,
        oldValue,
        newValue,
        affectedSystems,
        createdAt: getTimestamp(),
        createdBy: getCurrentUser(),
      };
    },
    []
  );

  const syncTagNameToTrees = useCallback(
    (atomicTagId: string, newName: string, currentTrees: Record<string, TagNode[]>) => {
      const updated = { ...currentTrees };
      for (const sysId of Object.keys(updated)) {
        updated[sysId] = updated[sysId].map((node) =>
          node.atomicTagId === atomicTagId ? { ...node, name: newName } : node
        );
      }
      return updated;
    },
    []
  );

  const addAtomicTag = useCallback(
    (tag: Omit<AtomicTag, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'usageCount'>) => {
      const newTag: AtomicTag = {
        ...tag,
        id: generateId('at'),
        createdAt: getTimestamp(),
        updatedAt: getTimestamp(),
        createdBy: getCurrentUser(),
        usageCount: 0,
      };
      const updated = [...atomicTags, newTag];
      persistAtomicTags(updated);
    },
    [atomicTags, persistAtomicTags]
  );

  const updateAtomicTag = useCallback(
    (id: string, updates: Partial<AtomicTag>) => {
      const idx = atomicTags.findIndex((t) => t.id === id);
      if (idx === -1) return;

      const oldTag = atomicTags[idx];
      const newTag: AtomicTag = {
        ...oldTag,
        ...updates,
        updatedAt: getTimestamp(),
      };
      const updatedTags = [...atomicTags];
      updatedTags[idx] = newTag;

      const records: SyncRecord[] = [...syncRecords];
      let updatedTrees = { ...tagTrees };

      if (updates.name && updates.name !== oldTag.name) {
        const syncRec = createSyncRecord(
          newTag,
          'rename',
          oldTag.name,
          newTag.name,
          updatedTrees,
          tagSystems
        );
        if (syncRec.affectedSystems.length > 0) {
          records.unshift(syncRec);
          updatedTrees = syncTagNameToTrees(id, newTag.name, updatedTrees);
        }
      }

      if (updates.category && updates.category !== oldTag.category) {
        const syncRec = createSyncRecord(
          newTag,
          'category_change',
          oldTag.category,
          newTag.category,
          updatedTrees,
          tagSystems
        );
        if (syncRec.affectedSystems.length > 0) {
          records.unshift(syncRec);
        }
      }

      persistAtomicTags(updatedTags);
      persistSyncRecords(records);
      if (updatedTrees !== tagTrees) {
        persistTagTrees(updatedTrees);
      }

      // Update usage counts
      const affectedSystemsCount = Object.values(updatedTrees).filter((nodes) =>
        nodes.some((n) => n.atomicTagId === id)
      ).length;
      if (affectedSystemsCount > 0) {
        const recalc = updatedTags.map((t) =>
          t.id === id
            ? { ...t, usageCount: affectedSystemsCount }
            : t
        );
        persistAtomicTags(recalc);
      }
    },
    [atomicTags, tagTrees, tagSystems, syncRecords, persistAtomicTags, persistSyncRecords, persistTagTrees, createSyncRecord, syncTagNameToTrees]
  );

  const deleteAtomicTag = useCallback(
    (id: string) => {
      const tag = atomicTags.find((t) => t.id === id);
      if (!tag) return;

      const records: SyncRecord[] = [...syncRecords];
      const updatedTrees = { ...tagTrees };

      const syncRec = createSyncRecord(tag, 'delete', tag.name, '', updatedTrees, tagSystems);
      if (syncRec.affectedSystems.length > 0) {
        records.unshift(syncRec);
        for (const sysId of Object.keys(updatedTrees)) {
          updatedTrees[sysId] = updatedTrees[sysId].map((node) =>
            node.atomicTagId === id ? { ...node, atomicTagId: undefined } : node
          );
        }
        persistTagTrees(updatedTrees);
      }

      persistAtomicTags(atomicTags.filter((t) => t.id !== id));
      persistSyncRecords(records);
    },
    [atomicTags, tagTrees, tagSystems, syncRecords, persistAtomicTags, persistSyncRecords, persistTagTrees, createSyncRecord]
  );

  const splitAtomicTag = useCallback(
    (
      id: string,
      newTags: Array<Omit<AtomicTag, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'usageCount'>>
    ) => {
      const tag = atomicTags.find((t) => t.id === id);
      if (!tag) return;

      const records: SyncRecord[] = [...syncRecords];
      const splitTagNames = newTags.map((t) => t.name).join(', ');

      const syncRec: SyncRecord = {
        id: generateId('sync'),
        atomicTagId: tag.id,
        atomicTagName: tag.name,
        changeType: 'split',
        oldValue: tag.name,
        newValue: splitTagNames,
        affectedSystems: Object.entries(tagTrees)
          .filter(([, nodes]) => nodes.some((n) => n.atomicTagId === id))
          .map(([sysId]) => {
            const sys = tagSystems.find((s) => s.id === sysId);
            return { systemId: sysId, systemName: sys?.name ?? sysId, synced: true };
          }),
        createdAt: getTimestamp(),
        createdBy: getCurrentUser(),
      };
      records.unshift(syncRec);

      const createdTags: AtomicTag[] = newTags.map((t) => ({
        ...t,
        id: generateId('at'),
        createdAt: getTimestamp(),
        updatedAt: getTimestamp(),
        createdBy: getCurrentUser(),
        usageCount: 0,
      }));

      const updatedTags = atomicTags.map((t) =>
        t.id === id ? { ...t, status: 'disabled' as const, updatedAt: getTimestamp() } : t
      );
      updatedTags.push(...createdTags);

      persistAtomicTags(updatedTags);
      persistSyncRecords(records);
    },
    [atomicTags, tagTrees, tagSystems, syncRecords, persistAtomicTags, persistSyncRecords]
  );

  const addTagSystem = useCallback(
    (system: Omit<TagSystem, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'nodeCount'>): TagSystem => {
      const newSystem: TagSystem = {
        ...system,
        id: generateId('ts'),
        createdAt: getTimestamp(),
        updatedAt: getTimestamp(),
        createdBy: getCurrentUser(),
        nodeCount: 0,
      };
      persistTagSystems([...tagSystems, newSystem]);
      persistTagTrees({ ...tagTrees, [newSystem.id]: [] });
      return newSystem;
    },
    [tagSystems, tagTrees, persistTagSystems, persistTagTrees]
  );

  const updateTagSystem = useCallback(
    (id: string, updates: Partial<TagSystem>) => {
      const updated = tagSystems.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: getTimestamp() } : s
      );
      persistTagSystems(updated);
    },
    [tagSystems, persistTagSystems]
  );

  const deleteTagSystem = useCallback(
    (id: string) => {
      persistTagSystems(tagSystems.filter((s) => s.id !== id));
      const updatedTrees = { ...tagTrees };
      delete updatedTrees[id];
      persistTagTrees(updatedTrees);
    },
    [tagSystems, tagTrees, persistTagSystems, persistTagTrees]
  );

  const duplicateTagSystem = useCallback(
    (id: string): TagSystem | null => {
      const source = tagSystems.find((s) => s.id === id);
      if (!source) return null;

      const newSystem: TagSystem = {
        ...source,
        id: generateId('ts'),
        name: `${source.name} (复制)`,
        status: 'draft' as SystemStatus,
        createdAt: getTimestamp(),
        updatedAt: getTimestamp(),
        createdBy: getCurrentUser(),
      };

      persistTagSystems([...tagSystems, newSystem]);

      const sourceNodes = tagTrees[id] ?? [];
      const idMap = new Map<string, string>();
      const newNodes: TagNode[] = sourceNodes.map((node) => {
        const newId = generateId('tn');
        idMap.set(node.id, newId);
        return {
          ...node,
          id: newId,
          parentId: node.parentId ? idMap.get(node.parentId) ?? node.parentId : undefined,
        };
      });

      persistTagTrees({ ...tagTrees, [newSystem.id]: newNodes });
      return newSystem;
    },
    [tagSystems, tagTrees, persistTagSystems, persistTagTrees]
  );

  const updateTagTree = useCallback(
    (systemId: string, nodes: TagNode[]) => {
      persistTagTrees({ ...tagTrees, [systemId]: nodes });

      const nodeCount = nodes.length;
      const updated = tagSystems.map((s) =>
        s.id === systemId ? { ...s, nodeCount, updatedAt: getTimestamp() } : s
      );
      persistTagSystems(updated);

      // Recalculate usage counts for atomic tags
      const tagCounts: Record<string, number> = {};
      Object.values({ ...tagTrees, [systemId]: nodes }).forEach((nodeList) => {
        nodeList.forEach((n) => {
          if (n.atomicTagId) {
            tagCounts[n.atomicTagId] = (tagCounts[n.atomicTagId] || 0) + 1;
          }
        });
      });

      const recalcTags = atomicTags.map((t) => ({
        ...t,
        usageCount: tagCounts[t.id] || 0,
      }));
      persistAtomicTags(recalcTags);
    },
    [tagTrees, tagSystems, atomicTags, persistTagTrees, persistTagSystems, persistAtomicTags]
  );

  const value: DataContextValue = {
    atomicTags,
    tagSystems,
    tagTrees,
    syncRecords,
    addAtomicTag,
    updateAtomicTag,
    deleteAtomicTag,
    splitAtomicTag,
    addTagSystem,
    updateTagSystem,
    deleteTagSystem,
    duplicateTagSystem,
    updateTagTree,
    refreshData,
    isLoading,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
