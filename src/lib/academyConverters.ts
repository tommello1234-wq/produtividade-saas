/**
 * Conversores entre formatos do Academy:
 *  - Tabela (Kanban): columns[] com cards[]
 *  - Mapa Mental: { nodes, edges } no formato ReactFlow
 *
 * Garantem sincronização bidirecional + IDs determinísticos pra roundtrip estável.
 */

type Card = {
  id: string;
  title: string;
  description: string;
  link: string;
  checks: Record<string, any>;
  coverImage?: string;
  coverVideo?: string;
};

type Column = {
  id: string;
  title: string;
  cards: Card[];
};

type MindmapNode = {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data: {
    label: string;
    isRoot?: boolean;
    isCollapsed?: boolean;
    emoji?: string;
    url?: string;
    description?: string;
    [k: string]: any;
  };
  [k: string]: any;
};

type MindmapEdge = {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  style?: any;
};

type MindmapData = { nodes: MindmapNode[]; edges: MindmapEdge[] };

type AcademyNodeShape = {
  id: string;
  title: string;
  columns?: Column[];
  mindmapData?: MindmapData;
  viewType?: 'table' | 'mindmap';
  [k: string]: any;
};

// ---------------- Helpers de ID ----------------

// Estratégia: os IDs entre tabela e mindmap são IGUAIS.
// Column.id == column-mindmap-node.id (exatamente)
// Card.id == card-mindmap-node.id (exatamente)
// Isso permite roundtrip estável e match direto na sincronização incremental.

const ROOT_PREFIX = 'node_root_';

const rootNodeId = (sectionId: string) =>
  sectionId.startsWith(ROOT_PREFIX) ? sectionId : `${ROOT_PREFIX}${sectionId}`;

// Identidade — usado pra clareza quando sabemos que não há transformação
const colNodeId = (colId: string) => colId;
const cardNodeId = (cardId: string) => cardId;
const stripColPrefix = (nodeId: string) => nodeId;
const stripCardPrefix = (nodeId: string) => nodeId;

// ---------------- columnsToMindmap ----------------

export function columnsToMindmap(
  columns: Column[],
  sectionTitle: string,
  sectionId: string
): MindmapData {
  const nodes: MindmapNode[] = [];
  const edges: MindmapEdge[] = [];

  const rootId = rootNodeId(sectionId);
  nodes.push({
    id: rootId,
    type: 'editableNode',
    position: { x: 0, y: 0 },
    data: { label: sectionTitle || 'Sem título', isRoot: true },
  });

  (columns || []).forEach((col, ci) => {
    const cId = colNodeId(col.id);
    nodes.push({
      id: cId,
      type: 'editableNode',
      position: { x: 200, y: ci * 100 },
      data: { label: col.title || 'Sem título' },
    });
    edges.push({
      id: `edge_${rootId}_${cId}`,
      source: rootId,
      target: cId,
      type: 'default',
      animated: false,
      style: { stroke: '#FFB020', strokeWidth: 2.5 },
    });

    (col.cards || []).forEach((card, ki) => {
      const cardId = cardNodeId(card.id);
      nodes.push({
        id: cardId,
        type: 'editableNode',
        position: { x: 400, y: ki * 80 },
        data: {
          label: card.title || 'Sem título',
          description: card.description || '',
          url: card.link || '',
        },
      });
      edges.push({
        id: `edge_${cId}_${cardId}`,
        source: cId,
        target: cardId,
        type: 'default',
        animated: false,
        style: { stroke: '#FFB020', strokeWidth: 2.5 },
      });
    });
  });

  return { nodes, edges };
}

// ---------------- mindmapToColumns ----------------

const childrenOf = (nodeId: string, edges: MindmapEdge[]) =>
  edges.filter((e) => e.source === nodeId).map((e) => e.target);

const findRoot = (data: MindmapData): MindmapNode | null => {
  if (!data || !data.nodes) return null;
  // Preferred: explicit isRoot flag
  const explicit = data.nodes.find((n) => n.data?.isRoot);
  if (explicit) return explicit;
  // Fallback: a node with no incoming edge
  const targets = new Set(data.edges.map((e) => e.target));
  return data.nodes.find((n) => !targets.has(n.id)) || data.nodes[0] || null;
};

/**
 * Walk DOWN through single-child "trunk" chains until we hit:
 *   - a node with multiple children (the meaningful branching point) → column
 *   - a node whose only child is a leaf (so the leaf becomes the card) → column
 *   - a leaf itself (column with no cards)
 *
 * Exemplo: branch "Tráfego → TIPOS DE PÁGINAS → [4 folhas]" → retorna TIPOS DE PÁGINAS
 *          branch "Orgânico → [Youtube, Instagram]" → retorna Orgânico
 *          branch "X → Y → Z (folha)" → retorna Y (Z vira card)
 */
function walkDownTrunk(branchId: string, edges: MindmapEdge[]): string {
  let current = branchId;
  // safety against cycles
  const visited = new Set<string>([current]);
  while (true) {
    const children = childrenOf(current, edges);
    if (children.length !== 1) break; // 0 (leaf) or multi-child = stop
    const onlyChild = children[0];
    if (visited.has(onlyChild)) break;
    const grandchildren = childrenOf(onlyChild, edges);
    if (grandchildren.length === 0) break; // single child is a leaf → keep current as column
    current = onlyChild;
    visited.add(current);
  }
  return current;
}

/**
 * Converte mindmap em columns. Estratégia smart:
 * - root → seção (ignorado, vira contexto da seção)
 * - para cada filho direto do root, walkDownTrunk procura o nó "interessante" (onde ramifica)
 *   esse nó vira a COLUMN
 * - filhos da column-node viram CARDS
 * - descendentes mais profundos viram bullets indentados na descrição do card pai
 */
export function mindmapToColumns(data: MindmapData): Column[] {
  if (!data || !data.nodes || data.nodes.length === 0) return [];
  const root = findRoot(data);
  if (!root) return [];

  const topBranches = childrenOf(root.id, data.edges);

  return topBranches.map((branchId) => {
    // Walk down trunk chain to find the meaningful column node
    const columnNodeId = walkDownTrunk(branchId, data.edges);
    const columnNode = data.nodes.find((n) => n.id === columnNodeId);
    if (!columnNode) {
      return { id: stripColPrefix(columnNodeId), title: 'Sem título', cards: [] };
    }

    // Direct children of column-node become cards
    const directChildren = childrenOf(columnNodeId, data.edges);

    const cards: Card[] = directChildren.map((childId) => {
      const childNode = data.nodes.find((n) => n.id === childId);
      if (!childNode) {
        return { id: stripCardPrefix(childId), title: 'Sem título', description: '', link: '', checks: {} };
      }

      // Collect deeper descendants as indented bullets to preserve info
      const deepBullets: string[] = [];
      const collectDeep = (id: string, depth: number) => {
        const kids = childrenOf(id, data.edges);
        kids.forEach((kid) => {
          const kidNode = data.nodes.find((n) => n.id === kid);
          if (!kidNode) return;
          const indent = '  '.repeat(depth - 1);
          const emoji = kidNode.data?.emoji ? `${kidNode.data.emoji} ` : '';
          deepBullets.push(`${indent}- ${emoji}${kidNode.data?.label || ''}`);
          collectDeep(kid, depth + 1);
        });
      };
      collectDeep(childId, 1);

      const baseDesc = childNode.data?.description || '';
      const bulletsBlock = deepBullets.length > 0 ? `\n\n${deepBullets.join('\n')}` : '';
      const titleEmoji = childNode.data?.emoji ? `${childNode.data.emoji} ` : '';

      return {
        id: stripCardPrefix(childId),
        title: `${titleEmoji}${childNode.data?.label || 'Sem título'}`.trim(),
        description: `${baseDesc}${bulletsBlock}`,
        link: childNode.data?.url || '',
        checks: {},
      };
    });

    return {
      id: stripColPrefix(columnNodeId),
      title: columnNode.data?.label || 'Sem título',
      cards,
    };
  });
}

// ---------------- mergeColumnsIntoMindmap (incremental) ----------------

/**
 * Atualiza o mindmap existente com mudanças vindas da tabela, PRESERVANDO
 * estrutura intermediária (trunks como "Tráfego → TIPOS").
 *
 * Estratégia:
 * - Para cada column da tabela, encontra o nó correspondente no mindmap (por ID)
 *   e atualiza só o label.
 * - Para cada card, mesma coisa: encontra por ID e atualiza label/description/url.
 * - Cards novos (sem ID match) são adicionados como filhos do column-node.
 * - Cards removidos: nó correspondente é removido.
 * - Columns novas: criadas como filhos diretos do root.
 * - Columns removidas: removidas do mindmap (com todos os descendentes).
 */
function mergeColumnsIntoMindmap(
  columns: Column[],
  existingMindmap: MindmapData,
  sectionTitle: string,
  sectionId: string
): MindmapData {
  // Se não há mindmap existente, gera do zero (estrutura plana root → col → cards)
  if (!existingMindmap || !existingMindmap.nodes || existingMindmap.nodes.length === 0) {
    return columnsToMindmap(columns, sectionTitle, sectionId);
  }

  const nodes = existingMindmap.nodes.map((n) => ({ ...n, data: { ...n.data } }));
  const edges = existingMindmap.edges.map((e) => ({ ...e }));
  const nodeIndex = new Map<string, MindmapNode>();
  nodes.forEach((n) => nodeIndex.set(n.id, n));

  const root = findRoot({ nodes, edges });
  const rootId = root?.id || rootNodeId(sectionId);
  if (!root) {
    // Não há root — vamos criar um
    nodes.push({
      id: rootId,
      type: 'editableNode',
      position: { x: 0, y: 0 },
      data: { label: sectionTitle || 'Sem título', isRoot: true },
    });
  } else {
    root.data.label = sectionTitle || root.data.label;
  }

  // Set of column nodes the table claims (mapped via stable ID)
  const tableColumnIds = new Set(columns.map((c) => colNodeId(c.id)));
  // Set of card IDs the table claims
  const tableCardIds = new Set<string>();
  columns.forEach((c) => (c.cards || []).forEach((card) => tableCardIds.add(cardNodeId(card.id))));

  // For each column in the table:
  columns.forEach((col, ci) => {
    const colId = colNodeId(col.id);
    let columnNode = nodeIndex.get(colId);

    if (!columnNode) {
      // New column — add as direct child of root
      columnNode = {
        id: colId,
        type: 'editableNode',
        position: { x: 200, y: ci * 100 },
        data: { label: col.title || 'Sem título' },
      };
      nodes.push(columnNode);
      nodeIndex.set(colId, columnNode);
      edges.push({
        id: `edge_${rootId}_${colId}_${Date.now()}`,
        source: rootId,
        target: colId,
        type: 'default',
        animated: false,
        style: { stroke: '#FFB020', strokeWidth: 2.5 },
      });
    } else {
      // Update existing column label
      columnNode.data.label = col.title || columnNode.data.label;
    }

    // Cards: walk through the column's children in mindmap and reconcile with table cards
    const existingCardIds = childrenOf(colId, edges);
    const existingCardSet = new Set(existingCardIds);
    const tableCardIdsForCol = new Set((col.cards || []).map((c) => cardNodeId(c.id)));

    // Add/update cards from table
    (col.cards || []).forEach((card, ki) => {
      const cardId = cardNodeId(card.id);
      let cardNode = nodeIndex.get(cardId);
      if (!cardNode) {
        // New card
        cardNode = {
          id: cardId,
          type: 'editableNode',
          position: { x: 400, y: ki * 80 },
          data: {
            label: card.title || 'Sem título',
            description: card.description || '',
            url: card.link || '',
          },
        };
        nodes.push(cardNode);
        nodeIndex.set(cardId, cardNode);
        edges.push({
          id: `edge_${colId}_${cardId}_${Date.now()}_${ki}`,
          source: colId,
          target: cardId,
          type: 'default',
          animated: false,
          style: { stroke: '#FFB020', strokeWidth: 2.5 },
        });
      } else {
        // Update existing card
        cardNode.data.label = card.title || cardNode.data.label;
        cardNode.data.description = card.description ?? cardNode.data.description;
        cardNode.data.url = card.link ?? cardNode.data.url;
      }
    });

    // Remove cards that no longer exist in the table (and their descendants)
    existingCardIds.forEach((eid) => {
      if (!tableCardIdsForCol.has(eid)) {
        // Remove this card and ALL its descendants (preserves mindmap deep hierarchy only if card still exists)
        const toRemove = new Set<string>([eid]);
        const queue = [eid];
        while (queue.length) {
          const cur = queue.shift()!;
          childrenOf(cur, edges).forEach((kid) => {
            if (!toRemove.has(kid)) {
              toRemove.add(kid);
              queue.push(kid);
            }
          });
        }
        // Remove nodes
        for (let i = nodes.length - 1; i >= 0; i--) {
          if (toRemove.has(nodes[i].id)) nodes.splice(i, 1);
        }
        // Remove edges that reference removed nodes
        for (let i = edges.length - 1; i >= 0; i--) {
          if (toRemove.has(edges[i].source) || toRemove.has(edges[i].target)) edges.splice(i, 1);
        }
      }
    });
  });

  // Remove columns that no longer exist in the table.
  // Cuidado: não remover trunk nodes (tipo "Tráfego" cujo trunk leva a "TIPOS").
  const rootChildren = childrenOf(rootId, edges);
  rootChildren.forEach((rcId) => {
    if (tableColumnIds.has(rcId)) return; // Esse root-child É a column
    // Caminha o trunk. Se o nó final ainda é uma column da tabela, esse rcId é trunk válido.
    const trunkEnd = walkDownTrunk(rcId, edges);
    if (tableColumnIds.has(trunkEnd)) return;
    // Caso contrário, está órfão — remove rcId e seus descendentes
    const toRemove = new Set<string>([rcId]);
    const queue = [rcId];
    while (queue.length) {
      const cur = queue.shift()!;
      childrenOf(cur, edges).forEach((kid) => {
        if (!toRemove.has(kid)) {
          toRemove.add(kid);
          queue.push(kid);
        }
      });
    }
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (toRemove.has(nodes[i].id)) nodes.splice(i, 1);
    }
    for (let i = edges.length - 1; i >= 0; i--) {
      if (toRemove.has(edges[i].source) || toRemove.has(edges[i].target)) edges.splice(i, 1);
    }
  });

  return { nodes, edges };
}

// ---------------- keepInSync ----------------

/**
 * Recebe um nó do Academy e qual formato foi editado, e retorna o nó
 * com AMBOS os campos (`columns` e `mindmapData`) atualizados.
 *
 * - `source: 'mindmap'` → regenera columns do zero (lossless porque mindmap é canonical)
 * - `source: 'table'` → atualiza o mindmap existente incrementalmente, preservando
 *   estrutura de "trunks" (nós intermediários como "Tráfego → TIPOS DE PÁGINAS")
 */
export function keepInSync<T extends AcademyNodeShape>(
  node: T,
  source: 'table' | 'mindmap'
): T {
  if (source === 'table') {
    const mindmapData = mergeColumnsIntoMindmap(
      node.columns || [],
      node.mindmapData || { nodes: [], edges: [] },
      node.title,
      node.id
    );
    return { ...node, mindmapData };
  } else {
    const columns = mindmapToColumns(node.mindmapData || { nodes: [], edges: [] });
    return { ...node, columns };
  }
}

/**
 * Garante que o nó tem o formato `target` populado. Se não tiver, deriva do outro.
 * Usado quando o usuário alterna a visualização e o formato alvo está vazio.
 */
export function ensureFormat<T extends AcademyNodeShape>(
  node: T,
  target: 'table' | 'mindmap'
): T {
  if (target === 'mindmap') {
    const hasMindmap = node.mindmapData && node.mindmapData.nodes && node.mindmapData.nodes.length > 0;
    if (hasMindmap) return node;
    const mindmapData = columnsToMindmap(node.columns || [], node.title, node.id);
    return { ...node, mindmapData };
  } else {
    const hasColumns = node.columns && node.columns.length > 0;
    if (hasColumns) return node;
    const columns = mindmapToColumns(node.mindmapData || { nodes: [], edges: [] });
    return { ...node, columns };
  }
}
