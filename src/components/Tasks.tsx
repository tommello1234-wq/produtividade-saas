import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  xp_reward: number;
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('work_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newTaskObj = {
        user_id: user.id,
        title: newTask,
        description: '',
        status: 'todo',
        priority: 'medium',
        xp_reward: 50,
      };

      const { data, error } = await supabase
        .from('work_tasks')
        .insert([newTaskObj])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setTasks([data, ...tasks]);
        setNewTask('');
      }
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const toggleTask = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'done' ? 'todo' : 'done';
      
      // Optimistic update
      setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus as any } : t));

      const { error } = await supabase
        .from('work_tasks')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) {
        // Revert on error
        setTasks(tasks.map(t => t.id === id ? { ...t, status: currentStatus as any } : t));
        throw error;
      }

      // If marked as done, update user XP
      if (newStatus === 'done') {
        const taskToUpdate = tasks.find(t => t.id === id);
        if (taskToUpdate) {
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
      }

    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      // Optimistic update
      setTasks(tasks.filter(t => t.id !== id));

      const { error } = await supabase
        .from('work_tasks')
        .delete()
        .eq('id', id);

      if (error) {
        // Revert on error (would need to keep a copy of the deleted task to truly revert)
        fetchTasks();
        throw error;
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const completedCount = tasks.filter(t => t.status === 'done').length;

  return (
    <div className="space-y-12 pb-12">
      <section className="relative border-b border-border-subtle pb-12 mb-12">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-text-muted uppercase mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-accent"></div>
            SYSTEM ONLINE // MISSIONS
          </div>
          <h1 className="text-[64px] font-black leading-[0.9] tracking-[-2px] uppercase mb-2">
            DAILY<br/><span className="text-surface-3">MISSIONS</span>
          </h1>
          <p className="text-[13px] text-text-muted max-w-lg leading-[1.7] mb-7 font-mono border-l-2 border-accent pl-3">
            Gerenciamento de tarefas diárias. Complete missões para ganhar XP e subir de nível.
          </p>
        </div>
      </section>

      <section>
        <div className="flex items-baseline gap-4 mb-9">
          <span className="text-[11px] font-bold text-accent tracking-[0.1em] font-mono border border-border-accent px-2 py-0.5">01</span>
          <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Active Missions</h2>
          <span className="text-xs text-text-muted ml-auto font-mono">
            // {completedCount}/{tasks.length} COMPLETED
          </span>
        </div>

        <form onSubmit={addTask} className="flex gap-3 mb-8">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="ENTER NEW MISSION..."
            className="flex-1 bg-surface-2 border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors uppercase placeholder:text-text-muted/50"
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            ADD MISSION +
          </button>
        </form>

        {loading ? (
           <div className="text-center py-12 text-text-muted font-mono text-sm">LOADING MISSIONS...</div>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => {
              const isCompleted = task.status === 'done';
              return (
                <div 
                  key={task.id} 
                  className={`flex items-center justify-between p-4 border transition-all ${
                    isCompleted 
                      ? 'bg-surface border-border-subtle opacity-50' 
                      : 'bg-surface-2 border-border-subtle hover:border-accent/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => toggleTask(task.id, task.status)}
                      className={`w-5 h-5 border flex items-center justify-center transition-colors ${
                        isCompleted ? 'bg-accent border-accent text-black' : 'border-border-subtle hover:border-accent'
                      }`}
                    >
                      {isCompleted && (
                        <svg viewBox="0 0 14 14" fill="none" className="w-3.5 h-3.5">
                          <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"/>
                        </svg>
                      )}
                    </button>
                    <span className={`text-sm font-medium uppercase tracking-[0.04em] ${isCompleted ? 'line-through text-text-muted' : 'text-text-main'}`}>
                      {task.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-mono font-bold text-accent border border-border-accent bg-accent/10 px-2 py-1">
                      +{task.xp_reward} XP
                    </span>
                    <button onClick={() => deleteTask(task.id)} className="text-text-muted hover:text-error transition-colors text-[10px] font-mono uppercase tracking-[0.1em]">
                      [DEL]
                    </button>
                  </div>
                </div>
              );
            })}
            {tasks.length === 0 && (
              <div className="text-center py-12 border border-dashed border-border-subtle text-text-muted font-mono text-sm">
                NO ACTIVE MISSIONS.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
