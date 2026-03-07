import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle, CheckCircle2, Plus, GripVertical, Trash2, X, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Priority = 'low' | 'medium' | 'high';
type Status = 'backlog' | 'doing' | 'done';

interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  deadline: string;
  status: Status;
  xp_reward: number;
}

export default function Trabalho() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [deadline, setDeadline] = useState('');

  // Edit Modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');
  const [editDeadline, setEditDeadline] = useState('');
  const [editXpReward, setEditXpReward] = useState(0);

  useEffect(() => {
    fetchTasks();
  }, []);

  const openEditModal = (task: Task) => {
    setSelectedTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority);
    setEditDeadline(task.deadline || '');
    setEditXpReward(task.xp_reward);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedTask || !editTitle.trim()) return;

    const updatedTask = {
      title: editTitle,
      description: editDescription,
      priority: editPriority,
      deadline: editDeadline || null,
      xp_reward: editXpReward
    };

    try {
      // Optimistic update
      setTasks(tasks.map(t => t.id === selectedTask.id ? { ...t, ...updatedTask } : t));
      setIsEditModalOpen(false);

      const { error } = await supabase
        .from('work_tasks')
        .update(updatedTask)
        .eq('id', selectedTask.id);

      if (error) {
        fetchTasks();
        throw error;
      }
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

  const handleDrop = async (e: React.DragEvent, newStatus: Status) => {
    e.preventDefault();
    if (!draggedTaskId) return;

    const taskToUpdate = tasks.find(t => t.id === draggedTaskId);
    if (!taskToUpdate || taskToUpdate.status === newStatus) {
      setDraggedTaskId(null);
      return;
    }

    // Optimistic update
    setTasks(prev => prev.map(task => {
      if (task.id === draggedTaskId) {
        return { ...task, status: newStatus };
      }
      return task;
    }));

    try {
      const { error } = await supabase
        .from('work_tasks')
        .update({ status: newStatus })
        .eq('id', draggedTaskId);

      if (error) throw error;

      // Se moveu para 'done', atualiza XP do usuário
      if (newStatus === 'done') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Busca perfil atual
          const { data: profile } = await supabase
            .from('profiles')
            .select('total_xp')
            .eq('id', user.id)
            .single();
            
          if (profile) {
            // Atualiza XP
            await supabase
              .from('profiles')
              .update({ total_xp: profile.total_xp + taskToUpdate.xp_reward })
              .eq('id', user.id);
          }
        }
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      // Revert optimistic update on error
      fetchTasks();
    } finally {
      setDraggedTaskId(null);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const xp_reward = priority === 'high' ? 30 : priority === 'medium' ? 20 : 10;

      const newTask = {
        user_id: user.id,
        title,
        description,
        priority,
        deadline: deadline || null,
        status: 'backlog',
        xp_reward
      };

      const { data, error } = await supabase
        .from('work_tasks')
        .insert([newTask])
        .select()
        .single();

      if (error) throw error;

      setTasks([data, ...tasks]);
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDeadline('');
    } catch (error) {
      console.error('Error adding task:', error);
      alert('Erro ao adicionar tarefa.');
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta tarefa?')) return;
    try {
      const { error } = await supabase
        .from('work_tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setTasks(tasks.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const getPriorityColor = (p: Priority) => {
    if (p === 'high') return 'text-error border-error/30 bg-error/10';
    if (p === 'medium') return 'text-accent border-accent/30 bg-accent/10';
    return 'text-success border-success/30 bg-success/10';
  };

  const getPriorityLabel = (p: Priority) => {
    if (p === 'high') return 'ALTA';
    if (p === 'medium') return 'MÉDIA';
    return 'BAIXA';
  };

  const renderColumn = (status: Status, columnTitle: string, colorClass: string) => {
    const columnTasks = tasks.filter(t => t.status === status);

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
              onClick={() => openEditModal(task)}
              className="bg-surface border border-border-subtle p-4 cursor-grab active:cursor-grabbing hover:border-accent/50 transition-colors group relative"
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
              
              {task.deadline && (
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted mt-3 pl-2 pt-3 border-t border-border-subtle/50">
                  <Clock className="w-3 h-3" />
                  <span>DEADLINE: {new Date(task.deadline).toLocaleDateString('pt-BR')}</span>
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
        <div className="flex items-baseline gap-4 mb-6">
          <span className="text-[11px] font-bold text-error tracking-[0.1em] font-mono border border-error/30 px-2 py-0.5">01</span>
          <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Kanban Board</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {renderColumn('backlog', 'BACKLOG', 'text-text-muted')}
          {renderColumn('doing', 'EM ANDAMENTO', 'text-accent')}
          {renderColumn('done', 'CONCLUÍDO', 'text-success')}
        </div>
      </section>

      {/* Secao 02 - Nova Tarefa */}
      <section id="secao-02">
        <div className="flex items-baseline gap-4 mb-6">
          <span className="text-[11px] font-bold text-error tracking-[0.1em] font-mono border border-error/30 px-2 py-0.5">02</span>
          <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Nova Tarefa</h2>
        </div>

        <form onSubmit={handleAddTask} className="bg-surface-2 border border-border-subtle p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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

          <div className="flex justify-end border-t border-border-subtle pt-6">
            <button type="submit" className="btn-primary !bg-error hover:!bg-error/80 !text-black flex items-center gap-2">
              <Plus className="w-4 h-4" />
              CRIAR TAREFA
            </button>
          </div>
        </form>
      </section>

      {/* Secao 03 - Estatisticas */}
      <section id="secao-03">
        <div className="flex items-baseline gap-4 mb-6">
          <span className="text-[11px] font-bold text-error tracking-[0.1em] font-mono border border-error/30 px-2 py-0.5">03</span>
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
    </div>
  );
}
