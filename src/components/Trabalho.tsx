import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle, CheckCircle2, Plus, GripVertical, Trash2, X, Save, User, Share2, ListChecks } from 'lucide-react';
import { supabase } from '../lib/supabase';


type Priority = 'low' | 'medium' | 'high';
type Status = 'backlog' | 'doing' | 'done';

interface SubItem {
  id: string;
  text: string;
  completed: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  deadline: string;
  status: Status;
  xp_reward: number;
  tags?: string[];
  responsible?: string;
  sub_items?: SubItem[];
  position?: number;
}

export default function Trabalho() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [deadline, setDeadline] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [responsible, setResponsible] = useState('');
  const [subItems, setSubItems] = useState<SubItem[]>([]);
  const [newSubItemText, setNewSubItemText] = useState('');

  // Edit Modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');
  const [editDeadline, setEditDeadline] = useState('');
  const [editXpReward, setEditXpReward] = useState(0);
  const [editTagsInput, setEditTagsInput] = useState('');
  const [editResponsible, setEditResponsible] = useState('');
  const [editSubItems, setEditSubItems] = useState<SubItem[]>([]);
  const [editNewSubItemText, setEditNewSubItemText] = useState('');

  // Create & Share Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'viewer' | 'editor'>('viewer');

  // Tag Filtering
  const [selectedFilterTags, setSelectedFilterTags] = useState<string[]>([]);

  useEffect(() => {
    fetchTasks();
    
    const handleRefresh = () => fetchTasks();
    window.addEventListener('app_data_changed', handleRefresh);
    return () => window.removeEventListener('app_data_changed', handleRefresh);
  }, []);

  const openEditModal = (task: Task) => {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority);
    setEditDeadline(task.deadline || '');
    setEditXpReward(task.xp_reward);
    setEditTagsInput(task.tags ? task.tags.join(', ') : '');
    setEditResponsible(task.responsible || '');
    setEditSubItems(task.sub_items ? [...task.sub_items] : []);
    setEditNewSubItemText('');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedTask || !editTitle.trim()) return;

    const tagsArray = editTagsInput.split(',').map(t => t.trim()).filter(t => t);

    const updatedTask = {
      title: editTitle,
      description: editDescription,
      priority: editPriority,
      deadline: editDeadline || null,
      xp_reward: editXpReward,
      tags: tagsArray.length > 0 ? tagsArray : null,
      responsible: editResponsible || null,
      sub_items: editSubItems
    };

    try {
      await updateTask(selectedTask.id, updatedTask);
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('work_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTaskId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent drag image hack for better custom styling if needed, but default is fine
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const persistReorder = async (status: Status, orderedIds: string[]) => {
    setTasks(prev => prev.map(t => {
      const idx = orderedIds.indexOf(t.id);
      if (idx === -1) return t;
      return { ...t, status, position: idx };
    }));
    await Promise.all(orderedIds.map((id, idx) =>
      supabase.from('work_tasks').update({ status, position: idx }).eq('id', id)
    ));
  };

  const reorderTasks = async (draggedId: string, targetStatus: Status, targetTaskId: string | null) => {
    const dragged = tasks.find(t => t.id === draggedId);
    if (!dragged) return;

    const columnTasks = tasks
      .filter(t => t.status === targetStatus && t.id !== draggedId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    let insertAt = columnTasks.length;
    if (targetTaskId) {
      const idx = columnTasks.findIndex(t => t.id === targetTaskId);
      if (idx !== -1) insertAt = idx;
    }
    const newOrder = [...columnTasks];
    newOrder.splice(insertAt, 0, dragged);
    const orderedIds = newOrder.map(t => t.id);

    const statusChanged = dragged.status !== targetStatus;
    await persistReorder(targetStatus, orderedIds);

    if (statusChanged && targetStatus === 'done') {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles').select('total_xp').eq('id', user.id).single();
        if (profile) {
          await supabase.from('profiles')
            .update({ total_xp: profile.total_xp + dragged.xp_reward })
            .eq('id', user.id);
        }
      }
    }
  };

  const handleDrop = async (e: React.DragEvent, newStatus: Status) => {
    e.preventDefault();
    if (!draggedTaskId) return;
    try {
      await reorderTasks(draggedTaskId, newStatus, null);
    } catch (error) {
      console.error('Error reordering task:', error);
    } finally {
      setDraggedTaskId(null);
      setDragOverTaskId(null);
    }
  };

  const handleCardDrop = async (e: React.DragEvent, targetTask: Task) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedTaskId || draggedTaskId === targetTask.id) {
      setDraggedTaskId(null);
      setDragOverTaskId(null);
      return;
    }
    try {
      await reorderTasks(draggedTaskId, targetTask.status, targetTask.id);
    } catch (error) {
      console.error('Error reordering task:', error);
    } finally {
      setDraggedTaskId(null);
      setDragOverTaskId(null);
    }
  };

  const addTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'user_id'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const sameStatus = tasks.filter(t => t.status === taskData.status);
    const maxPos = sameStatus.reduce((m, t) => Math.max(m, t.position ?? 0), -1);

    const newTask = {
      user_id: user.id,
      ...taskData,
      position: maxPos + 1
    };

    const { data, error } = await supabase
      .from('work_tasks')
      .insert([newTask])
      .select()
      .single();

    if (error) throw error;
    setTasks(prev => [data, ...prev]);
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const taskToUpdate = tasks.find(t => t.id === id);
    if (!taskToUpdate) return;

    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } as Task : t));
    const { error } = await supabase
      .from('work_tasks')
      .update(updates)
      .eq('id', id);

    if (error) {
      fetchTasks();
      throw error;
    }

    if (updates.status === 'done' && taskToUpdate.status !== 'done') {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('total_xp')
          .eq('id', user.id)
          .single();
          
        if (profile) {
          await supabase
            .from('profiles')
            .update({ total_xp: profile.total_xp + taskToUpdate.xp_reward })
            .eq('id', user.id);
        }
      }
    }
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase
      .from('work_tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const xp_reward = priority === 'high' ? 30 : priority === 'medium' ? 20 : 10;
      const tagsArray = tagsInput.split(',').map(t => t.trim()).filter(t => t);

      await addTask({
        title,
        description,
        priority,
        deadline: deadline || null,
        status: 'backlog',
        xp_reward,
        tags: tagsArray.length > 0 ? tagsArray : null,
        responsible: responsible || null,
        sub_items: subItems
      });

      setTitle('');
      setDescription('');
      setPriority('medium');
      setDeadline('');
      setTagsInput('');
      setResponsible('');
      setSubItems([]);
      setNewSubItemText('');
      setIsCreateModalOpen(false);
    } catch (error: any) {
      console.error('Error adding task:', error);
      alert(`Erro ao adicionar tarefa. Detalhes: ${error.message}`);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta tarefa?')) return;
    try {
      await deleteTask(id);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const getPriorityColor = (p: Priority) => {
    if (p === 'high') return 'text-error border-error/30 bg-error/10';
    if (p === 'medium') return 'text-accent border-accent/30 bg-accent/10';
    return 'text-success border-success/30 bg-success/10';
  };

  // Derived state for tags
  const allAvailableTags = Array.from(new Set(tasks.flatMap(t => t.tags || []))).sort();

  const filteredTasks = tasks.filter(task => {
    if (selectedFilterTags.length === 0) return true;
    if (!task.tags) return false;
    return selectedFilterTags.every(tag => task.tags!.includes(tag));
  });

  const getTagColor = (tag: string) => {
    const colors = [
      'bg-blue-500/10 text-blue-500 border-blue-500/20',
      'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      'bg-purple-500/10 text-purple-500 border-purple-500/20',
      'bg-amber-500/10 text-amber-500 border-amber-500/20',
      'bg-pink-500/10 text-pink-500 border-pink-500/20',
      'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
      'bg-rose-500/10 text-rose-500 border-rose-500/20',
      'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    ];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const toggleFilterTag = (tag: string) => {
    setSelectedFilterTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleAddTagToInput = (tag: string, currentInput: string, setter: (val: string) => void) => {
    const currentTags = currentInput.split(',').map(t => t.trim()).filter(t => t);
    if (!currentTags.includes(tag)) {
      setter(currentTags.length > 0 ? `${currentInput}, ${tag}` : tag);
    }
  };

  const getPriorityLabel = (p: Priority) => {
    if (p === 'high') return 'ALTA';
    if (p === 'medium') return 'MÉDIA';
    return 'BAIXA';
  };

  const toggleSubItem = async (taskId: string, subItemId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.sub_items) return;
    const updated = task.sub_items.map(si =>
      si.id === subItemId ? { ...si, completed: !si.completed } : si
    );
    try {
      await updateTask(taskId, { sub_items: updated });
    } catch (error) {
      console.error('Error toggling sub-item:', error);
    }
  };

  const addEditSubItem = () => {
    const text = editNewSubItemText.trim();
    if (!text) return;
    setEditSubItems(prev => [...prev, { id: crypto.randomUUID(), text, completed: false }]);
    setEditNewSubItemText('');
  };

  const removeEditSubItem = (id: string) => {
    setEditSubItems(prev => prev.filter(si => si.id !== id));
  };

  const toggleEditSubItem = (id: string) => {
    setEditSubItems(prev => prev.map(si => si.id === id ? { ...si, completed: !si.completed } : si));
  };

  const updateEditSubItemText = (id: string, text: string) => {
    setEditSubItems(prev => prev.map(si => si.id === id ? { ...si, text } : si));
  };

  const addCreateSubItem = () => {
    const text = newSubItemText.trim();
    if (!text) return;
    setSubItems(prev => [...prev, { id: crypto.randomUUID(), text, completed: false }]);
    setNewSubItemText('');
  };

  const removeCreateSubItem = (id: string) => {
    setSubItems(prev => prev.filter(si => si.id !== id));
  };

  const renderColumn = (status: Status, columnTitle: string, colorClass: string) => {
    const columnTasks = filteredTasks
      .filter(t => t.status === status)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    return (
      <div 
        className="bg-surface-2 border border-border-subtle flex flex-col min-h-[500px]"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, status)}
      >
        <div className={`p-4 border-b border-border-subtle bg-surface-3/30`}>
          <h3 className={`text-xs font-mono uppercase tracking-[0.1em] ${colorClass} flex items-center justify-between`}>
            {columnTitle}
            <span className="bg-surface border border-border-subtle px-2 py-0.5 text-text-muted rounded-sm">
              {columnTasks.length}
            </span>
          </h3>
        </div>
        
        <div className="p-4 flex-1 space-y-3 overflow-y-auto">
          {columnTasks.map(task => (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => handleDragStart(e, task.id)}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (draggedTaskId && draggedTaskId !== task.id) setDragOverTaskId(task.id); }}
              onDragLeave={() => { if (dragOverTaskId === task.id) setDragOverTaskId(null); }}
              onDrop={(e) => handleCardDrop(e, task)}
              onClick={() => openEditModal(task)}
              className={`bg-surface border p-4 cursor-grab active:cursor-grabbing hover:border-accent/50 transition-colors group relative ${
                dragOverTaskId === task.id ? 'border-error border-t-2' : 'border-border-subtle'
              } ${draggedTaskId === task.id ? 'opacity-40' : ''}`}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-border-subtle group-hover:bg-accent/50 transition-colors"></div>
              
              <div className="flex justify-between items-start mb-2 pl-2">
                <span className={`text-[9px] font-mono px-1.5 py-0.5 border uppercase tracking-[0.05em] ${getPriorityColor(task.priority)}`}>
                  {getPriorityLabel(task.priority)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-success font-bold">
                    +{task.xp_reward} XP
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                    className="text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              
              <h4 className="font-bold text-sm text-text-main mb-1 pl-2 leading-tight">{task.title}</h4>
              
              {task.description && (
                <p className="text-xs text-text-muted font-mono mb-3 pl-2 line-clamp-2">{task.description}</p>
              )}
              
              {task.tags && task.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3 pl-2">
                  {task.tags.map((tag, idx) => (
                    <span key={idx} className={`text-[9px] font-mono border px-1.5 py-0.5 uppercase ${getTagColor(tag)}`}>
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {task.sub_items && task.sub_items.length > 0 && (
                <div className="mb-3 pl-2 space-y-1">
                  {task.sub_items.map(si => (
                    <label
                      key={si.id}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 text-[11px] font-mono cursor-pointer group/sub"
                    >
                      <input
                        type="checkbox"
                        checked={si.completed}
                        onChange={() => toggleSubItem(task.id, si.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-3 h-3 accent-success cursor-pointer"
                      />
                      <span className={si.completed ? 'line-through text-text-muted/60' : 'text-text-main'}>
                        {si.text}
                      </span>
                    </label>
                  ))}
                  <div className="text-[9px] font-mono text-text-muted/70 mt-1">
                    {task.sub_items.filter(si => si.completed).length}/{task.sub_items.length} concluídos
                  </div>
                </div>
              )}

              {task.responsible && (
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-info mb-3 pl-2">
                  <User className="w-3 h-3" />
                  <span className="uppercase">{task.responsible}</span>
                </div>
              )}
              
              {task.deadline && (
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted mt-3 pl-2 pt-3 border-t border-border-subtle/50">
                  <Clock className="w-3 h-3" />
                  <span>DEADLINE: {task.deadline.split('-').reverse().join('/')}</span>
                </div>
              )}
            </div>
          ))}
          
          {columnTasks.length === 0 && (
            <div className="h-full flex items-center justify-center text-[10px] font-mono text-text-muted/50 uppercase border-2 border-dashed border-border-subtle/50 rounded-sm">
              Drop Zone
            </div>
          )}
        </div>
      </div>
    );
  };

  // Estatísticas
  const completedThisWeek = tasks.filter(t => t.status === 'done').length;
  const totalXpEarned = tasks.filter(t => t.status === 'done').reduce((acc, curr) => acc + curr.xp_reward, 0);

  if (loading) {
    return <div className="p-12 text-center font-mono text-text-muted">CARREGANDO DADOS DO SUPABASE...</div>;
  }

  return (
    <div className="space-y-12 pb-12">
      <section className="relative border-b border-border-subtle pb-12 mb-12">
        <div className="absolute inset-0 z-0 opacity-5 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-text-muted uppercase mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-error"></div>
            WORKSPACE // KANBAN
          </div>
          <h1 className="text-[64px] font-black leading-[0.9] tracking-[-2px] uppercase mb-2">
            WORK<br/><span className="text-surface-3">TASKS</span>
          </h1>
          <p className="text-[13px] text-text-muted max-w-lg leading-[1.7] mb-7 font-mono border-l-2 border-error pl-3">
            Gerenciamento de tarefas e projetos. Mova os cards para a coluna de concluído para gerar XP de produtividade.
          </p>
        </div>
      </section>
      
      {/* Secao 01 - Kanban */}
      <section id="secao-01">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-4">
              <span className="text-[11px] font-bold text-error tracking-[0.1em] font-mono border border-error/30 px-2 py-0.5">01</span>
              <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Kanban Board</h2>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setIsShareModalOpen(true)} className="btn-secondary flex items-center gap-2 text-xs py-2 px-4">
                <Share2 className="w-4 h-4" />
                COMPARTILHAR
              </button>
              <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary !bg-error hover:!bg-error/80 !text-black flex items-center gap-2 text-xs py-2 px-4">
                <Plus className="w-4 h-4" />
                NOVA TAREFA
              </button>
            </div>
          </div>
          
          {allAvailableTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap bg-surface-2 border border-border-subtle p-3">
              <span className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mr-2">Filtrar por Tags:</span>
              {allAvailableTags.map(tag => {
                const isSelected = selectedFilterTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleFilterTag(tag)}
                    className={`text-[10px] font-mono border px-2 py-1 uppercase transition-colors ${
                      isSelected 
                        ? getTagColor(tag) 
                        : 'bg-surface border-border-subtle text-text-muted hover:border-text-muted'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
              {selectedFilterTags.length > 0 && (
                <button 
                  onClick={() => setSelectedFilterTags([])}
                  className="text-[10px] font-mono text-error hover:underline ml-2 uppercase"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {renderColumn('backlog', 'BACKLOG', 'text-text-muted')}
          {renderColumn('doing', 'EM ANDAMENTO', 'text-accent')}
          {renderColumn('done', 'CONCLUÍDO', 'text-success')}
        </div>
      </section>

      {/* Secao 02 - Estatisticas */}
      <section id="secao-02">
        <div className="flex items-baseline gap-4 mb-6">
          <span className="text-[11px] font-bold text-error tracking-[0.1em] font-mono border border-error/30 px-2 py-0.5">02</span>
          <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Estatísticas</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface-2 border border-border-subtle p-6">
            <div className="text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-success" />
              CONCLUÍDAS (SEMANA)
            </div>
            <div className="text-4xl font-black tracking-[-1px] mb-1">{completedThisWeek}</div>
            <div className="text-[10px] font-mono text-text-muted uppercase">Tarefas finalizadas</div>
          </div>

          <div className="bg-surface-2 border border-border-subtle p-6">
            <div className="text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
              <AlertCircle className="w-3 h-3 text-accent" />
              XP TOTAL GANHO
            </div>
            <div className="text-4xl font-black tracking-[-1px] mb-1 text-success">+{totalXpEarned}</div>
            <div className="text-[10px] font-mono text-text-muted uppercase">Pontos de experiência</div>
          </div>

          <div className="bg-surface-2 border border-border-subtle p-6">
            <div className="text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
              <Clock className="w-3 h-3 text-info" />
              TEMPO MÉDIO
            </div>
            <div className="text-4xl font-black tracking-[-1px] mb-1">1.2<span className="text-lg text-text-muted">d</span></div>
            <div className="text-[10px] font-mono text-text-muted uppercase">Por tarefa concluída</div>
          </div>
        </div>
      </section>

      {/* Modal de Edição */}
      {isEditModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)}>
          <div className="bg-surface-2 border border-border-subtle w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border-subtle sticky top-0 bg-surface-2 z-10">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-error animate-pulse"></div>
                <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Detalhes da Tarefa</h2>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-text-muted hover:text-error transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Título</label>
                <input 
                  type="text" 
                  value={editTitle} 
                  onChange={(e) => setEditTitle(e.target.value)} 
                  className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-error transition-colors uppercase" 
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Descrição / Informações</label>
                <textarea 
                  value={editDescription} 
                  onChange={(e) => setEditDescription(e.target.value)} 
                  className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-error transition-colors min-h-[150px]" 
                  placeholder="Adicione links, notas ou detalhes da tarefa..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Responsável</label>
                  <input 
                    type="text" 
                    value={editResponsible} 
                    onChange={(e) => setEditResponsible(e.target.value)} 
                    className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-error transition-colors uppercase" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Tags (Separadas por vírgula)</label>
                  <input 
                    type="text" 
                    value={editTagsInput} 
                    onChange={(e) => setEditTagsInput(e.target.value)} 
                    className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-error transition-colors uppercase" 
                  />
                  {allAvailableTags.length > 0 && (
                    <div className="mt-3">
                      <span className="block text-[9px] font-mono text-text-muted uppercase mb-1.5">Tags Existentes (Clique para adicionar):</span>
                      <div className="flex flex-wrap gap-1.5">
                        {allAvailableTags.map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleAddTagToInput(tag, editTagsInput, setEditTagsInput)}
                            className={`text-[9px] font-mono border px-1.5 py-0.5 uppercase transition-opacity hover:opacity-80 ${getTagColor(tag)}`}
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Prioridade</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['low', 'medium', 'high'] as Priority[]).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setEditPriority(p)}
                        className={`py-2 text-[10px] font-mono uppercase tracking-[0.1em] border transition-colors ${
                          editPriority === p 
                            ? getPriorityColor(p) 
                            : 'bg-surface border-border-subtle text-text-muted hover:border-text-muted'
                        }`}
                      >
                        {getPriorityLabel(p)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Deadline</label>
                  <input 
                    type="date" 
                    value={editDeadline} 
                    onChange={(e) => setEditDeadline(e.target.value)} 
                    className="w-full bg-surface border border-border-subtle px-4 py-2 text-sm font-mono text-text-main focus:outline-none focus:border-error transition-colors uppercase" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Recompensa (XP)</label>
                <input
                  type="number"
                  value={editXpReward}
                  onChange={(e) => setEditXpReward(Number(e.target.value))}
                  className="w-32 bg-surface border border-border-subtle px-4 py-2 text-sm font-mono text-text-main focus:outline-none focus:border-error transition-colors"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">
                  <ListChecks className="w-3 h-3" />
                  Subtarefas
                </label>
                <div className="space-y-2">
                  {editSubItems.map(si => (
                    <div key={si.id} className="flex items-center gap-2 bg-surface border border-border-subtle px-3 py-2">
                      <input
                        type="checkbox"
                        checked={si.completed}
                        onChange={() => toggleEditSubItem(si.id)}
                        className="w-4 h-4 accent-success cursor-pointer"
                      />
                      <input
                        type="text"
                        value={si.text}
                        onChange={(e) => updateEditSubItemText(si.id, e.target.value)}
                        className={`flex-1 bg-transparent text-sm font-mono focus:outline-none ${si.completed ? 'line-through text-text-muted/60' : 'text-text-main'}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeEditSubItem(si.id)}
                        className="text-text-muted hover:text-error transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editNewSubItemText}
                      onChange={(e) => setEditNewSubItemText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEditSubItem(); } }}
                      placeholder="ADICIONAR SUBTAREFA..."
                      className="flex-1 bg-surface border border-border-subtle px-3 py-2 text-sm font-mono text-text-main focus:outline-none focus:border-error transition-colors placeholder:text-text-muted/50 uppercase"
                    />
                    <button
                      type="button"
                      onClick={addEditSubItem}
                      className="bg-surface border border-border-subtle px-3 py-2 text-text-muted hover:text-error hover:border-error transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 p-6 border-t border-border-subtle bg-surface-3/30 sticky bottom-0">
              <button onClick={() => setIsEditModalOpen(false)} className="btn-secondary flex items-center gap-2 text-xs py-2 px-6">
                CANCELAR
              </button>
              <button onClick={handleSaveEdit} className="btn-primary !bg-error hover:!bg-error/80 !text-black flex items-center gap-2 text-xs py-2 px-6">
                <Save className="w-4 h-4" />
                SALVAR ALTERAÇÕES
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Criação */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)}>
          <div className="bg-surface-2 border border-border-subtle w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border-subtle sticky top-0 bg-surface-2 z-10">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-error animate-pulse"></div>
                <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Nova Tarefa</h2>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-text-muted hover:text-error transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTask} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Título da Tarefa *</label>
                    <input 
                      type="text" 
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-error transition-colors placeholder:text-text-muted/50 uppercase" 
                      placeholder="EX: REVISAR CONTRATO" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Descrição (Opcional)</label>
                    <textarea 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-error transition-colors placeholder:text-text-muted/50 resize-none h-24" 
                      placeholder="Detalhes da missão..." 
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Responsável (Opcional)</label>
                    <input 
                      type="text" 
                      value={responsible}
                      onChange={(e) => setResponsible(e.target.value)}
                      className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-error transition-colors placeholder:text-text-muted/50 uppercase" 
                      placeholder="NOME DO RESPONSÁVEL" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Tags (Separadas por vírgula)</label>
                    <input 
                      type="text" 
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-error transition-colors placeholder:text-text-muted/50 uppercase" 
                      placeholder="URGENTE, REVISÃO, CLIENTE" 
                    />
                    {allAvailableTags.length > 0 && (
                      <div className="mt-3">
                        <span className="block text-[9px] font-mono text-text-muted uppercase mb-1.5">Tags Existentes (Clique para adicionar):</span>
                        <div className="flex flex-wrap gap-1.5">
                          {allAvailableTags.map(tag => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => handleAddTagToInput(tag, tagsInput, setTagsInput)}
                              className={`text-[9px] font-mono border px-1.5 py-0.5 uppercase transition-opacity hover:opacity-80 ${getTagColor(tag)}`}
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Prioridade</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['low', 'medium', 'high'] as Priority[]).map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`py-3 text-[10px] font-mono uppercase tracking-[0.1em] border transition-colors ${
                            priority === p 
                              ? getPriorityColor(p) 
                              : 'bg-surface border-border-subtle text-text-muted hover:border-text-muted'
                          }`}
                        >
                          {getPriorityLabel(p)}
                          <span className="block text-[8px] opacity-70 mt-1">
                            +{p === 'high' ? 30 : p === 'medium' ? 20 : 10} XP
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Deadline (Opcional)</label>
                    <input 
                      type="date" 
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-error transition-colors uppercase" 
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">
                  <ListChecks className="w-3 h-3" />
                  Subtarefas (Opcional)
                </label>
                <div className="space-y-2">
                  {subItems.map(si => (
                    <div key={si.id} className="flex items-center gap-2 bg-surface border border-border-subtle px-3 py-2">
                      <input
                        type="checkbox"
                        checked={si.completed}
                        onChange={() => setSubItems(prev => prev.map(s => s.id === si.id ? { ...s, completed: !s.completed } : s))}
                        className="w-4 h-4 accent-success cursor-pointer"
                      />
                      <span className={`flex-1 text-sm font-mono ${si.completed ? 'line-through text-text-muted/60' : 'text-text-main'}`}>
                        {si.text}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeCreateSubItem(si.id)}
                        className="text-text-muted hover:text-error transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSubItemText}
                      onChange={(e) => setNewSubItemText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCreateSubItem(); } }}
                      placeholder="ADICIONAR SUBTAREFA..."
                      className="flex-1 bg-surface border border-border-subtle px-3 py-2 text-sm font-mono text-text-main focus:outline-none focus:border-error transition-colors placeholder:text-text-muted/50 uppercase"
                    />
                    <button
                      type="button"
                      onClick={addCreateSubItem}
                      className="bg-surface border border-border-subtle px-3 py-2 text-text-muted hover:text-error hover:border-error transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t border-border-subtle">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn-secondary flex items-center gap-2 text-xs py-2 px-6">
                  CANCELAR
                </button>
                <button type="submit" className="btn-primary !bg-error hover:!bg-error/80 !text-black flex items-center gap-2 text-xs py-2 px-6">
                  <Plus className="w-4 h-4" />
                  CRIAR TAREFA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Compartilhamento */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setIsShareModalOpen(false)}>
          <div className="bg-surface-2 border border-border-subtle w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border-subtle">
              <div className="flex items-center gap-3">
                <Share2 className="w-5 h-5 text-info" />
                <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Compartilhar Board</h2>
              </div>
              <button onClick={() => setIsShareModalOpen(false)} className="text-text-muted hover:text-error transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <p className="text-xs font-mono text-text-muted">
                Convide membros para visualizar ou editar as tarefas deste workspace.
              </p>
              
              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">E-mail do Usuário</label>
                <input 
                  type="email" 
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-info transition-colors placeholder:text-text-muted/50" 
                  placeholder="exemplo@email.com" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Permissão</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShareRole('viewer')}
                    className={`py-2 text-[10px] font-mono uppercase tracking-[0.1em] border transition-colors ${
                      shareRole === 'viewer' 
                        ? 'bg-info/10 border-info text-info' 
                        : 'bg-surface border-border-subtle text-text-muted hover:border-text-muted'
                    }`}
                  >
                    Visualizador
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareRole('editor')}
                    className={`py-2 text-[10px] font-mono uppercase tracking-[0.1em] border transition-colors ${
                      shareRole === 'editor' 
                        ? 'bg-error/10 border-error text-error' 
                        : 'bg-surface border-border-subtle text-text-muted hover:border-text-muted'
                    }`}
                  >
                    Editor
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 p-6 border-t border-border-subtle bg-surface-3/30">
              <button onClick={() => setIsShareModalOpen(false)} className="btn-secondary flex items-center gap-2 text-xs py-2 px-6">
                CANCELAR
              </button>
              <button onClick={() => {
                alert('Funcionalidade de convite requer configuração de permissões no Supabase.');
                setIsShareModalOpen(false);
              }} className="btn-primary !bg-info hover:!bg-info/80 !text-black flex items-center gap-2 text-xs py-2 px-6">
                <Share2 className="w-4 h-4" />
                ENVIAR CONVITE
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Jarvis Chat Assistant */}

    </div>
  );
}
