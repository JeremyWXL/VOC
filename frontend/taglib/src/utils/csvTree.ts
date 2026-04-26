import type { TagNode } from '@/types';

export function csvToNodes(csvContent: string): TagNode[] {
  const lines = csvContent.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim()));
  const nodes: TagNode[] = [];
  let order = 0;
  
  // Track created nodes to avoid duplicates
  const l1Map = new Map<string, string>();
  const l2Map = new Map<string, string>();
  const l3Map = new Map<string, string>();
  
  for (const row of rows) {
    const l1 = row[0] || '';
    const l2 = row[1] || '';
    const l3 = row[2] || '';
    const l4 = row[3] || '';
    
    if (!l1) continue;
    
    // Level 1
    let l1Id = l1Map.get(l1);
    if (!l1Id) {
      l1Id = `tn-l1-${l1Map.size}`;
      l1Map.set(l1, l1Id);
      nodes.push({ id: l1Id, name: l1, level: 1, order: order++, isExpanded: true });
    }
    
    if (!l2) continue;
    
    // Level 2
    const l2Key = `${l1}>${l2}`;
    let l2Id = l2Map.get(l2Key);
    if (!l2Id) {
      l2Id = `tn-l2-${l2Map.size}`;
      l2Map.set(l2Key, l2Id);
      nodes.push({ id: l2Id, name: l2, level: 2, parentId: l1Id, order: order++ });
    }
    
    if (!l3) continue;
    
    // Level 3
    const l3Key = `${l2Key}>${l3}`;
    let l3Id = l3Map.get(l3Key);
    if (!l3Id) {
      l3Id = `tn-l3-${l3Map.size}`;
      l3Map.set(l3Key, l3Id);
      nodes.push({ id: l3Id, name: l3, level: 3, parentId: l2Id, order: order++ });
    }
    
    if (!l4) continue;
    
    // Level 4
    nodes.push({ id: `tn-l4-${nodes.length}`, name: l4, level: 3, parentId: l3Id, order: order++ });
  }
  
  return nodes;
}

export function nodesToCsv(nodes: TagNode[]): string {
  // Build parent lookup
  const parentMap = new Map<string, string>();
  const nodeMap = new Map<string, TagNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }
  for (const n of nodes) {
    if (n.parentId) {
      parentMap.set(n.id, n.parentId);
    }
  }
  
  // Get level for each node (handle if level field is missing by walking up)
  // Build paths (leaf-to-root)
  const paths: string[][] = [];
  
  function buildPath(nodeId: string): string[] {
    const node = nodeMap.get(nodeId);
    if (!node) return [];
    const parentPath = node.parentId ? buildPath(node.parentId) : [];
    return [...parentPath, node.name];
  }
  
  // Only export leaf nodes (or all nodes at max depth)
  const leafNodes = nodes.filter(n => !nodes.some(child => child.parentId === n.id));
  for (const leaf of leafNodes) {
    const path = buildPath(leaf.id);
    while (path.length < 4) path.push('');
    paths.push(path);
  }
  
  if (paths.length === 0) {
    // No leaves - export all nodes as individual rows
    for (const n of nodes) {
      const row = ['', '', '', ''];
      // Find root-to-node path
      const pathNames: string[] = [];
      let cur: TagNode | undefined = n;
      while (cur) {
        pathNames.unshift(cur.name);
        cur = cur.parentId ? nodeMap.get(cur.parentId) : undefined;
      }
      for (let i = 0; i < Math.min(pathNames.length, 4); i++) {
        row[i] = pathNames[i];
      }
      paths.push(row);
    }
  }
  
  const lines = ['一级标签,二级标签,三级标签,四级标签'];
  for (const p of paths) {
    lines.push(p.map(c => `"${c}"`).join(','));
  }
  return lines.join('\n');
}
