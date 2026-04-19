import React, { useCallback, useEffect, useState, memo, useRef, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Panel,
  BackgroundVariant,
  Handle,
  Position,
  NodeProps,
  useReactFlow,
  ReactFlowProvider,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Plus, Trash2, X, AlignLeft, Minus, Maximize2, Minimize2, Undo2, Redo2, Link as LinkIcon, Smile, Palette,
} from 'lucide-react';
import dagre from 'dagre';

// ---------- Constants ----------
const nodeWidth = 260;
const nodeHeight = 72;

// Branch color palette (Mindmeister-inspired)
const BRANCH_COLORS = [
  '#FFB020', // accent amber
  '#06B6D4', // cyan
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#22C55E', // green
  '#F97316', // orange
  '#EF4444', // red
  '#3B82F6', // blue
  '#14B8A6', // teal
  '#A855F7', // purple
];

const EMOJI_OPTIONS = ['💡', '🎯', '🚀', '📌', '⭐', '🔥', '💰', '📈', '📚', '🧠', '⚡', '✅', '❓', '🛠', '🎨', '🎬', '📝', '🏆', '🌱', '💎'];

// ---------- Helpers ----------
const getVisibleElements = (nodes: Node[], edges: Edge[]) => {
  const visibleNodeIds = new Set<string>();
  const roots = nodes.filter((n) => !edges.some((e) => e.target === n.id));

  const queue = [...roots];
  while (queue.length > 0) {
    const current = queue.shift()!;
    visibleNodeIds.add(current.id);

    if (!current.data.isCollapsed) {
      const childrenIds = edges.filter((e) => e.source === current.id).map((e) => e.target);
      const children = nodes.filter((n) => childrenIds.includes(n.id) && !visibleNodeIds.has(n.id));
      queue.push(...children);
    }
  }

  const visibleNodes = nodes.filter((n) => visibleNodeIds.has(n.id));
  const visibleEdges = edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));

  return { visibleNodes, visibleEdges };
};

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, ranksep: 130, nodesep: 40 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

// Compute the "branch color" for every node based on its top-level ancestor
const computeBranchColors = (nodes: Node[], edges: Edge[]): Record<string, string> => {
  const result: Record<string, string> = {};
  const root = nodes.find((n) => n.data.isRoot);
  if (!root) return result;

  result[root.id] = '#FFFFFF'; // root uses accent style, color not used for stripe

  // Top-level branches = direct children of root, in stable order
  const topBranches = edges
    .filter((e) => e.source === root.id)
    .map((e) => e.target);

  topBranches.forEach((branchId, idx) => {
    const color = BRANCH_COLORS[idx % BRANCH_COLORS.length];
    // BFS from this branch
    const queue = [branchId];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      result[cur] = color;
      const children = edges.filter((e) => e.source === cur).map((e) => e.target);
      queue.push(...children);
    }
  });

  return result;
};

// ---------- Node component ----------
const EditableNode = memo(({ data, isConnectable, id }: NodeProps) => {
  const isRoot = !!data.isRoot;
  const isCollapsed = !!data.isCollapsed;
  const hasChildren = !!data.hasChildren;
  const color = (data.branchColor as string) || '#FFB020';
  const emoji = (data.emoji as string) || '';
  const url = (data.url as string) || '';
  const isBeingDragged = !!data.isBeingDragged;
  const dragStyle: React.CSSProperties = isBeingDragged
    ? { opacity: 0.85, boxShadow: '0 0 0 2px #FFB020, 0 0 24px rgba(255,176,32,0.45)', borderStyle: 'dashed' }
    : {};

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(data.label as string);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(data.label as string);
  }, [data.label]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const commitEdit = () => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== data.label) {
      typeof data.onUpdateLabel === 'function' && data.onUpdateLabel(id, trimmed);
    } else {
      setDraft(data.label as string);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraft(data.label as string);
  };

  if (isRoot) {
    return (
      <div className="relative bg-accent text-black border border-accent min-w-[240px] group cursor-pointer transition-colors hover:brightness-105" style={dragStyle}>
        {/* Top mono label strip */}
        <div className="px-3 pt-1.5 text-[9px] font-mono tracking-[0.2em] uppercase opacity-80">
          // ROOT
        </div>
        <div className="px-4 pb-3 pt-0.5 flex items-center gap-2">
          {emoji && <span className="text-xl shrink-0">{emoji}</span>}
          {isEditing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="flex-1 bg-black/20 outline-none px-1 text-sm font-black tracking-tight uppercase"
            />
          ) : (
            <div
              className="text-sm font-black tracking-tight uppercase flex-1 hover:bg-black/10 px-1 -mx-1 transition-colors"
              onClick={startEditing}
              title="Clique para renomear · Duplo clique abre detalhes"
            >
              {data.label as string}
            </div>
          )}
        </div>

        <Handle
          type="source"
          position={Position.Right}
          isConnectable={isConnectable}
          className="w-2 h-2 !bg-black border-none !-right-1"
        />

        {/* Add child */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            typeof data.onAddChild === 'function' && data.onAddChild(id);
          }}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-bg text-accent border border-accent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
          title="Adicionar Tópico"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {/* Collapse/expand for root */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              typeof data.onToggleCollapse === 'function' && data.onToggleCollapse(id);
            }}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-bg border border-accent text-accent flex items-center justify-center transition-colors hover:bg-accent hover:text-black z-10"
            title={isCollapsed ? 'Expandir' : 'Recolher'}
          >
            {isCollapsed ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative bg-surface border min-w-[220px] group cursor-pointer transition-colors hover:bg-surface-2"
      style={{ borderColor: color + 'AA', ...dragStyle }}
    >
      {/* Colored top stripe (branch marker) */}
      <div className="h-[3px]" style={{ background: color }} />

      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="w-2 h-2 border-none !-left-1"
        style={{ background: color }}
      />

      <div className="px-3 pt-2 text-[9px] font-mono tracking-[0.2em] uppercase text-text-muted flex items-center justify-between gap-2">
        <span style={{ color }}>// NÓ</span>
        {data.description && <AlignLeft className="w-2.5 h-2.5" aria-label="Possui descrição" />}
      </div>

      <div className="px-3 pb-3 pt-0.5 flex items-center gap-2">
        {emoji && <span className="text-base shrink-0">{emoji}</span>}
        {isEditing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
              if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex-1 bg-bg outline-none border border-accent px-2 py-0.5 text-sm font-semibold text-text-main leading-snug"
          />
        ) : (
          <div
            className="text-sm font-semibold text-text-main flex-1 leading-snug break-words hover:bg-surface-3 px-1 -mx-1 transition-colors"
            onClick={startEditing}
            title="Clique para renomear · Duplo clique abre detalhes"
          >
            {data.label as string}
          </div>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 text-text-muted hover:text-accent"
            title={url}
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-2 h-2 border-none !-right-1"
        style={{ background: color }}
      />

      {/* Add child */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          typeof data.onAddChild === 'function' && data.onAddChild(id);
        }}
        className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-bg border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
        style={{ borderColor: color, color }}
        title="Adicionar Tópico"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      {/* Collapse / expand — SEMPRE visível quando tem filhos */}
      {hasChildren && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            typeof data.onToggleCollapse === 'function' && data.onToggleCollapse(id);
          }}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-bg border text-text-main flex items-center justify-center transition-colors hover:brightness-125 z-10"
          style={{ borderColor: color, color }}
          title={isCollapsed ? 'Expandir ramo' : 'Recolher ramo'}
        >
          {isCollapsed ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
});

const nodeTypes = {
  editableNode: EditableNode,
};

// ---------- Modal ----------
function NodeModal({ node, onClose, onSave }: { node: Node; onClose: () => void; onSave: (data: any) => void }) {
  const [label, setLabel] = useState(node.data.label as string);
  const [description, setDescription] = useState((node.data.description as string) || '');
  const [url, setUrl] = useState((node.data.url as string) || '');
  const [emoji, setEmoji] = useState((node.data.emoji as string) || '');
  const [showEmoji, setShowEmoji] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        className="bg-surface w-full max-w-2xl border border-border-subtle flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <div>
            <div className="text-[10px] font-mono tracking-[0.2em] text-text-muted">// EDITOR</div>
            <h2 className="text-lg font-black tracking-tight uppercase">Detalhes do Tópico</h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          {/* Emoji + Title */}
          <div>
            <label className="block text-[10px] font-mono tracking-[0.2em] text-text-muted mb-2">TÍTULO</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowEmoji((v) => !v)}
                className="w-11 h-11 flex items-center justify-center bg-bg border border-border-subtle text-xl hover:border-accent transition-colors"
                title="Escolher emoji"
              >
                {emoji || <Smile className="w-4 h-4 text-text-muted" />}
              </button>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="flex-1 bg-bg border border-border-subtle px-4 py-2.5 text-text-main focus:outline-none focus:border-accent"
                autoFocus
                placeholder="Título do tópico"
              />
            </div>
            {showEmoji && (
              <div className="mt-2 flex flex-wrap gap-2 bg-bg p-3 border border-border-subtle">
                <button
                  type="button"
                  onClick={() => {
                    setEmoji('');
                    setShowEmoji(false);
                  }}
                  className="px-2 py-1 text-[10px] font-mono tracking-[0.15em] border border-border-subtle hover:border-accent"
                >
                  REMOVER
                </button>
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      setEmoji(e);
                      setShowEmoji(false);
                    }}
                    className="w-8 h-8 flex items-center justify-center text-lg hover:bg-surface-2"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* URL */}
          <div>
            <label className="block text-[10px] font-mono tracking-[0.2em] text-text-muted mb-2">LINK / REFERÊNCIA</label>
            <div className="flex items-center gap-2 bg-bg border border-border-subtle px-3 focus-within:border-accent transition-colors">
              <LinkIcon className="w-4 h-4 text-text-muted" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 bg-transparent px-1 py-2.5 text-text-main outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-mono tracking-[0.2em] text-text-muted mb-2">DESCRIÇÃO</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-bg border border-border-subtle px-4 py-3 text-text-main focus:outline-none focus:border-accent min-h-[180px] resize-y"
              placeholder="Adicione detalhes, anotações, links..."
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border-subtle flex justify-between gap-3">
          {!node.data.isRoot && (
            <button
              onClick={() => onSave({ _delete: true })}
              className="px-4 py-2 text-[11px] font-mono tracking-[0.2em] uppercase text-error hover:bg-error/10 transition-colors flex items-center gap-2 border border-transparent hover:border-error/40"
            >
              <Trash2 className="w-3.5 h-3.5" /> EXCLUIR
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-[11px] font-mono tracking-[0.2em] uppercase text-text-muted hover:text-text-main transition-colors">
              CANCELAR
            </button>
            <button
              onClick={() => {
                onSave({ label, description, url, emoji });
                onClose();
              }}
              className="px-5 py-2 bg-accent text-black text-[11px] font-mono tracking-[0.2em] uppercase font-bold hover:brightness-110 transition-all"
            >
              SALVAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MindMapEditorProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onChange: (nodes: Node[], edges: Edge[]) => void;
  renderNodeModal?: (node: Node, onClose: () => void, onSave: (data: any) => void) => React.ReactNode;
}

// ---------- Inner editor ----------
function MindMapEditorInner(props: MindMapEditorProps) {
  const { initialNodes, initialEdges, onChange } = props;
  const { fitView, getIntersectingNodes } = useReactFlow();

  const enforcedInitialNodes = initialNodes.map((n) => (n.data.isRoot ? { ...n, deletable: false } : n));

  const [nodes, setNodes, onNodesChange] = useNodesState(enforcedInitialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Used to take undo snapshot only ONCE per edit session, not per keystroke
  const editSnapshotTakenRef = useRef(false);

  // Always look up latest node data so the modal reflects current state mid-edit
  const editingNode = editingNodeId ? nodes.find((n) => n.id === editingNodeId) || null : null;

  const setEditingNode = (node: Node | null) => {
    if (node) {
      editSnapshotTakenRef.current = false;
      setEditingNodeId(node.id);
    } else {
      editSnapshotTakenRef.current = false;
      setEditingNodeId(null);
    }
  };

  const past = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const future = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const currentNodes = useRef(nodes);
  const currentEdges = useRef(edges);

  useEffect(() => {
    currentNodes.current = nodes;
    currentEdges.current = edges;
  }, [nodes, edges]);

  const takeSnapshot = useCallback(() => {
    past.current.push({
      nodes: currentNodes.current.map((n) => ({ ...n })),
      edges: currentEdges.current.map((e) => ({ ...e })),
    });
    future.current = [];
  }, []);

  const undo = useCallback(() => {
    if (past.current.length > 0) {
      future.current.push({
        nodes: currentNodes.current.map((n) => ({ ...n })),
        edges: currentEdges.current.map((e) => ({ ...e })),
      });
      const previous = past.current.pop();
      if (previous) {
        setNodes(previous.nodes);
        setEdges(previous.edges);
      }
    }
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    if (future.current.length > 0) {
      past.current.push({
        nodes: currentNodes.current.map((n) => ({ ...n })),
        edges: currentEdges.current.map((e) => ({ ...e })),
      });
      const next = future.current.pop();
      if (next) {
        setNodes(next.nodes);
        setEdges(next.edges);
      }
    }
  }, [setNodes, setEdges]);

  // Ref to duplicateSelected so the keyboard effect can reference it without TDZ issues
  const duplicateSelectedRef = useRef<() => void>(() => {});

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelectedRef.current();
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      } else if (e.key === 'f' || e.key === 'F') {
        if (!(e.ctrlKey || e.metaKey)) {
          setIsFullscreen((v) => !v);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, isFullscreen]);

  const { visibleNodes, visibleEdges } = useMemo(() => getVisibleElements(nodes, edges), [nodes, edges]);

  // Branch color map
  const branchColors = useMemo(() => computeBranchColors(nodes, edges), [nodes, edges]);

  // Imperative re-layout: always snaps nodes back to auto-layout positions
  const relayout = useCallback((animate = true) => {
    const { visibleNodes: vn, visibleEdges: ve } = getVisibleElements(
      currentNodes.current,
      currentEdges.current
    );
    if (vn.length === 0) return;
    const { nodes: layoutedNodes } = getLayoutedElements(vn, ve);
    setNodes((nds) =>
      nds.map((n) => {
        const ln = layoutedNodes.find((x) => x.id === n.id);
        return ln ? { ...n, position: ln.position } : n;
      })
    );
    if (animate) setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  }, [setNodes, fitView]);

  // Auto-layout on structural change (edges added/removed/reparented/REORDERED, nodes added/removed)
  // IMPORTANTE: edges NÃO sortidos — mudança de ordem precisa disparar relayout pra reposicionar irmãos
  const structuralKey = useMemo(() => {
    // edges NÃO sortidos — preserva ordem (importante pra reorder de irmãos)
    const edgeKey = edges
      .map((e) => `${e.source}->${e.target}`)
      .join('|');
    const nodeKey = nodes
      .map((n) => `${n.id}:${n.data?.isCollapsed ? 'c' : 'o'}`)
      .sort()
      .join('|');
    return `${nodeKey}__${edgeKey}`;
  }, [nodes, edges]);

  useEffect(() => {
    relayout(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structuralKey]);

  // Re-fit when fullscreen toggles
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 80);
    return () => clearTimeout(t);
  }, [isFullscreen, fitView]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (changes.some((c) => c.type === 'remove')) takeSnapshot();
      onNodesChange(changes);
    },
    [onNodesChange, takeSnapshot]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (changes.some((c) => c.type === 'remove')) takeSnapshot();
      onEdgesChange(changes);
    },
    [onEdgesChange, takeSnapshot]
  );

  const onAddChild = useCallback(
    (parentId: string) => {
      takeSnapshot();
      const newNodeId = `node_${Date.now()}`;
      const newNode: Node = {
        id: newNodeId,
        position: { x: 0, y: 0 },
        data: { label: 'Novo Tópico' },
        type: 'editableNode',
      };

      // Color of the new edge = branch color of parent (or first available if parent is root)
      const parentBranchColor = branchColors[parentId];
      const edgeColor =
        parentBranchColor && parentBranchColor !== '#FFFFFF'
          ? parentBranchColor
          : BRANCH_COLORS[edges.filter((e) => e.source === parentId).length % BRANCH_COLORS.length];

      const newEdge: Edge = {
        id: `edge_${parentId}_${newNodeId}`,
        source: parentId,
        target: newNodeId,
        type: 'default', // bezier
        animated: false,
        style: { stroke: edgeColor, strokeWidth: 2.5 },
      };

      setNodes((nds) =>
        nds.map((n) => (n.id === parentId ? { ...n, data: { ...n.data, isCollapsed: false } } : n)).concat(newNode)
      );
      setEdges((eds) => eds.concat(newEdge));
    },
    [setNodes, setEdges, takeSnapshot, branchColors, edges]
  );

  const onToggleCollapse = useCallback(
    (nodeId: string) => {
      takeSnapshot();
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, isCollapsed: !n.data.isCollapsed } } : n))
      );
    },
    [setNodes, takeSnapshot]
  );

  const onUpdateLabel = useCallback(
    (nodeId: string, newLabel: string) => {
      takeSnapshot();
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n))
      );
    },
    [setNodes, takeSnapshot]
  );

  const duplicateSelected = useCallback(() => {
    const selectedNodes = currentNodes.current.filter((n) => n.selected && !n.data.isRoot);
    if (selectedNodes.length === 0) return;

    takeSnapshot();

    // Map old id -> new id
    const idMap = new Map<string, string>();
    const now = Date.now();
    selectedNodes.forEach((n, idx) => {
      idMap.set(n.id, `node_${now}_${idx}`);
    });

    // Clone nodes with new ids, offset position, deselected
    const clonedNodes: Node[] = selectedNodes.map((n) => ({
      ...n,
      id: idMap.get(n.id)!,
      position: { x: n.position.x + 40, y: n.position.y + 40 },
      selected: true, // select the new clones
      data: { ...n.data, isRoot: false },
    }));

    // Clone internal edges (both endpoints inside selection)
    const clonedEdges: Edge[] = currentEdges.current
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e, idx) => ({
        ...e,
        id: `edge_${now}_${idx}`,
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
      }));

    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })).concat(clonedNodes));
    setEdges((eds) => eds.concat(clonedEdges));
  }, [setNodes, setEdges, takeSnapshot]);

  // Keep the ref in sync so the keyboard effect calls the latest version
  useEffect(() => {
    duplicateSelectedRef.current = duplicateSelected;
  }, [duplicateSelected]);

  // Track which nodes are being dragged (for visual "disconnected" feedback)
  const [draggingIds, setDraggingIds] = useState<Set<string>>(new Set());

  const onNodeDragStart = useCallback((_event: any, draggedNode: Node) => {
    const selected = currentNodes.current.filter((n) => n.selected && !n.data.isRoot);
    const ids = new Set<string>();
    if (selected.some((n) => n.id === draggedNode.id) && selected.length > 0) {
      selected.forEach((n) => ids.add(n.id));
    } else {
      if (!draggedNode.data?.isRoot) ids.add(draggedNode.id);
    }
    setDraggingIds(ids);
  }, []);

  // Re-parent selected nodes onto the node they were dropped on
  const onNodeDragStop = useCallback(
    (_event: any, draggedNode: Node) => {
      // Clear drag state no matter what
      setDraggingIds(new Set());
      // Build the set of nodes being moved (current selection OR just the dragged one)
      const selected = currentNodes.current.filter((n) => n.selected && !n.data.isRoot);
      const movingNodes: Node[] = selected.length > 0
        ? (selected.some((n) => n.id === draggedNode.id) ? selected : [draggedNode])
        : [draggedNode];

      // Can't reparent root
      const reparentable = movingNodes.filter((n) => !n.data.isRoot);
      if (reparentable.length === 0) return;

      // Find a target: a node that intersects the dragged node and isn't part of the moving set
      const movingIds = new Set(reparentable.map((n) => n.id));
      const intersects = getIntersectingNodes(draggedNode) || [];
      const targetCandidates = intersects.filter((n: Node) => !movingIds.has(n.id));

      // ----- SIBLING REORDER -----
      // Se não soltou em cima de outro nó, talvez seja só uma reordenação entre irmãos
      if (targetCandidates.length === 0) {
        // Só reordenamos se está movendo APENAS um nó (não múltipla seleção)
        if (reparentable.length === 1) {
          const n = reparentable[0];
          // Acha o pai (única edge incoming)
          const parentEdge = currentEdges.current.find((e) => e.target === n.id);
          if (parentEdge) {
            const parentId = parentEdge.source;
            // Lista ordenada atual dos irmãos por posição Y atual
            const siblingEdges = currentEdges.current
              .filter((e) => e.source === parentId)
              .map((e) => {
                const sibNode = currentNodes.current.find((nn) => nn.id === e.target);
                return { edge: e, y: sibNode?.position.y ?? 0 };
              });
            // Y atual do nó arrastado (já com a nova posição)
            const draggedY = draggedNode.position.y;
            // Substitui a Y do irmão arrastado pela Y nova de drop
            const siblingsWithNewY = siblingEdges.map((s) =>
              s.edge.target === n.id ? { ...s, y: draggedY } : s
            );
            siblingsWithNewY.sort((a, b) => a.y - b.y);
            const newOrderIds = siblingsWithNewY.map((s) => s.edge.target);
            const oldOrderIds = siblingEdges.map((s) => s.edge.target);
            const orderChanged = newOrderIds.some((id, i) => id !== oldOrderIds[i]);
            if (orderChanged) {
              takeSnapshot();
              setEdges((eds) => {
                // Remove os edges desse pai e re-adiciona na ordem nova
                const otherEdges = eds.filter((e) => e.source !== parentId);
                const reorderedEdges = newOrderIds.map((targetId) => {
                  const orig = eds.find((e) => e.source === parentId && e.target === targetId);
                  return orig!;
                });
                return [...otherEdges, ...reorderedEdges];
              });
            }
          }
        }
        return;
      }
      const target = targetCandidates[0];

      // Prevent cycles: target cannot be a descendant of any moving node
      const descendantsOf = (rootId: string): Set<string> => {
        const out = new Set<string>();
        const q = [rootId];
        while (q.length) {
          const cur = q.shift()!;
          currentEdges.current
            .filter((e) => e.source === cur)
            .forEach((e) => {
              if (!out.has(e.target)) {
                out.add(e.target);
                q.push(e.target);
              }
            });
        }
        return out;
      };
      for (const n of reparentable) {
        const descs = descendantsOf(n.id);
        if (descs.has(target.id) || n.id === target.id) return;
      }

      takeSnapshot();

      const parentBranchColor = branchColors[target.id];
      const fallbackColor = (idx: number) =>
        BRANCH_COLORS[(currentEdges.current.filter((e) => e.source === target.id).length + idx) % BRANCH_COLORS.length];
      const edgeColor =
        parentBranchColor && parentBranchColor !== '#FFFFFF' ? parentBranchColor : fallbackColor(0);

      setEdges((eds) => {
        // Remove all existing edges where the moving node is a target (old parent)
        const filtered = eds.filter((e) => !movingIds.has(e.target));
        const newEdges: Edge[] = reparentable.map((n, idx) => ({
          id: `edge_${target.id}_${n.id}_${Date.now()}_${idx}`,
          source: target.id,
          target: n.id,
          type: 'default',
          animated: false,
          style: { stroke: edgeColor, strokeWidth: 2.5 },
        }));
        return filtered.concat(newEdges);
      });

      // Make sure the target isn't collapsed so the new children show up
      setNodes((nds) =>
        nds.map((n) => (n.id === target.id ? { ...n, data: { ...n.data, isCollapsed: false } } : n))
      );
    },
    [getIntersectingNodes, setEdges, setNodes, takeSnapshot, branchColors]
  );

  // Wrapper: after ANY drag stop, also snap back to auto-layout
  const handleNodeDragStop = useCallback(
    (event: any, node: Node) => {
      onNodeDragStop(event, node);
      // Relayout after edges/nodes state commit
      setTimeout(() => relayout(true), 20);
    },
    [onNodeDragStop, relayout]
  );

  // Inject handlers + branch color into node data
  const nodesWithHandlers = visibleNodes.map((node) => {
    const hasChildren = edges.some((e) => e.source === node.id);
    const isBeingDragged = draggingIds.has(node.id);
    return {
      ...node,
      data: {
        ...node.data,
        hasChildren,
        branchColor: branchColors[node.id],
        isBeingDragged,
        onAddChild,
        onToggleCollapse,
        onUpdateLabel,
      },
    };
  });

  // Style edges with branch colors
  const styledEdges = visibleEdges.map((e) => {
    const color = branchColors[e.target] || (e.style as any)?.stroke || '#FFB020';
    // If the target of this edge is being dragged, dim/dash the edge to show it's "disconnecting"
    const targetIsBeingDragged = draggingIds.has(e.target);
    return {
      ...e,
      type: 'default',
      animated: targetIsBeingDragged,
      style: {
        stroke: color,
        strokeWidth: 2.5,
        opacity: targetIsBeingDragged ? 0.25 : 1,
        strokeDasharray: targetIsBeingDragged ? '6 4' : undefined,
      },
    };
  });

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      takeSnapshot();
      const color = branchColors[(params as any).target] || '#FFB020';
      setEdges((eds) =>
        addEdge(
          { ...params, type: 'default', animated: false, style: { stroke: color, strokeWidth: 2.5 } } as any,
          eds
        )
      );
    },
    [setEdges, takeSnapshot, branchColors]
  );

  useEffect(() => {
    onChange(nodes, edges);
  }, [nodes, edges, onChange]);

  const deleteSelected = () => {
    takeSnapshot();
    setNodes((nds) => nds.filter((n) => !n.selected || n.deletable === false));
    setEdges((eds) => eds.filter((e) => !e.selected));
  };

  const handleNodeClick = (_e: React.MouseEvent, node: Node) => {
    setEditingNode(node);
  };

  const saveNodeDetails = (updatedData: any) => {
    // Snapshot do undo APENAS uma vez por sessão de edição (não por keystroke)
    if (!editSnapshotTakenRef.current) {
      takeSnapshot();
      editSnapshotTakenRef.current = true;
    }
    if (updatedData._delete) {
      setNodes((nds) => nds.filter((n) => n.id !== editingNodeId));
      setEdges((eds) => eds.filter((e) => e.source !== editingNodeId && e.target !== editingNodeId));
      setEditingNode(null);
      return;
    }
    setNodes((nds) =>
      nds.map((n) => (n.id === editingNodeId ? { ...n, data: { ...n.data, ...updatedData } } : n))
    );
  };

  // Wrapper classes depending on fullscreen
  const wrapperClass = isFullscreen
    ? 'fixed inset-0 z-[90] bg-bg flex flex-col'
    : 'w-full h-full relative';

  const wrapperStyle: React.CSSProperties = isFullscreen ? {} : { minHeight: '600px' };

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={styledEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={handleNodeClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={true}
        // Pan com drag esquerdo (padrão Figma)
        panOnDrag={true}
        panOnScroll={true}
        // Marquee de seleção SÓ com Shift+drag (evita seleções acidentais)
        selectionOnDrag={false}
        selectionKeyCode={'Shift'}
        selectNodesOnDrag={false}
        multiSelectionKeyCode={['Meta', 'Control']}
        deleteKeyCode={['Delete', 'Backspace']}
        className="bg-bg"
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        {/* Top-right toolbar */}
        <Panel position="top-right" className="flex gap-0 bg-surface/95 backdrop-blur border border-border-subtle">
          <button
            onClick={undo}
            className="p-2 hover:bg-surface-2 text-text-muted hover:text-text-main transition-colors border-r border-border-subtle"
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            className="p-2 hover:bg-surface-2 text-text-muted hover:text-text-main transition-colors border-r border-border-subtle"
            title="Refazer (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            onClick={deleteSelected}
            className="p-2 hover:bg-error/20 text-text-muted hover:text-error transition-colors border-r border-border-subtle"
            title="Excluir Selecionado"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsFullscreen((v) => !v)}
            className="px-3 py-2 hover:bg-accent hover:text-black text-accent transition-colors flex items-center gap-2"
            title={isFullscreen ? 'Sair (ESC ou F)' : 'Tela cheia (F)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="text-[10px] font-mono tracking-[0.2em] hidden sm:inline font-bold">
              {isFullscreen ? 'SAIR' : 'EXPANDIR'}
            </span>
          </button>
        </Panel>

        {/* Bottom-left hint in fullscreen */}
        {isFullscreen && (
          <Panel position="bottom-left" className="text-[10px] font-mono tracking-[0.2em] text-text-muted bg-surface/90 backdrop-blur px-3 py-1.5 border border-border-subtle">
            ESC / F · SAIR
          </Panel>
        )}

        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeColor={(n: any) => branchColors[n.id] || '#FFB020'}
          nodeColor={(n: any) => (n.data?.isRoot ? '#FFB020' : '#1A1A1A')}
          maskColor="rgba(0,0,0,0.7)"
          pannable
          zoomable
        />
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#333" />
      </ReactFlow>

      {editingNode &&
        (props.renderNodeModal ? (
          props.renderNodeModal(editingNode, () => setEditingNode(null), saveNodeDetails)
        ) : (
          <NodeModal node={editingNode} onClose={() => setEditingNode(null)} onSave={saveNodeDetails} />
        ))}
    </div>
  );
}

export function MindMapEditor(props: MindMapEditorProps) {
  return (
    <ReactFlowProvider>
      <MindMapEditorInner {...props} />
    </ReactFlowProvider>
  );
}
