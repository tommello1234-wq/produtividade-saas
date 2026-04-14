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
  EdgeChange
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Trash2, X, AlignLeft, Minus } from 'lucide-react';
import dagre from 'dagre';

const nodeWidth = 250;
const nodeHeight = 60;

const getVisibleElements = (nodes: Node[], edges: Edge[]) => {
  const visibleNodeIds = new Set<string>();
  const roots = nodes.filter(n => !edges.some(e => e.target === n.id));
  
  const queue = [...roots];
  while(queue.length > 0) {
    const current = queue.shift()!;
    visibleNodeIds.add(current.id);
    
    if (!current.data.isCollapsed) {
      const childrenIds = edges.filter(e => e.source === current.id).map(e => e.target);
      const children = nodes.filter(n => childrenIds.includes(n.id) && !visibleNodeIds.has(n.id));
      queue.push(...children);
    }
  }
  
  const visibleNodes = nodes.filter(n => visibleNodeIds.has(n.id));
  const visibleEdges = edges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
  
  return { visibleNodes, visibleEdges };
};

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, ranksep: 100, nodesep: 50 });

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

// Custom Editable Node
const EditableNode = memo(({ data, isConnectable, id }: NodeProps) => {
  const isRoot = !!data.isRoot;
  const isCollapsed = !!data.isCollapsed;
  const hasChildren = !!data.hasChildren;

  return (
    <div className={`relative px-4 py-3 shadow-sm rounded-xl border-2 min-w-[200px] group transition-all cursor-pointer hover:shadow-md hover:ring-2 ring-accent/30 ${isRoot ? 'bg-accent text-black border-accent' : 'bg-surface border-accent text-text-main'}`}>
      {!isRoot && (
        <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="w-2 h-2 bg-accent border-none !-left-1" />
      )}
      
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium flex-1 text-center">{data.label as string}</div>
      </div>

      <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="w-2 h-2 bg-accent border-none !-right-1" />

      {/* Add Child Button (Bottom) */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          typeof data.onAddChild === 'function' && data.onAddChild(id);
        }}
        className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-accent text-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md hover:scale-110 z-10"
        title="Adicionar Tópico"
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* Expand/Collapse Button (Right) */}
      {hasChildren && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            typeof data.onToggleCollapse === 'function' && data.onToggleCollapse(id);
          }}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-surface-2 border border-border-subtle text-text-main rounded-full flex items-center justify-center transition-all shadow-md hover:scale-110 z-10"
          title={isCollapsed ? "Expandir" : "Recolher"}
        >
          {isCollapsed ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
        </button>
      )}

      {/* Description Indicator */}
      {data.description && (
        <div className="absolute -top-2 right-2 bg-bg border border-border-subtle rounded-full p-0.5" title="Possui descrição">
          <AlignLeft className="w-3 h-3 text-text-muted" />
        </div>
      )}
    </div>
  );
});

const nodeTypes = {
  editableNode: EditableNode,
};

interface MindMapEditorProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onChange: (nodes: Node[], edges: Edge[]) => void;
  renderNodeModal?: (node: Node, onClose: () => void, onSave: (data: any) => void) => React.ReactNode;
}

function NodeModal({ node, onClose, onSave }: { node: Node, onClose: () => void, onSave: (data: any) => void }) {
  const [label, setLabel] = useState(node.data.label as string);
  const [description, setDescription] = useState((node.data.description as string) || '');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface w-full max-w-2xl rounded-xl shadow-2xl border border-border-subtle flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-border-subtle">
          <h2 className="text-xl font-semibold text-text-main">Detalhes do Tópico</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Título</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-bg border border-border-subtle rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-accent"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-bg border border-border-subtle rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-accent min-h-[200px] resize-y"
              placeholder="Adicione mais detalhes aqui..."
            />
          </div>
        </div>
        <div className="p-6 border-t border-border-subtle flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-text-muted hover:text-text-main transition-colors">
            Cancelar
          </button>
          <button onClick={() => { onSave({ label, description }); onClose(); }} className="px-4 py-2 bg-accent text-black rounded-lg hover:bg-accent/90 transition-colors font-medium">
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function MindMapEditorInner(props: MindMapEditorProps) {
  const { initialNodes, initialEdges, onChange } = props;
  const { fitView } = useReactFlow();
  
  // Enforce deletable: false on root nodes
  const enforcedInitialNodes = initialNodes.map(n => n.data.isRoot ? { ...n, deletable: false } : n);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(enforcedInitialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [editingNode, setEditingNode] = useState<Node | null>(null);

  // History states for Undo/Redo
  const past = useRef<{nodes: Node[], edges: Edge[]}[]>([]);
  const future = useRef<{nodes: Node[], edges: Edge[]}[]>([]);
  const currentNodes = useRef(nodes);
  const currentEdges = useRef(edges);

  useEffect(() => {
    currentNodes.current = nodes;
    currentEdges.current = edges;
  }, [nodes, edges]);

  const takeSnapshot = useCallback(() => {
    past.current.push({
      nodes: currentNodes.current.map(n => ({...n})),
      edges: currentEdges.current.map(e => ({...e}))
    });
    future.current = [];
  }, []);

  const undo = useCallback(() => {
    if (past.current.length > 0) {
      future.current.push({
        nodes: currentNodes.current.map(n => ({...n})),
        edges: currentEdges.current.map(e => ({...e}))
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
        nodes: currentNodes.current.map(n => ({...n})),
        edges: currentEdges.current.map(e => ({...e}))
      });
      const next = future.current.pop();
      if (next) {
        setNodes(next.nodes);
        setEdges(next.edges);
      }
    }
  }, [setNodes, setEdges]);

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const { visibleNodes, visibleEdges } = useMemo(() => getVisibleElements(nodes, edges), [nodes, edges]);

  // Auto-layout when nodes or edges are added/removed
  useEffect(() => {
    if (visibleNodes.length === 0) return;
    
    const { nodes: layoutedNodes } = getLayoutedElements(visibleNodes, visibleEdges);
    
    let changed = false;
    const updatedNodes = nodes.map(n => {
      const ln = layoutedNodes.find(x => x.id === n.id);
      if (ln && (Math.abs(ln.position.x - n.position.x) > 1 || Math.abs(ln.position.y - n.position.y) > 1)) {
        changed = true;
        return { ...n, position: ln.position };
      }
      return n;
    });
    
    if (changed) {
      setNodes(updatedNodes);
      setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 50);
    }
  }, [visibleNodes.length, visibleEdges.length, setNodes, fitView]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    if (changes.some(c => c.type === 'remove')) {
      takeSnapshot();
    }
    onNodesChange(changes);
  }, [onNodesChange, takeSnapshot]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (changes.some(c => c.type === 'remove')) {
      takeSnapshot();
    }
    onEdgesChange(changes);
  }, [onEdgesChange, takeSnapshot]);

  const onAddChild = useCallback((parentId: string) => {
    takeSnapshot();
    const newNodeId = `node_${Date.now()}`;
    const newNode: Node = {
      id: newNodeId,
      position: { x: 0, y: 0 },
      data: { label: 'Novo Tópico' },
      type: 'editableNode'
    };
    
    const newEdge: Edge = {
      id: `edge_${parentId}_${newNodeId}`,
      source: parentId,
      target: newNodeId,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#E8A0BF', strokeWidth: 2 }
    };

    setNodes((nds) => nds.map(n => n.id === parentId ? { ...n, data: { ...n.data, isCollapsed: false } } : n).concat(newNode));
    setEdges((eds) => eds.concat(newEdge));
  }, [setNodes, setEdges, takeSnapshot]);

  const onToggleCollapse = useCallback((nodeId: string) => {
    takeSnapshot();
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        return { ...n, data: { ...n.data, isCollapsed: !n.data.isCollapsed } };
      }
      return n;
    }));
  }, [setNodes, takeSnapshot]);

  // Inject handlers into node data
  const nodesWithHandlers = visibleNodes.map(node => {
    const hasChildren = edges.some(e => e.source === node.id);
    return {
      ...node,
      data: {
        ...node.data,
        hasChildren,
        onAddChild: onAddChild,
        onToggleCollapse: onToggleCollapse
      }
    };
  });

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      takeSnapshot();
      setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true, style: { stroke: '#E8A0BF', strokeWidth: 2 } } as any, eds));
    },
    [setEdges, takeSnapshot],
  );

  // Notify parent of changes
  useEffect(() => {
    onChange(nodes, edges);
  }, [nodes, edges, onChange]);

  const deleteSelected = () => {
    takeSnapshot();
    setNodes((nds) => nds.filter((n) => !n.selected || n.deletable === false));
    setEdges((eds) => eds.filter((e) => !e.selected));
  };

  const handleNodeClick = (e: React.MouseEvent, node: Node) => {
    setEditingNode(node);
  };

  const saveNodeDetails = (updatedData: any) => {
    takeSnapshot();
    if (updatedData._delete) {
      setNodes(nds => nds.filter(n => n.id !== editingNode?.id));
      setEdges(eds => eds.filter(e => e.source !== editingNode?.id && e.target !== editingNode?.id));
      setEditingNode(null);
      return;
    }
    setNodes(nds => nds.map(n => {
      if (n.id === editingNode?.id) {
        return { ...n, data: { ...n.data, ...updatedData } };
      }
      return n;
    }));
    // Don't close the modal on every save so the user can keep editing
    // setEditingNode(null);
  };

  return (
    <div className="w-full h-full relative" style={{ minHeight: '600px' }}>
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={visibleEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        className="bg-bg"
        colorMode="dark"
      >
        <Panel position="top-right" className="flex gap-2 bg-surface p-2 rounded border border-border-subtle">
          <button onClick={deleteSelected} className="p-2 bg-error text-black rounded hover:bg-error/80 transition-colors" title="Excluir Selecionado">
            <Trash2 className="w-4 h-4" />
          </button>
        </Panel>
        <Controls />
        <MiniMap nodeStrokeColor="#E8A0BF" nodeColor="#1A1A1A" maskColor="rgba(0,0,0,0.8)" />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>

      {editingNode && (
        props.renderNodeModal 
          ? props.renderNodeModal(editingNode, () => setEditingNode(null), saveNodeDetails)
          : <NodeModal
              node={editingNode}
              onClose={() => setEditingNode(null)}
              onSave={saveNodeDetails}
            />
      )}
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
