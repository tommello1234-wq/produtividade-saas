import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle2, Circle, Flame, Target, Trash2, X, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Habit {
  id: string;
  title: string;
  xp_reward: number;
  created_at: string;
}

interface HabitLog {
  id: string;
  habit_id: string;
  completed_date: string;
}

export default function Habitos() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newXp, setNewXp] = useState('20');

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchHabits();
  }, []);

  const fetchHabits = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [habitsRes, logsRes] = await Promise.all([
        supabase.from('habits').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('habit_logs').select('*').eq('user_id', user.id).eq('completed_date', todayStr)
      ]);

      if (habitsRes.data) setHabits(habitsRes.data);
      if (logsRes.data) setLogs(logsRes.data);
    } catch (error) {
      console.error('Error fetching habits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Test mode fallback
        const fakeId = Math.random().toString(36).substring(7);
        const newHabit = { id: fakeId, title: newTitle, xp_reward: parseInt(newXp) || 20, created_at: new Date().toISOString() };
        setHabits([...habits, newHabit]);
        setIsModalOpen(false);
        setNewTitle('');
        setNewXp('20');
        return;
      }

      const { data, error } = await supabase
        .from('habits')
        .insert([{ user_id: user.id, title: newTitle, xp_reward: parseInt(newXp) || 20 }])
        .select()
        .single();

      if (error) throw error;

      setHabits([...habits, data]);
      setIsModalOpen(false);
      setNewTitle('');
      setNewXp('20');
    } catch (error: any) {
      console.error('Error adding habit:', error);
      alert(`Erro ao adicionar hábito: ${error.message || JSON.stringify(error)}`);
    }
  };

  const handleDeleteHabit = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Test mode fallback
        setHabits(habits.filter(h => h.id !== id));
        setLogs(logs.filter(l => l.habit_id !== id));
        return;
      }

      const { error } = await supabase.from('habits').delete().eq('id', id);
      if (error) throw error;
      setHabits(habits.filter(h => h.id !== id));
      setLogs(logs.filter(l => l.habit_id !== id));
    } catch (error) {
      console.error('Error deleting habit:', error);
    }
  };

  const toggleHabit = async (habitId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const existingLog = logs.find(l => l.habit_id === habitId);

      if (!user) {
        // Test mode fallback
        if (existingLog) {
          setLogs(logs.filter(l => l.id !== existingLog.id));
        } else {
          const fakeId = Math.random().toString(36).substring(7);
          setLogs([...logs, { id: fakeId, habit_id: habitId, completed_date: todayStr }]);
        }
        return;
      }

      if (existingLog) {
        // Uncheck
        const { error } = await supabase.from('habit_logs').delete().eq('id', existingLog.id);
        if (error) throw error;
        setLogs(logs.filter(l => l.id !== existingLog.id));
      } else {
        // Check
        const { data, error } = await supabase
          .from('habit_logs')
          .insert([{ user_id: user.id, habit_id: habitId, completed_date: todayStr }])
          .select()
          .single();
        if (error) throw error;
        setLogs([...logs, data]);
      }
    } catch (error: any) {
      console.error('Error toggling habit:', error);
      alert(`Erro ao registrar hábito: ${error.message || JSON.stringify(error)}`);
    }
  };

  const completedCount = logs.length;
  const totalCount = habits.length;
  const progress = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;
  const xpEarned = logs.reduce((acc, log) => {
    const habit = habits.find(h => h.id === log.habit_id);
    return acc + (habit?.xp_reward || 0);
  }, 0);

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
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></div>
            SYSTEM MODULE // HABIT TRACKER
          </div>
          <h1 className="text-[64px] font-black leading-[0.9] tracking-[-2px] uppercase mb-2">
            DAILY<br/><span className="text-surface-3">HABITS</span>
          </h1>
          <p className="text-[13px] text-text-muted max-w-lg leading-[1.7] mb-7 font-mono border-l-2 border-accent pl-3">
            Gerenciamento de rotinas e hábitos. Marque suas conclusões diárias para acumular XP e manter seu streak.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section>
            <div className="flex justify-between items-end mb-6">
              <div className="flex items-baseline gap-4">
                <span className="text-[11px] font-bold text-accent tracking-[0.1em] font-mono border border-border-accent px-2 py-0.5">01</span>
                <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Hábitos de Hoje</h2>
              </div>
              <button onClick={() => setIsModalOpen(true)} className="btn-primary !bg-accent hover:!bg-accent/80 !text-black flex items-center gap-2">
                <Plus className="w-4 h-4" />
                NOVO HÁBITO
              </button>
            </div>

            <div className="bg-surface-2 border border-border-subtle p-6">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-6 flex justify-between">
                <span>Lista de Execução</span>
                <span>{completedCount} / {totalCount} CONCLUÍDOS</span>
              </div>
              
              <div className="space-y-3">
                {habits.length === 0 ? (
                  <div className="p-8 text-center text-xs font-mono text-text-muted uppercase border border-border-subtle bg-surface">
                    Nenhum hábito cadastrado.
                  </div>
                ) : (
                  habits.map(habit => {
                    const isDone = logs.some(l => l.habit_id === habit.id);
                    return (
                      <button
                        key={habit.id}
                        onClick={() => toggleHabit(habit.id)}
                        className={`w-full flex items-center justify-between p-4 border transition-all group ${
                          isDone 
                            ? 'border-success/30 bg-success/5' 
                            : 'border-border-subtle bg-surface hover:border-accent/50'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                          ) : (
                            <Circle className="w-5 h-5 text-text-muted shrink-0 group-hover:text-accent transition-colors" />
                          )}
                          <span className={`font-mono text-sm uppercase tracking-[0.05em] text-left ${isDone ? 'text-text-muted line-through' : 'text-text-main group-hover:text-accent transition-colors'}`}>
                            {habit.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-[10px] font-mono font-bold ${isDone ? 'text-success' : 'text-accent'}`}>
                            +{habit.xp_reward} XP
                          </span>
                          <div 
                            onClick={(e) => handleDeleteHabit(habit.id, e)}
                            className="text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <div className="flex items-baseline gap-4 mb-6">
              <span className="text-[11px] font-bold text-accent tracking-[0.1em] font-mono border border-border-accent px-2 py-0.5">02</span>
              <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Status</h2>
            </div>

            <div className="space-y-6">
              {/* Progresso do Dia */}
              <div className="bg-surface-2 border border-border-subtle p-6">
                <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
                  <Activity className="w-3 h-3 text-info" />
                  ADERÊNCIA DIÁRIA
                </div>
                <div className="flex items-end gap-2 mb-3">
                  <span className="text-4xl font-black tracking-[-1px] text-info">{progress.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 w-full bg-surface border border-border-subtle overflow-hidden relative">
                  <div className="absolute top-0 left-0 h-full bg-info shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>
              </div>

              {/* XP do Dia */}
              <div className="bg-surface-2 border border-border-subtle p-6">
                <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
                  <Target className="w-3 h-3 text-success" />
                  XP ACUMULADO HOJE
                </div>
                <div className="text-4xl font-black tracking-[-1px] text-success">+{xpEarned}</div>
                <div className="text-[10px] font-mono text-text-muted mt-2 uppercase">Bônus de consistência em breve</div>
              </div>

              {/* Streak */}
              <div className="bg-surface-2 border border-border-subtle p-6">
                <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
                  <Flame className="w-3 h-3 text-error" />
                  STREAK ATUAL
                </div>
                <div className="text-4xl font-black tracking-[-1px] text-error">0 DIAS</div>
                <div className="text-[10px] font-mono text-text-muted mt-2 uppercase">Funcionalidade em desenvolvimento</div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Modal Novo Hábito */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-surface-2 border border-border-subtle w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-border-subtle bg-surface-3/50">
              <h3 className="text-sm font-bold uppercase tracking-[0.1em]">Novo Hábito</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-error transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddHabit} className="p-6 space-y-6">
              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Título do Hábito</label>
                <input 
                  type="text" 
                  required 
                  value={newTitle} 
                  onChange={e => setNewTitle(e.target.value)} 
                  className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors uppercase" 
                  placeholder="EX: LER 15 PÁGINAS" 
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Recompensa (XP)</label>
                <input 
                  type="number" 
                  required 
                  value={newXp} 
                  onChange={e => setNewXp(e.target.value)} 
                  className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors" 
                  placeholder="20" 
                />
              </div>

              <button type="submit" className="w-full py-4 text-[11px] font-mono font-bold uppercase tracking-[0.1em] transition-colors bg-accent hover:bg-accent/80 text-black">
                CRIAR HÁBITO
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
