import React, { useState, useEffect, useCallback } from 'react';
import { Plus, MoreHorizontal, Link as LinkIcon, ChevronRight, ChevronDown, Folder, LayoutGrid, Settings, Trash2, Edit2, X, Check, BookOpen, Cloud, AlignLeft, GripVertical, PlayCircle, CheckSquare, ImagePlus, Copy, Calendar, User, Type, ChevronDownCircle, Hash, List, Loader2, Paperclip, PanelLeft } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '../lib/supabase';
import { MindMapEditor } from './MindMapEditor';

type PropertyType = 'text' | 'number' | 'select' | 'multi-select' | 'status' | 'date' | 'person' | 'files' | 'checkbox' | 'url';

type PropertyOption = {
  id: string;
  label: string;
  color: string;
};

type NodeCheck = {
  id: string;
  label: string;
  color: string;
  type?: PropertyType;
  options?: PropertyOption[];
};

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

type AcademyNode = {
  id: string;
  parentId: string | null;
  title: string;
  columns: Column[];
  isExpanded: boolean;
  checks?: NodeCheck[];
  viewType?: 'table' | 'mindmap';
  mindmapData?: { nodes: any[], edges: any[] };
};

type AcademyData = {
  nodes: AcademyNode[];
  globalChecks?: NodeCheck[]; // Legacy support
};

const INITIAL_NODE_CHECKS: NodeCheck[] = [
  { id: 'tag_status', label: 'Status', color: '#4A4A4A', type: 'select', options: [
    { id: 'opt_1', label: 'Pendente', color: '#FF4500' },
    { id: 'opt_2', label: 'Em Progresso', color: '#1E90FF' },
    { id: 'opt_3', label: 'Concluído', color: '#2E8B57' }
  ]},
  { id: 'tag_resp', label: 'Responsável', color: '#4A4A4A', type: 'person' },
  { id: 'tag_date', label: 'Data', color: '#4A4A4A', type: 'date' },
  { id: 'tag_url', label: 'URL', color: '#4A4A4A', type: 'url' },
  { id: 'chk_rec', label: 'Gravada', color: '#2E8B57', type: 'checkbox' },
  { id: 'chk_edi', label: 'Editado', color: '#1E90FF', type: 'checkbox' },
  { id: 'chk_up', label: 'Upado', color: '#9370DB', type: 'checkbox' },
];

const INITIAL_DATA: AcademyData = {
  nodes: [
    {
      id: 'node_root',
      parentId: null,
      title: 'Creative Academy',
      columns: [],
      isExpanded: true
    },
    {
      id: 'node_sub1',
      parentId: 'node_root',
      title: 'Layout Design',
      columns: [
        {
          id: 'col_1',
          title: '01. Conhecendo o Figma',
          cards: [
            { id: 'card_1', title: '01. Conhecendo o Figma', description: '', link: '', checks: {} },
            { id: 'card_2', title: '02. Como ter o plano pro grátis', description: '', link: '', checks: {} },
          ]
        },
        {
          id: 'col_2',
          title: '03. Landing Pages',
          cards: [
            { id: 'card_3', title: '01. Pág de Vendas Design', description: '', link: '', checks: { 'chk_rec': true, 'chk_edi': true, 'chk_up': true } },
          ]
        }
      ],
      isExpanded: true
    }
  ],
  globalChecks: INITIAL_NODE_CHECKS
};

const injectWebDesignerCourse = (data: AcademyData): AcademyData => {
  const hasInjected = localStorage.getItem('injected_web_designer_v3');
  if (hasInjected) return data;

  const safeGlobalChecks = Array.isArray(data?.globalChecks) ? data.globalChecks : [];
  const safeNodes = (Array.isArray(data?.nodes) ? data.nodes : []).map(node => ({
    ...node,
    checks: node.checks || safeGlobalChecks
  }));

  const newData = { ...data, nodes: [...safeNodes], globalChecks: [...safeGlobalChecks] };

  // Find "laucher designer" or "launcher designer"
  let launcherNode = newData.nodes.find(n => (n.title || '').toLowerCase().includes('laucher designer') || (n.title || '').toLowerCase().includes('launcher designer'));
  
  if (!launcherNode) {
    launcherNode = {
      id: `node_${Date.now()}_launcher`,
      parentId: null,
      title: 'Launcher Designer',
      columns: [],
      isExpanded: true,
      checks: safeGlobalChecks
    };
    newData.nodes.push(launcherNode);
  }

  // Find "Web designer do futuro"
  let webDesignerNode = newData.nodes.find(n => (n.title || '').toLowerCase().includes('web designer do futuro') && n.parentId === launcherNode!.id);
  
  if (!webDesignerNode) {
    webDesignerNode = newData.nodes.find(n => (n.title || '').toLowerCase().includes('web designer do futuro'));
  }

  if (!webDesignerNode) {
    webDesignerNode = {
      id: `node_${Date.now()}_webdesigner`,
      parentId: launcherNode.id,
      title: 'Web Designer do Futuro',
      columns: [],
      isExpanded: true,
      checks: safeGlobalChecks
    };
    newData.nodes.push(webDesignerNode);
  }

  // Add the columns if they don't exist
  const hasInfra = (webDesignerNode.columns || []).some(c => (c.title || '').toLowerCase().includes('infraestrutura'));
  
  if (!hasInfra) {
    const newColumns: Column[] = [
      {
        id: `col_${Date.now()}_infra`,
        title: 'Infraestrutura',
        cards: [
          { id: `card_${Date.now()}_1`, title: 'O que é Vibe Design', description: '', link: '', checks: { 'chk_rec': true, 'chk_edi': true, 'chk_up': false } },
          { id: `card_${Date.now()}_2`, title: 'Ferramentas que vamos utilizar', description: '', link: '', checks: { 'chk_rec': true, 'chk_edi': true, 'chk_up': false } },
          { id: `card_${Date.now()}_3`, title: 'Boas práticas', description: '', link: '', checks: { 'chk_rec': true, 'chk_edi': true, 'chk_up': false } },
        ]
      },
      {
        id: `col_${Date.now()}_agentes`,
        title: 'Agentes de IA',
        cards: [
          { id: `card_${Date.now()}_4`, title: 'Antigravity', description: '', link: '', checks: {} },
          { id: `card_${Date.now()}_5`, title: 'Claude Code', description: '', link: '', checks: {} },
          { id: `card_${Date.now()}_6`, title: 'Skills', description: '', link: '', checks: {} },
          { id: `card_${Date.now()}_7`, title: 'Templates', description: '', link: '', checks: {} },
        ]
      },
      {
        id: `col_${Date.now()}_proj1`,
        title: 'Primeiro Projeto',
        cards: [
          { id: `card_${Date.now()}_8`, title: 'Buscando por referências', description: '', link: '', checks: { 'chk_rec': true } },
          { id: `card_${Date.now()}_9`, title: 'Construindo seu Design System', description: '', link: '', checks: { 'chk_rec': true } },
          { id: `card_${Date.now()}_10`, title: 'Montando sua copy e definindo WireFrame', description: '', link: '', checks: {} },
          { id: `card_${Date.now()}_11`, title: 'Landing Page Gravyx - Parte 01', description: '', link: '', checks: { 'chk_rec': true } },
          { id: `card_${Date.now()}_12`, title: 'Landing Page Gravyx - Parte 02', description: '', link: '', checks: { 'chk_rec': true } },
        ]
      },
      {
        id: `col_${Date.now()}_proj2`,
        title: 'SEGUNDO PROJETO',
        cards: [
          { id: `card_${Date.now()}_13`, title: 'hero section', description: '', link: '', checks: {} },
        ]
      },
      {
        id: `col_${Date.now()}_port`,
        title: 'MONTANDO UM PORTFÓLIO',
        cards: [
          { id: `card_${Date.now()}_14`, title: 'Como criar background insanos', description: '', link: '', checks: {} },
        ]
      }
    ];

    const nodeIndex = newData.nodes.findIndex(n => n.id === webDesignerNode!.id);
    if (nodeIndex !== -1) {
      newData.nodes[nodeIndex] = {
        ...newData.nodes[nodeIndex],
        columns: [...(newData.nodes[nodeIndex].columns || []), ...newColumns]
      };
    }
  }

  localStorage.setItem('injected_web_designer_v3', 'true');
  return newData;
};

export default function Academy() {
  const [data, setData] = useState<AcademyData>({ nodes: [], globalChecks: INITIAL_NODE_CHECKS });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragState, setDragState] = useState<{ id: string, position: 'before' | 'after' | 'inside' } | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  const [editingCard, setEditingCard] = useState<{ nodeId: string, colId: string, cardId: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    type: 'input' | 'confirm' | 'node-create';
    value: string;
    viewType?: 'table' | 'mindmap';
    placeholder?: string;
    onConfirm: (val: string, viewType?: 'table' | 'mindmap') => void;
  }>({
    isOpen: false,
    title: '',
    type: 'input',
    value: '',
    viewType: 'table',
    onConfirm: () => {}
  });

  const openPrompt = (title: string, placeholder: string, defaultValue: string, onConfirm: (val: string) => void) => {
    setModalConfig({ isOpen: true, title, type: 'input', value: defaultValue, placeholder, onConfirm });
  };

  const openNodeCreate = (title: string, placeholder: string, defaultValue: string, onConfirm: (val: string, viewType: 'table' | 'mindmap') => void) => {
    setModalConfig({ isOpen: true, title, type: 'node-create', value: defaultValue, viewType: 'table', placeholder, onConfirm });
  };

  const openConfirm = (title: string, onConfirm: () => void) => {
    setModalConfig({ isOpen: true, title, type: 'confirm', value: '', onConfirm });
  };

  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  useEffect(() => {
    const fetchAcademyData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        let parsed = null;

        if (user) {
          const { data: dbData, error } = await supabase
            .from('academy_data')
            .select('data')
            .eq('user_id', user.id)
            .single();

          if (dbData && dbData.data) {
            parsed = dbData.data;
          }
        }

        // Fallback to localStorage if Supabase fails or is empty
        if (!parsed) {
          const localData = localStorage.getItem('academy_data_v2');
          if (localData) {
            parsed = JSON.parse(localData);
          }
        }

        if (parsed) {
          // Migration from old structure to new structure
          if (Array.isArray(parsed) && parsed.length > 0 && 'modules' in parsed[0]) {
            const newNodes: AcademyNode[] = [];
            parsed.forEach((course: any) => {
              const courseNode: AcademyNode = { id: course.id, parentId: null, title: course.title, columns: [], isExpanded: true };
              newNodes.push(courseNode);
              course.modules.forEach((mod: any) => {
                const modNode: AcademyNode = {
                  id: mod.id,
                  parentId: course.id,
                  title: mod.title,
                  columns: mod.columns.map((col: any) => ({
                    id: col.id,
                    title: col.title,
                    cards: col.cards.map((card: any) => ({
                      id: card.id,
                      title: card.title,
                      description: '',
                      link: card.link || '',
                      checks: {
                        'chk_rec': card.status?.recorded || false,
                        'chk_edi': card.status?.edited || false,
                        'chk_up': card.status?.uploaded || false,
                      }
                    }))
                  })),
                  isExpanded: true
                };
                newNodes.push(modNode);
              });
            });
            setData(injectWebDesignerCourse({ nodes: newNodes, globalChecks: INITIAL_NODE_CHECKS }));
            if (newNodes.length > 0) setSelectedNodeId(newNodes[0].id);
          } else if (parsed.nodes && parsed.globalChecks) {
            const injectedData = injectWebDesignerCourse(parsed);
            setData(injectedData);
            if (injectedData.nodes.length > 0) setSelectedNodeId(injectedData.nodes[0].id);
          } else {
            const injectedData = injectWebDesignerCourse(INITIAL_DATA);
            setData(injectedData);
            setSelectedNodeId(injectedData.nodes[0].id);
          }
        } else {
          const injectedData = injectWebDesignerCourse(INITIAL_DATA);
          setData(injectedData);
          setSelectedNodeId(injectedData.nodes[0].id);
        }
      } catch (error) {
        console.error('Error fetching academy data:', error);
        
        // Final fallback to localStorage in case of complete failure
        const localData = localStorage.getItem('academy_data_v2');
        if (localData) {
          try {
            const parsed = JSON.parse(localData);
            if (parsed.nodes && parsed.globalChecks) {
              const injectedData = injectWebDesignerCourse(parsed);
              setData(injectedData);
              if (injectedData.nodes.length > 0) setSelectedNodeId(injectedData.nodes[0].id);
              setIsInitialized(true);
              return;
            }
          } catch (e) {}
        }

        const injectedData = injectWebDesignerCourse(INITIAL_DATA);
        setData(injectedData);
        setSelectedNodeId(injectedData.nodes[0].id);
      } finally {
        setIsInitialized(true);
      }
    };

    fetchAcademyData();

    const handleDataChanged = () => {
      fetchAcademyData();
    };

    window.addEventListener('app_data_changed', handleDataChanged);

    return () => {
      window.removeEventListener('app_data_changed', handleDataChanged);
    };
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    const saveData = async () => {
      setSaving(true);
      
      // Always save to localStorage as a reliable backup, but handle quota exceeded errors
      try {
        localStorage.setItem('academy_data_v2', JSON.stringify(data));
      } catch (e) {
        console.warn('Could not save to localStorage (possibly due to quota exceeded by large videos/images).', e);
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
          .from('academy_data')
          .upsert({ 
            user_id: user.id, 
            data: data,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (error) {
          console.error('Supabase save error (table might not exist):', error.message);
        }
      } catch (error) {
        console.error('Error saving academy data:', error);
      } finally {
        setSaving(false);
      }
    };

    const timeoutId = setTimeout(() => {
      saveData();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [data, isInitialized]);

  const safeNodes = Array.isArray(data?.nodes) ? data.nodes : [];
  const selectedNode = safeNodes.find(n => n.id === selectedNodeId);
  const safeNodeChecks = selectedNode?.checks || [];

  const getBreadcrumbs = (nodeId: string): AcademyNode[] => {
    const path: AcademyNode[] = [];
    let current = safeNodes.find(n => n.id === nodeId);
    while (current) {
      path.unshift(current);
      current = safeNodes.find(n => n.id === current!.parentId);
    }
    return path;
  };

  const breadcrumbs = selectedNodeId ? getBreadcrumbs(selectedNodeId) : [];

  const updateNode = useCallback((nodeId: string, updater: (node: AcademyNode) => AcademyNode) => {
    setData(prev => ({
      ...prev,
      nodes: (Array.isArray(prev?.nodes) ? prev.nodes : []).map(n => n.id === nodeId ? updater(n) : n)
    }));
  }, []);

  const handleUpdateMindMap = useCallback((nodes: any[], edges: any[]) => {
    if (!selectedNodeId) return;
    updateNode(selectedNodeId, node => ({
      ...node,
      mindmapData: { nodes, edges }
    }));
  }, [selectedNodeId, updateNode]);

  const handleAddNode = (parentId: string | null) => {
    openNodeCreate('Nova Seção', 'Nome da seção', '', (title, viewType) => {
      if (!title) return;
      const newNode: AcademyNode = {
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        parentId,
        title,
        columns: [],
        isExpanded: true,
        checks: [],
        viewType: viewType || 'table',
        mindmapData: viewType === 'mindmap' ? { 
          nodes: [{ id: `node_${Date.now()}`, position: { x: 250, y: 250 }, data: { label: title, isRoot: true }, type: 'editableNode', deletable: false }], 
          edges: [] 
        } : undefined
      };
      setData(prev => {
        const newNodes = [...(Array.isArray(prev?.nodes) ? prev.nodes : []), newNode];
        if (parentId) {
          const parentIndex = newNodes.findIndex(n => n.id === parentId);
          if (parentIndex !== -1) {
            newNodes[parentIndex] = { ...newNodes[parentIndex], isExpanded: true };
          }
        }
        return { ...prev, nodes: newNodes };
      });
      setSelectedNodeId(newNode.id);
    });
  };

  const handleDuplicateNode = (nodeId: string) => {
    const nodeToDuplicate = safeNodes.find(n => n.id === nodeId);
    if (!nodeToDuplicate) return;

    const generateNewIds = (node: AcademyNode): AcademyNode => {
      const newNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return {
        ...node,
        id: newNodeId,
        title: `${node.title} (Cópia)`,
        columns: node.columns.map(col => ({
          ...col,
          id: `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          cards: col.cards.map(card => ({
            ...card,
            id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          }))
        })),
        checks: node.checks ? [...node.checks] : []
      };
    };

    const duplicateDescendants = (parentId: string, newParentId: string, nodes: AcademyNode[]): AcademyNode[] => {
      const children = nodes.filter(n => n.parentId === parentId);
      let duplicated: AcademyNode[] = [];
      
      for (const child of children) {
        const newChild = generateNewIds(child);
        newChild.parentId = newParentId;
        newChild.title = child.title; // Don't add (Cópia) to children
        duplicated.push(newChild);
        duplicated = [...duplicated, ...duplicateDescendants(child.id, newChild.id, nodes)];
      }
      return duplicated;
    };

    const newNode = generateNewIds(nodeToDuplicate);
    const newDescendants = duplicateDescendants(nodeToDuplicate.id, newNode.id, safeNodes);

    setData(prev => {
      const newNodes = [...(Array.isArray(prev?.nodes) ? prev.nodes : [])];
      const index = newNodes.findIndex(n => n.id === nodeId);
      newNodes.splice(index + 1, 0, newNode, ...newDescendants);
      return { ...prev, nodes: newNodes };
    });
    setSelectedNodeId(newNode.id);
  };

  const handleDeleteNode = (nodeId: string) => {
    openConfirm('Tem certeza que deseja excluir esta seção e todas as suas subseções?', () => {
      const getDescendants = (id: string): string[] => {
        const children = safeNodes.filter(n => n.parentId === id).map(n => n.id);
        return [...children, ...children.flatMap(getDescendants)];
      };
      const toDelete = [nodeId, ...getDescendants(nodeId)];
      setData(prev => ({
        ...prev,
        nodes: (Array.isArray(prev?.nodes) ? prev.nodes : []).filter(n => !toDelete.includes(n.id))
      }));
      if (selectedNodeId && toDelete.includes(selectedNodeId)) {
        setSelectedNodeId(null);
      }
    });
  };

  const handleRenameNode = (nodeId: string, currentTitle: string) => {
    openPrompt('Renomear Seção', 'Novo nome', currentTitle, (title) => {
      if (!title) return;
      updateNode(nodeId, n => ({ ...n, title }));
    });
  };

  const handleAddColumn = () => {
    if (!selectedNodeId) return;
    openPrompt('Nova Coluna', 'Nome da coluna', '', (title) => {
      if (!title) return;
      const newCol: Column = { id: `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, title, cards: [] };
      updateNode(selectedNodeId, n => ({ ...n, columns: [...(n.columns || []), newCol] }));
    });
  };

  const handleRenameColumn = (colId: string, currentTitle: string) => {
    if (!selectedNodeId) return;
    openPrompt('Renomear Coluna', 'Novo nome', currentTitle, (title) => {
      if (!title) return;
      updateNode(selectedNodeId, n => ({
        ...n,
        columns: (n.columns || []).map(c => c.id === colId ? { ...c, title } : c)
      }));
    });
  };

  const handleDeleteColumn = (colId: string) => {
    if (!selectedNodeId) return;
    openConfirm('Tem certeza que deseja excluir esta coluna e todas as suas aulas?', () => {
      updateNode(selectedNodeId, n => ({
        ...n,
        columns: (n.columns || []).filter(c => c.id !== colId)
      }));
    });
  };

  const handleAddCard = (colId: string) => {
    if (!selectedNodeId) return;
    openPrompt('Nova Aula', 'Nome da aula', '', (title) => {
      if (!title) return;
      const newCard: Card = {
        id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        description: '',
        link: '',
        checks: {}
      };
      updateNode(selectedNodeId, n => ({
        ...n,
        columns: (n.columns || []).map(c => c.id === colId ? { ...c, cards: [...(c.cards || []), newCard] } : c)
      }));
    });
  };

  const handleDeleteCard = (nodeId: string, colId: string, cardId: string) => {
    openConfirm('Tem certeza que deseja excluir esta aula?', () => {
      updateNode(nodeId, n => ({
        ...n,
        columns: (n.columns || []).map(c => c.id === colId ? { ...c, cards: (c.cards || []).filter(card => card.id !== cardId) } : c)
      }));
      if (editingCard?.cardId === cardId) setEditingCard(null);
    });
  };

  const handleUpdateCard = (nodeId: string, colId: string, cardId: string, updates: Partial<Card>) => {
    updateNode(nodeId, n => ({
      ...n,
      columns: (n.columns || []).map(c => c.id === colId ? {
        ...c,
        cards: (c.cards || []).map(card => card.id === cardId ? { ...card, ...updates } : card)
      } : c)
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, nodeId: string, colId: string, cardId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      if (file.size > 10 * 1024 * 1024) {
        alert('O vídeo deve ter no máximo 10MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        handleUpdateCard(nodeId, colId, cardId, { coverVideo: event.target?.result as string, coverImage: undefined });
      };
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        handleUpdateCard(nodeId, colId, cardId, { coverImage: dataUrl, coverVideo: undefined });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateCheck = (nodeId: string, colId: string, cardId: string, checkId: string, value: any) => {
    updateNode(nodeId, n => ({
      ...n,
      columns: (n.columns || []).map(c => c.id === colId ? {
        ...c,
        cards: (c.cards || []).map(card => {
          if (card.id !== cardId) return card;
          return {
            ...card,
            checks: {
              ...(card.checks || {}),
              [checkId]: value
            }
          };
        })
      } : c)
    }));
  };

  const getPropertyIcon = (type: PropertyType) => {
    switch (type) {
      case 'text': return <AlignLeft className="w-3.5 h-3.5" />;
      case 'number': return <Hash className="w-3.5 h-3.5" />;
      case 'select': return <ChevronDownCircle className="w-3.5 h-3.5" />;
      case 'multi-select': return <List className="w-3.5 h-3.5" />;
      case 'status': return <Loader2 className="w-3.5 h-3.5" />;
      case 'date': return <Calendar className="w-3.5 h-3.5" />;
      case 'person': return <User className="w-3.5 h-3.5" />;
      case 'files': return <Paperclip className="w-3.5 h-3.5" />;
      case 'checkbox': return <CheckSquare className="w-3.5 h-3.5" />;
      case 'url': return <LinkIcon className="w-3.5 h-3.5" />;
      default: return <AlignLeft className="w-3.5 h-3.5" />;
    }
  };

  const renderPropertyPreview = (check: NodeCheck, value: any, onToggle: () => void) => {
    const type = check.type || 'checkbox';
    switch (type) {
      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer group/check" onClick={e => e.stopPropagation()}>
            <div 
              className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors`}
              style={{ 
                backgroundColor: value ? check.color : 'transparent',
                borderColor: value ? check.color : '#4A4A4A'
              }}
            >
              {value && <Check className="w-3 h-3 text-black" />}
            </div>
            <span className={`text-xs font-mono transition-colors ${value ? 'text-white' : 'text-[#8A8A8A]'}`}>
              {check.label}
            </span>
            <input 
              type="checkbox" 
              className="hidden" 
              checked={value || false} 
              onChange={onToggle} 
            />
          </label>
        );
      case 'text':
      case 'number':
      case 'person':
      case 'files':
      case 'url':
        return (
          <div className="flex items-center gap-2">
            <div className="text-[#8A8A8A]">{getPropertyIcon(type)}</div>
            <span className="text-xs font-mono text-[#8A8A8A] w-20 truncate">{check.label}</span>
            <span className="text-xs font-mono text-white truncate max-w-[120px]">{value || 'Empty'}</span>
          </div>
        );
      case 'date':
        return (
          <div className="flex items-center gap-2">
            <div className="text-[#8A8A8A]">{getPropertyIcon(type)}</div>
            <span className="text-xs font-mono text-[#8A8A8A] w-20 truncate">{check.label}</span>
            <span className="text-xs font-mono text-white">{value ? new Date(value).toLocaleDateString() : 'Empty'}</span>
          </div>
        );
      case 'select':
      case 'status':
        const option = check.options?.find(o => o.id === value);
        return (
          <div className="flex items-center gap-2">
            <div className="text-[#8A8A8A]">{getPropertyIcon(type)}</div>
            <span className="text-xs font-mono text-[#8A8A8A] w-20 truncate">{check.label}</span>
            {option ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm text-black" style={{ backgroundColor: option.color }}>
                {option.label}
              </span>
            ) : (
              <span className="text-xs font-mono text-white">Empty</span>
            )}
          </div>
        );
      case 'multi-select':
        const options = Array.isArray(value) ? value.map(v => check.options?.find(o => o.id === v)).filter(Boolean) : [];
        return (
          <div className="flex items-center gap-2">
            <div className="text-[#8A8A8A]">{getPropertyIcon(type)}</div>
            <span className="text-xs font-mono text-[#8A8A8A] w-20 truncate">{check.label}</span>
            {options.length > 0 ? (
              <div className="flex gap-1 flex-wrap max-w-[150px]">
                {options.map(opt => opt && (
                  <span key={opt.id} className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm text-black" style={{ backgroundColor: opt.color }}>
                    {opt.label}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs font-mono text-white">Empty</span>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const renderPropertyEditor = (check: NodeCheck, value: any, onChange: (val: any) => void) => {
    const type = check.type || 'checkbox';
    switch (type) {
      case 'checkbox':
        return (
          <label className="flex items-center gap-3 p-3 bg-surface-2 border border-border-subtle rounded cursor-pointer hover:border-text-muted transition-colors">
            <div 
              className={`w-5 h-5 rounded-sm border flex items-center justify-center transition-colors shrink-0`}
              style={{ 
                backgroundColor: value ? check.color : 'transparent',
                borderColor: value ? check.color : '#4A4A4A'
              }}
            >
              {value && <Check className="w-3.5 h-3.5 text-black" />}
            </div>
            <span className={`text-sm font-bold truncate transition-colors ${value ? 'text-white' : 'text-[#8A8A8A]'}`}>
              {check.label}
            </span>
            <input 
              type="checkbox" 
              className="hidden" 
              checked={value || false} 
              onChange={(e) => onChange(e.target.checked)} 
            />
          </label>
        );
      case 'text':
      case 'person':
      case 'files':
      case 'url':
        return (
          <div className="flex flex-col gap-1 p-3 bg-surface-2 border border-border-subtle rounded">
            <div className="flex items-center gap-1.5 text-text-muted">
              {getPropertyIcon(type)}
              <span className="text-xs font-mono">{check.label}</span>
            </div>
            <input 
              type={type === 'url' ? 'url' : 'text'}
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Empty"
              className="bg-transparent border-none text-sm font-bold text-white focus:outline-none w-full"
            />
          </div>
        );
      case 'number':
        return (
          <div className="flex flex-col gap-1 p-3 bg-surface-2 border border-border-subtle rounded">
            <div className="flex items-center gap-1.5 text-text-muted">
              {getPropertyIcon(type)}
              <span className="text-xs font-mono">{check.label}</span>
            </div>
            <input 
              type="number"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Empty"
              className="bg-transparent border-none text-sm font-bold text-white focus:outline-none w-full"
            />
          </div>
        );
      case 'date':
        return (
          <div className="flex flex-col gap-1 p-3 bg-surface-2 border border-border-subtle rounded">
            <div className="flex items-center gap-1.5 text-text-muted">
              {getPropertyIcon(type)}
              <span className="text-xs font-mono">{check.label}</span>
            </div>
            <input 
              type="date"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="bg-transparent border-none text-sm font-bold text-white focus:outline-none w-full"
            />
          </div>
        );
      case 'select':
      case 'status':
        return (
          <div className="flex flex-col gap-1 p-3 bg-surface-2 border border-border-subtle rounded">
            <div className="flex items-center gap-1.5 text-text-muted">
              {getPropertyIcon(type)}
              <span className="text-xs font-mono">{check.label}</span>
            </div>
            <select
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="bg-transparent border-none text-sm font-bold text-white focus:outline-none w-full"
            >
              <option value="">Empty</option>
              {check.options?.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        );
      case 'multi-select':
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="flex flex-col gap-1 p-3 bg-surface-2 border border-border-subtle rounded">
            <div className="flex items-center gap-1.5 text-text-muted">
              {getPropertyIcon(type)}
              <span className="text-xs font-mono">{check.label}</span>
            </div>
            <select
              multiple
              value={selectedValues}
              onChange={(e) => {
                const options = Array.from(e.target.selectedOptions, option => option.value);
                onChange(options);
              }}
              className="bg-transparent border-none text-sm font-bold text-white focus:outline-none w-full h-20 custom-scrollbar"
            >
              {check.options?.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        );
      default:
        return null;
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !selectedNodeId) return;
    const { source, destination } = result;

    setData(prev => {
      const newNodes = [...(Array.isArray(prev?.nodes) ? prev.nodes : [])];
      const nodeIndex = newNodes.findIndex(n => n.id === selectedNodeId);
      if (nodeIndex === -1) return prev;

      const node = { ...newNodes[nodeIndex] };
      const newColumns = [...(node.columns || [])];

      const sourceColIndex = newColumns.findIndex(c => c.id === source.droppableId);
      const destColIndex = newColumns.findIndex(c => c.id === destination.droppableId);

      if (sourceColIndex === -1 || destColIndex === -1) return prev;

      const sourceCol = { ...newColumns[sourceColIndex] };
      const destCol = { ...newColumns[destColIndex] };

      const sourceCards = [...(sourceCol.cards || [])];
      const [movedCard] = sourceCards.splice(source.index, 1);

      if (source.droppableId === destination.droppableId) {
        sourceCards.splice(destination.index, 0, movedCard);
        sourceCol.cards = sourceCards;
        newColumns[sourceColIndex] = sourceCol;
      } else {
        const destCards = [...(destCol.cards || [])];
        destCards.splice(destination.index, 0, movedCard);
        sourceCol.cards = sourceCards;
        destCol.cards = destCards;
        newColumns[sourceColIndex] = sourceCol;
        newColumns[destColIndex] = destCol;
      }

      node.columns = newColumns;
      newNodes[nodeIndex] = node;

      return { ...prev, nodes: newNodes };
    });
  };

  const handleNodeDragStart = (e: React.DragEvent, nodeId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', nodeId);
    setDraggedNodeId(nodeId);
  };

  const handleNodeDragOver = (e: React.DragEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedNodeId === nodeId) {
      setDragState(null);
      return;
    }

    const getDescendants = (id: string): string[] => {
      const children = safeNodes.filter(n => n.parentId === id).map(n => n.id);
      return [...children, ...children.flatMap(getDescendants)];
    };
    
    if (draggedNodeId && getDescendants(draggedNodeId).includes(nodeId)) {
      setDragState(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    let position: 'before' | 'after' | 'inside' = 'inside';
    if (y < rect.height * 0.25) position = 'before';
    else if (y > rect.height * 0.75) position = 'after';

    setDragState({ id: nodeId, position });
  };

  const handleNodeDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState(null);
  };

  const handleNodeDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const sourceId = e.dataTransfer.getData('text/plain');
    const currentDragState = dragState;
    
    setDraggedNodeId(null);
    setDragState(null);

    if (!sourceId || sourceId === targetId || !currentDragState) return;

    const getDescendants = (id: string): string[] => {
      const children = safeNodes.filter(n => n.parentId === id).map(n => n.id);
      return [...children, ...children.flatMap(getDescendants)];
    };
    
    if (getDescendants(sourceId).includes(targetId)) return;

    setData(prev => {
      const newNodes = [...(Array.isArray(prev?.nodes) ? prev.nodes : [])];
      const sourceIndex = newNodes.findIndex(n => n.id === sourceId);
      const targetIndex = newNodes.findIndex(n => n.id === targetId);
      
      if (sourceIndex === -1 || targetIndex === -1) return prev;

      const sourceNode = { ...newNodes[sourceIndex] };
      
      // Remove source from array
      newNodes.splice(sourceIndex, 1);
      
      // Recalculate target index since array mutated
      const newTargetIndex = newNodes.findIndex(n => n.id === targetId);
      const targetNode = newNodes[newTargetIndex];

      if (currentDragState.position === 'inside') {
        sourceNode.parentId = targetId;
        // Insert at the end of the new parent's children
        const children = newNodes.filter(n => n.parentId === targetId);
        const lastChild = children[children.length - 1];
        if (lastChild) {
          const lastChildIndex = newNodes.findIndex(n => n.id === lastChild.id);
          newNodes.splice(lastChildIndex + 1, 0, sourceNode);
        } else {
          newNodes.splice(newTargetIndex + 1, 0, sourceNode);
        }
        // Expand the target node
        newNodes[newTargetIndex] = { ...targetNode, isExpanded: true };
      } else {
        sourceNode.parentId = targetNode.parentId;
        if (currentDragState.position === 'before') {
          newNodes.splice(newTargetIndex, 0, sourceNode);
        } else {
          newNodes.splice(newTargetIndex + 1, 0, sourceNode);
        }
      }

      return { ...prev, nodes: newNodes };
    });
  };

  const renderTree = (parentId: string | null, level: number = 0) => {
    const children = safeNodes.filter(n => n.parentId === parentId);
    if (children.length === 0) return null;

    return (
      <div className="space-y-0.5">
        {children.map(node => (
          <div key={node.id}>
            <div
              draggable
              onDragStart={(e) => handleNodeDragStart(e, node.id)}
              onDragOver={(e) => handleNodeDragOver(e, node.id)}
              onDragLeave={handleNodeDragLeave}
              onDrop={(e) => handleNodeDrop(e, node.id)}
              onDragEnd={() => {
                setDragState(null);
                setDraggedNodeId(null);
              }}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-sm cursor-pointer group relative ${selectedNodeId === node.id ? 'bg-surface-3 text-accent' : 'text-text-main hover:bg-surface'} ${dragState?.id === node.id ? 'bg-surface-3' : ''}`}
              style={{ paddingLeft: `${level * 12 + 8}px` }}
              onClick={() => setSelectedNodeId(node.id)}
            >
              {dragState?.id === node.id && dragState.position === 'before' && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent z-10" />
              )}
              {dragState?.id === node.id && dragState.position === 'inside' && (
                <div className="absolute inset-0 border-2 border-accent rounded-sm z-10 pointer-events-none" />
              )}
              {dragState?.id === node.id && dragState.position === 'after' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent z-10" />
              )}
              <div className="cursor-grab active:cursor-grabbing text-text-muted/30 hover:text-text-muted transition-colors">
                <GripVertical className="w-3.5 h-3.5" />
              </div>
              <button
                className="p-0.5 hover:bg-surface-3 rounded text-text-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  updateNode(node.id, n => ({ ...n, isExpanded: !n.isExpanded }));
                }}
              >
                {safeNodes.some(n => n.parentId === node.id) ? (
                  node.isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <div className="w-3.5 h-3.5" /> // spacer
                )}
              </button>
              <span className="text-sm truncate flex-1">{node.title || 'Untitled'}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="p-1 hover:bg-surface-3 rounded text-text-muted"
                  onClick={(e) => { e.stopPropagation(); handleRenameNode(node.id, node.title || 'Untitled'); }}
                  title="Renomear"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  className="p-1 hover:bg-surface-3 rounded text-text-muted"
                  onClick={(e) => { e.stopPropagation(); handleAddNode(node.id); }}
                  title="Adicionar subseção"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1 hover:bg-surface-3 rounded text-text-muted"
                  onClick={(e) => { e.stopPropagation(); handleDuplicateNode(node.id); }}
                  title="Duplicar"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1 hover:bg-error/20 hover:text-error rounded text-text-muted"
                  onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}
                  title="Excluir"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            {node.isExpanded && renderTree(node.id, level + 1)}
          </div>
        ))}
      </div>
    );
  };

  const renderMindMapNodeModal = (node: any, onClose: () => void, onSave: (data: any) => void) => {
    const data = node.data || {};
    
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.type.startsWith('video/')) {
        if (file.size > 10 * 1024 * 1024) {
          alert('O vídeo deve ter no máximo 10MB.');
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          onSave({ coverVideo: event.target?.result as string, coverImage: undefined });
        };
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          onSave({ coverImage: dataUrl, coverVideo: undefined });
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4 animate-in fade-in" onClick={onClose}>
        <div className="bg-surface border border-border-subtle w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl relative" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-6 border-b border-border-subtle bg-surface-2 shrink-0">
            <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
              <LayoutGrid className="w-4 h-4" />
              <span>Detalhes do Tópico</span>
            </div>
            <button onClick={onClose} className="text-text-muted hover:text-text-main transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
            <div>
              <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
                <ImagePlus className="w-3 h-3" />
                Capa (Imagem ou Vídeo)
              </label>
              {(data.coverImage || data.coverVideo) ? (
                <div className="relative w-32 h-32 rounded-md overflow-hidden border border-border-subtle group">
                  {data.coverVideo ? (
                    <video src={data.coverVideo} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                  ) : (
                    <img src={data.coverImage} alt="Capa" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <label className="cursor-pointer px-4 py-2 bg-surface hover:bg-surface-2 text-text-main text-xs font-mono rounded transition-colors text-center w-24">
                      Trocar
                      <input 
                        type="file" 
                        accept="image/*,video/*" 
                        className="hidden" 
                        onChange={handleImageUpload}
                      />
                    </label>
                    <button 
                      onClick={() => onSave({ coverImage: undefined, coverVideo: undefined })}
                      className="px-4 py-2 bg-error hover:bg-error/80 text-black text-xs font-mono rounded transition-colors w-24"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ) : (
                <label className="w-32 h-32 border-2 border-dashed border-border-subtle hover:border-accent rounded-md flex flex-col items-center justify-center text-text-muted hover:text-accent transition-colors cursor-pointer bg-surface-2/50 hover:bg-surface-2">
                  <ImagePlus className="w-6 h-6 mb-2" />
                  <span className="text-[10px] font-mono text-center px-2">Fazer upload<br/>(Img ou Vídeo até 10MB)</span>
                  <input 
                    type="file" 
                    accept="image/*,video/*" 
                    className="hidden" 
                    onChange={handleImageUpload}
                  />
                </label>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Título do Tópico</label>
              <input 
                type="text" 
                value={data.label || ''}
                onChange={(e) => onSave({ label: e.target.value })}
                className="w-full bg-surface-2 border border-border-subtle px-4 py-3 text-lg font-bold text-text-main focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
                <AlignLeft className="w-3 h-3" />
                Descrição
              </label>
              <textarea 
                value={data.description || ''}
                onChange={(e) => onSave({ description: e.target.value })}
                placeholder="Adicione uma descrição mais detalhada..."
                className="w-full bg-surface-2 border border-border-subtle px-4 py-3 text-sm text-text-main focus:outline-none focus:border-accent transition-colors min-h-[120px] resize-y"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
                <LinkIcon className="w-3 h-3" />
                Link
              </label>
              <input 
                type="text" 
                value={data.link || ''}
                onChange={(e) => onSave({ link: e.target.value })}
                placeholder="https://..."
                className="w-full bg-surface-2 border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-2">
                  <CheckSquare className="w-3 h-3" />
                  Tags (Propriedades)
                </label>
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="text-[10px] font-mono text-accent hover:underline"
                >
                  Editar Tags da Pasta
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {safeNodeChecks.map(check => (
                  <div key={check.id}>
                    {renderPropertyEditor(check, (data.checks || {})[check.id], (val) => onSave({ checks: { ...(data.checks || {}), [check.id]: val } }))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="p-6 border-t border-border-subtle bg-surface-2 shrink-0 flex justify-between items-center">
            {!data.isRoot ? (
              <button 
                onClick={() => { onSave({ _delete: true }); onClose(); }}
                className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold text-error hover:bg-error/10 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Excluir Tópico
              </button>
            ) : (
              <div />
            )}
            <button onClick={onClose} className="px-6 py-2 bg-accent text-black text-xs font-mono font-bold rounded hover:bg-accent/90 transition-colors">
              FECHAR
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      {/* Sidebar */}
      <div 
        className={`border-r border-border-subtle bg-surface-2 flex flex-col transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
          isSidebarOpen ? 'w-72' : 'w-0 border-r-0'
        }`}
      >
        <div className="w-72 flex flex-col h-full">
          <div className="p-4 border-b border-border-subtle shrink-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-text-muted uppercase mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent"></div>
              CREATIVE ACADEMY
            </div>
            <h2 className="text-lg font-black uppercase tracking-tight">Organização</h2>
          </div>

          <div className="p-2 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
            {renderTree(null)}
          </div>

          <div className="p-4 border-t border-border-subtle shrink-0">
            <button 
              onClick={() => handleAddNode(null)}
              className="flex items-center justify-center gap-2 w-full py-2 bg-surface-3 hover:bg-surface text-xs font-mono uppercase tracking-widest transition-colors rounded-sm"
            >
              <Plus className="w-4 h-4" />
              Nova Seção Principal
            </button>
          </div>
        </div>
      </div>

      {/* Main Content (Kanban) */}
      <div className="flex-1 flex flex-col bg-bg overflow-hidden relative">
        {selectedNode ? (
          <>
            {/* Header */}
            <div className="p-6 bg-surface-2 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                  className="p-2 bg-surface-3 hover:bg-surface rounded-md text-text-muted transition-colors"
                  title={isSidebarOpen ? "Ocultar menu" : "Mostrar menu"}
                >
                  <PanelLeft className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-text-muted mb-2">
                    {breadcrumbs.map((crumb, idx) => (
                      <React.Fragment key={crumb.id}>
                        {idx > 0 && <ChevronRight className="w-3 h-3" />}
                        <span className={idx === breadcrumbs.length - 1 ? 'text-accent' : ''}>{crumb.title || 'Untitled'}</span>
                      </React.Fragment>
                    ))}
                  </div>
                  <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-surface-3 flex items-center justify-center text-accent">
                      {(selectedNode.title || 'U').charAt(0)}
                    </div>
                    {selectedNode.title || 'Untitled'}
                  </h1>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {saving ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-3 rounded-sm text-[10px] font-mono text-text-muted animate-pulse">
                    <Cloud className="w-3 h-3" />
                    Salvando...
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-3 rounded-sm text-[10px] font-mono text-success">
                    <Cloud className="w-3 h-3" />
                    Sincronizado
                  </div>
                )}
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="px-3 py-1.5 bg-surface-3 hover:bg-surface rounded-sm text-xs font-mono text-text-main flex items-center gap-2 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Checks Globais
                </button>
              </div>
            </div>

            {/* Board or MindMap */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
              {selectedNode.viewType === 'mindmap' ? (
                <MindMapEditor 
                  key={selectedNode.id}
                  initialNodes={selectedNode.mindmapData?.nodes || []}
                  initialEdges={selectedNode.mindmapData?.edges || []}
                  onChange={handleUpdateMindMap}
                  renderNodeModal={renderMindMapNodeModal}
                />
              ) : (
                <DragDropContext onDragEnd={onDragEnd}>
                  <div className="flex gap-4 h-full items-start">
                    {(selectedNode.columns || []).map(col => (
                      <div key={col.id} className="w-80 shrink-0 flex flex-col max-h-full">
                        {/* Column Header */}
                        <div className="flex items-center justify-between mb-4 group">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-[#D9B873] bg-[#7A5C1E]/20 px-2 py-1 rounded-sm">{col.title || 'Untitled'}</h3>
                            <span className="text-xs font-mono text-text-muted">{(col.cards || []).length}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleRenameColumn(col.id, col.title || 'Untitled')} className="text-text-muted hover:text-text-main p-1 rounded hover:bg-surface-3 transition-colors">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteColumn(col.id)} className="text-text-muted hover:text-error p-1 rounded hover:bg-surface-3 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Cards Container */}
                        <Droppable droppableId={col.id}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar min-h-[150px]"
                            >
                              {(col.cards || []).map((card, index) => (
                                <Draggable key={card.id} draggableId={card.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      onClick={() => setEditingCard({ nodeId: selectedNode.id, colId: col.id, cardId: card.id })}
                                      className={`bg-[#1A1A1A] ${snapshot.isDragging ? 'ring-1 ring-accent shadow-lg' : 'hover:bg-[#222]'} rounded-md p-4 transition-colors relative group`}
                                    >
                                      {(card.coverImage || card.coverVideo) && (
                                        <div className="mb-4 -mx-4 -mt-4 overflow-hidden rounded-t-md aspect-square bg-surface-2 border-b border-[#2A2A2A]">
                                          {card.coverVideo ? (
                                            <video src={card.coverVideo} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                                          ) : (
                                            <img src={card.coverImage} alt={card.title} className="w-full h-full object-cover" />
                                          )}
                                        </div>
                                      )}
                                        <h4 className="text-sm font-bold text-white mb-4 pr-6 leading-tight flex items-start gap-2">
                                          <PlayCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                                          <span className="line-clamp-2">{card.title || 'Untitled'}</span>
                                        </h4>
                                        
                                        <div className="space-y-2 mt-4">
                                        {safeNodeChecks.map(check => (
                                          <div key={check.id}>
                                            {renderPropertyPreview(check, (card.checks || {})[check.id], () => handleUpdateCheck(selectedNode.id, col.id, card.id, check.id, !(card.checks || {})[check.id]))}
                                          </div>
                                        ))}
                                      </div>

                                      {card.link && (
                                        <div className="mt-4 pt-3 border-t border-[#2A2A2A]">
                                          <a href={card.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] font-mono text-accent hover:underline flex items-center gap-1 truncate">
                                            <LinkIcon className="w-3 h-3 shrink-0" />
                                            {card.link}
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                              
                              <button 
                                onClick={() => handleAddCard(col.id)}
                                className="flex items-center gap-2 w-full p-3 text-xs font-mono text-text-muted hover:text-text-main hover:bg-surface-3 rounded-md transition-all mt-2"
                              >
                                <Plus className="w-4 h-4" />
                                Nova Aula
                              </button>
                            </div>
                          )}
                        </Droppable>
                      </div>
                    ))}

                    {/* Add Column Button */}
                    <div className="w-80 shrink-0">
                      <button 
                        onClick={handleAddColumn}
                        className="flex items-center gap-2 w-full p-4 text-sm font-bold text-text-muted hover:text-text-main bg-surface-2/30 hover:bg-surface-2 rounded-md transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Coluna
                      </button>
                    </div>
                  </div>
                </DragDropContext>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col relative">
            <div className="absolute top-6 left-6 z-10">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                className="p-2 bg-surface-3 hover:bg-surface rounded-md text-text-muted transition-colors"
                title={isSidebarOpen ? "Ocultar menu" : "Mostrar menu"}
              >
                <PanelLeft className="w-5 h-5" />
              </button>
            </div>
            {!isInitialized ? (
              <div className="flex-1 flex flex-col items-center justify-center text-text-muted p-8 text-center">
                <div className="text-accent font-mono text-xs animate-pulse tracking-[0.2em]">CARREGANDO ACADEMY...</div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-text-muted p-8 text-center">
                <BookOpen className="w-16 h-16 mb-6 opacity-20" />
                <h2 className="text-xl font-bold uppercase tracking-widest mb-2">Nenhuma Seção Selecionada</h2>
                <p className="text-sm font-mono max-w-md">
                  Selecione ou crie uma seção no menu lateral para visualizar ou editar os conteúdos.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card Detail Modal */}
      {editingCard && (() => {
        const node = safeNodes.find(n => n.id === editingCard.nodeId);
        const col = (node?.columns || []).find(c => c.id === editingCard.colId);
        const card = (col?.cards || []).find(c => c.id === editingCard.cardId);
        
        if (!card) return null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-surface border border-border-subtle w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl relative">
              <div className="flex items-center justify-between p-6 border-b border-border-subtle bg-surface-2 shrink-0">
                <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
                  <LayoutGrid className="w-4 h-4" />
                  <span>{col?.title || 'Untitled'}</span>
                </div>
                <button onClick={() => setEditingCard(null)} className="text-text-muted hover:text-text-main transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
                    <ImagePlus className="w-3 h-3" />
                    Capa da Aula (Imagem ou Vídeo)
                  </label>
                  {(card.coverImage || card.coverVideo) ? (
                    <div className="relative w-32 h-32 rounded-md overflow-hidden border border-border-subtle group">
                      {card.coverVideo ? (
                        <video src={card.coverVideo} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                      ) : (
                        <img src={card.coverImage} alt="Capa" className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                        <label className="cursor-pointer px-4 py-2 bg-surface hover:bg-surface-2 text-text-main text-xs font-mono rounded transition-colors text-center w-24">
                          Trocar
                          <input 
                            type="file" 
                            accept="image/*,video/*" 
                            className="hidden" 
                            onChange={(e) => handleImageUpload(e, editingCard.nodeId, editingCard.colId, editingCard.cardId)}
                          />
                        </label>
                        <button 
                          onClick={() => handleUpdateCard(editingCard.nodeId, editingCard.colId, editingCard.cardId, { coverImage: undefined, coverVideo: undefined })}
                          className="px-4 py-2 bg-error hover:bg-error/80 text-black text-xs font-mono rounded transition-colors w-24"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="w-32 h-32 border-2 border-dashed border-border-subtle hover:border-accent rounded-md flex flex-col items-center justify-center text-text-muted hover:text-accent transition-colors cursor-pointer bg-surface-2/50 hover:bg-surface-2">
                      <ImagePlus className="w-6 h-6 mb-2" />
                      <span className="text-[10px] font-mono text-center px-2">Fazer upload<br/>(Img ou Vídeo até 10MB)</span>
                      <input 
                        type="file" 
                        accept="image/*,video/*" 
                        className="hidden" 
                        onChange={(e) => handleImageUpload(e, editingCard.nodeId, editingCard.colId, editingCard.cardId)}
                      />
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Título da Aula</label>
                  <input 
                    type="text" 
                    value={card.title || ''}
                    onChange={(e) => handleUpdateCard(editingCard.nodeId, editingCard.colId, editingCard.cardId, { title: e.target.value })}
                    className="w-full bg-surface-2 border border-border-subtle px-4 py-3 text-lg font-bold text-text-main focus:outline-none focus:border-accent transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
                    <AlignLeft className="w-3 h-3" />
                    Descrição
                  </label>
                  <textarea 
                    value={card.description || ''}
                    onChange={(e) => handleUpdateCard(editingCard.nodeId, editingCard.colId, editingCard.cardId, { description: e.target.value })}
                    placeholder="Adicione uma descrição mais detalhada..."
                    className="w-full bg-surface-2 border border-border-subtle px-4 py-3 text-sm text-text-main focus:outline-none focus:border-accent transition-colors min-h-[120px] resize-y"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
                    <LinkIcon className="w-3 h-3" />
                    Link da Aula
                  </label>
                  <input 
                    type="text" 
                    value={card.link || ''}
                    onChange={(e) => handleUpdateCard(editingCard.nodeId, editingCard.colId, editingCard.cardId, { link: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-surface-2 border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest flex items-center gap-2">
                      <CheckSquare className="w-3 h-3" />
                      Tags (Propriedades)
                    </label>
                    <button 
                      onClick={() => setIsSettingsOpen(true)}
                      className="text-[10px] font-mono text-accent hover:underline"
                    >
                      Editar Tags da Pasta
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {safeNodeChecks.map(check => (
                      <div key={check.id}>
                        {renderPropertyEditor(check, (card.checks || {})[check.id], (val) => handleUpdateCheck(editingCard.nodeId, editingCard.colId, editingCard.cardId, check.id, val))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-border-subtle bg-surface-2 shrink-0 flex justify-between items-center">
                <button 
                  onClick={() => handleDeleteCard(editingCard.nodeId, editingCard.colId, editingCard.cardId)}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold text-error hover:bg-error/10 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir Aula
                </button>
                <button 
                  onClick={() => setEditingCard(null)}
                  className="px-6 py-2 bg-accent hover:bg-accent/80 text-black text-xs font-mono font-bold uppercase tracking-[0.1em] transition-colors rounded"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Global Checks Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-surface border border-border-subtle w-full max-w-lg flex flex-col max-h-[90vh] shadow-2xl relative">
            <div className="flex items-center justify-between p-6 border-b border-border-subtle bg-surface-2 shrink-0">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight">Tags da Pasta</h3>
                <p className="text-xs font-mono text-text-muted mt-1">Gerencie as tags e propriedades disponíveis para as aulas desta pasta</p>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="text-text-muted hover:text-text-main transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              {safeNodeChecks.map(check => (
                <div key={check.id} className="flex flex-col gap-3 bg-surface-2 p-3 border border-border-subtle rounded">
                  <div className="flex items-center gap-3">
                    <input 
                      type="text" 
                      value={check.label}
                      onChange={(e) => {
                        if (!selectedNodeId) return;
                        setData(prev => ({
                          ...prev,
                          nodes: (Array.isArray(prev?.nodes) ? prev.nodes : []).map(n => {
                            if (n.id === selectedNodeId) {
                              return {
                                ...n,
                                checks: (n.checks || []).map(c => c.id === check.id ? { ...c, label: e.target.value } : c)
                              };
                            }
                            return n;
                          })
                        }));
                      }}
                      className="flex-1 bg-surface border border-border-subtle px-3 py-2 text-sm font-bold text-text-main focus:outline-none focus:border-accent transition-colors"
                    />
                    <select
                      value={check.type || 'text'}
                      onChange={(e) => {
                        if (!selectedNodeId) return;
                        setData(prev => ({
                          ...prev,
                          nodes: (Array.isArray(prev?.nodes) ? prev.nodes : []).map(n => {
                            if (n.id === selectedNodeId) {
                              return {
                                ...n,
                                checks: (n.checks || []).map(c => c.id === check.id ? { ...c, type: e.target.value as PropertyType } : c)
                              };
                            }
                            return n;
                          })
                        }));
                      }}
                      className="bg-surface border border-border-subtle px-2 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent transition-colors rounded"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="select">Select</option>
                      <option value="multi-select">Multi-select</option>
                      <option value="status">Status</option>
                      <option value="date">Date</option>
                      <option value="person">Person</option>
                      <option value="files">Files & media</option>
                      <option value="checkbox">Checkbox</option>
                      <option value="url">URL</option>
                    </select>
                    <button 
                      onClick={() => {
                        if (!selectedNodeId) return;
                        setData(prev => ({
                          ...prev,
                          nodes: (Array.isArray(prev?.nodes) ? prev.nodes : []).map(n => {
                            if (n.id === selectedNodeId) {
                              return {
                                ...n,
                                checks: (n.checks || []).filter(c => c.id !== check.id)
                              };
                            }
                            return n;
                          })
                        }));
                      }}
                      className="p-2 text-text-muted hover:text-error hover:bg-error/10 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {(check.type === 'select' || check.type === 'status' || check.type === 'multi-select') && (
                    <div className="pl-11 space-y-2">
                      <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Opções</div>
                      {(check.options || []).map(opt => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <input 
                            type="color" 
                            value={opt.color}
                            onChange={(e) => {
                              if (!selectedNodeId) return;
                              setData(prev => ({
                                ...prev,
                                nodes: (Array.isArray(prev?.nodes) ? prev.nodes : []).map(n => {
                                  if (n.id === selectedNodeId) {
                                    return {
                                      ...n,
                                      checks: (n.checks || []).map(c => c.id === check.id ? {
                                        ...c,
                                        options: (c.options || []).map(o => o.id === opt.id ? { ...o, color: e.target.value } : o)
                                      } : c)
                                    };
                                  }
                                  return n;
                                })
                              }));
                            }}
                            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                          />
                          <input 
                            type="text" 
                            value={opt.label}
                            onChange={(e) => {
                              if (!selectedNodeId) return;
                              setData(prev => ({
                                ...prev,
                                nodes: (Array.isArray(prev?.nodes) ? prev.nodes : []).map(n => {
                                  if (n.id === selectedNodeId) {
                                    return {
                                      ...n,
                                      checks: (n.checks || []).map(c => c.id === check.id ? {
                                        ...c,
                                        options: (c.options || []).map(o => o.id === opt.id ? { ...o, label: e.target.value } : o)
                                      } : c)
                                    };
                                  }
                                  return n;
                                })
                              }));
                            }}
                            className="flex-1 bg-surface-3 border border-border-subtle px-2 py-1 text-xs font-bold text-text-main focus:outline-none focus:border-accent transition-colors"
                          />
                          <button 
                            onClick={() => {
                              if (!selectedNodeId) return;
                              setData(prev => ({
                                ...prev,
                                nodes: (Array.isArray(prev?.nodes) ? prev.nodes : []).map(n => {
                                  if (n.id === selectedNodeId) {
                                    return {
                                      ...n,
                                      checks: (n.checks || []).map(c => c.id === check.id ? {
                                        ...c,
                                        options: (c.options || []).filter(o => o.id !== opt.id)
                                      } : c)
                                    };
                                  }
                                  return n;
                                })
                              }));
                            }}
                            className="p-1 text-text-muted hover:text-error hover:bg-error/10 rounded transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button 
                        onClick={() => {
                          if (!selectedNodeId) return;
                          setData(prev => ({
                            ...prev,
                            nodes: (Array.isArray(prev?.nodes) ? prev.nodes : []).map(n => {
                              if (n.id === selectedNodeId) {
                                return {
                                  ...n,
                                  checks: (n.checks || []).map(c => c.id === check.id ? {
                                    ...c,
                                    options: [...(c.options || []), { id: `opt_${Date.now()}`, label: 'Nova Opção', color: '#4A4A4A' }]
                                  } : c)
                                };
                              }
                              return n;
                            })
                          }));
                        }}
                        className="text-[10px] font-mono text-accent hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Adicionar Opção
                      </button>
                    </div>
                  )}
                </div>
              ))}

              <button 
                onClick={() => {
                  if (!selectedNodeId) return;
                  setData(prev => ({
                    ...prev,
                    nodes: (Array.isArray(prev?.nodes) ? prev.nodes : []).map(n => {
                      if (n.id === selectedNodeId) {
                        return {
                          ...n,
                          checks: [...(n.checks || []), { id: `tag_${Date.now()}`, label: 'Nova Tag', color: '#FFFFFF', type: 'checkbox' }]
                        };
                      }
                      return n;
                    })
                  }));
                }}
                className="flex items-center justify-center gap-2 w-full p-3 border border-dashed border-border-subtle hover:border-accent text-text-muted hover:text-accent rounded transition-colors text-sm font-bold"
              >
                <Plus className="w-4 h-4" />
                Adicionar Nova Tag
              </button>
            </div>

            <div className="p-6 border-t border-border-subtle bg-surface-2 shrink-0 flex justify-end">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="px-6 py-2 bg-accent hover:bg-accent/80 text-black text-xs font-mono font-bold uppercase tracking-[0.1em] transition-colors rounded"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Prompt/Confirm Modal */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-surface border border-border-subtle w-full max-w-md p-6 shadow-2xl relative">
            <button 
              onClick={closeModal}
              className="absolute top-4 right-4 text-text-muted hover:text-text-main transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-lg font-black uppercase tracking-tight mb-6">{modalConfig.title}</h3>
            
            {modalConfig.type === 'input' || modalConfig.type === 'node-create' ? (
              <div className="space-y-4">
                <input 
                  type="text" 
                  value={modalConfig.value}
                  onChange={(e) => setModalConfig(prev => ({ ...prev, value: e.target.value }))}
                  placeholder={modalConfig.placeholder}
                  className="w-full bg-surface-2 border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      modalConfig.onConfirm(modalConfig.value, modalConfig.viewType);
                      closeModal();
                    }
                  }}
                />
                {modalConfig.type === 'node-create' && (
                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-mono text-text-muted uppercase tracking-wider">Tipo de Visualização</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setModalConfig(prev => ({ ...prev, viewType: 'table' }))}
                        className={`flex-1 py-2 px-3 text-xs font-mono uppercase tracking-wider border transition-colors flex items-center justify-center gap-2 ${modalConfig.viewType === 'table' ? 'bg-accent/10 border-accent text-accent' : 'bg-surface-2 border-border-subtle text-text-muted hover:border-text-muted'}`}
                      >
                        <List className="w-4 h-4" />
                        Tabela
                      </button>
                      <button
                        onClick={() => setModalConfig(prev => ({ ...prev, viewType: 'mindmap' }))}
                        className={`flex-1 py-2 px-3 text-xs font-mono uppercase tracking-wider border transition-colors flex items-center justify-center gap-2 ${modalConfig.viewType === 'mindmap' ? 'bg-accent/10 border-accent text-accent' : 'bg-surface-2 border-border-subtle text-text-muted hover:border-text-muted'}`}
                      >
                        <Cloud className="w-4 h-4" />
                        Mapa Mental
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={closeModal}
                    className="flex-1 py-3 bg-surface-2 hover:bg-surface-3 text-text-main text-xs font-mono font-bold uppercase tracking-[0.1em] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                      modalConfig.onConfirm(modalConfig.value, modalConfig.viewType);
                      closeModal();
                    }}
                    className="flex-1 py-3 bg-accent hover:bg-accent/80 text-black text-xs font-mono font-bold uppercase tracking-[0.1em] transition-colors"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={closeModal}
                    className="flex-1 py-3 bg-surface-2 hover:bg-surface-3 text-text-main text-xs font-mono font-bold uppercase tracking-[0.1em] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                      modalConfig.onConfirm('');
                      closeModal();
                    }}
                    className="flex-1 py-3 bg-error hover:bg-error/80 text-black text-xs font-mono font-bold uppercase tracking-[0.1em] transition-colors"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
