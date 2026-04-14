import React, { useState, useEffect } from 'react';
import { Plus, Check, Circle, Flame, Target, Trash2, X, Activity, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

const WEEK_DAYS = [
  { id: 0, label: 'D' },
  { id: 1, label: 'S' },
  { id: 2, label: 'T' },
  { id: 3, label: 'Q' },
  { id: 4, label: 'Q' },
  { id: 5, label: 'S' },
  { id: 6, label: 'S' },
];

export default function Habitos({ hideHeader = false }: { hideHeader?: boolean }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [processingLogs, setProcessingLogs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newXp, setNewXp] = useState('20');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const todayStr = getLocalDateString(new Date());

  useEffect(() => {
    fetchHabits();

    const handleRefresh = () => fetchHabits();
    window.addEventListener('app_data_changed', handleRefresh);
    return () => window.removeEventListener('app_data_changed', handleRefresh);
  }, []);

  const fetchHabits = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 28);
      const startDateStr = getLocalDateString(thirtyDaysAgo);

      const [habitsRes, logsRes] = await Promise.all([
        supabase.from('habits').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('habit_logs').select('*').eq('user_id', user.id).gte('completed_date', startDateStr)
      ]);

      if (habitsRes.data) setHabits(habitsRes.data);
      if (logsRes.data) {
        const normalizedLogs = logsRes.data.map(log => ({
          ...log,
          completed_date: log.completed_date.split('T')[0]
        }));
        setLogs(normalizedLogs);
      }
    } catch (error) {
      console.error('Error fetching habits:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (habit?: Habit) => {
    if (habit) {
      const parts = habit.title.split('|days:');
      setNewTitle(parts[0]);
      setSelectedDays(parts[1] ? parts[1].split(',').map(Number) : [0, 1, 2, 3, 4, 5, 6]);
      setNewXp(habit.xp_reward.toString());
      setEditingHabit(habit);
    } else {
      setNewTitle('');
      setNewXp('20');
      setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
      setEditingHabit(null);
    }
    setIsModalOpen(true);
  };

  const handleSaveHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    const fullTitle = `${newTitle}|days:${selectedDays.join(',')}`;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Test mode fallback
        if (editingHabit) {
          setHabits(prev => prev.map(h => h.id === editingHabit.id ? { ...h, title: fullTitle, xp_reward: parseInt(newXp) || 20 } : h));
        } else {
          const fakeId = Math.random().toString(36).substring(7);
          const newHabit = { id: fakeId, title: fullTitle, xp_reward: parseInt(newXp) || 20, created_at: new Date().toISOString() };
          setHabits(prev => [...prev, newHabit]);
        }
        setIsModalOpen(false);
        return;
      }

      if (editingHabit) {
        const { data, error } = await supabase
          .from('habits')
          .update({ title: fullTitle, xp_reward: parseInt(newXp) || 20 })
          .eq('id', editingHabit.id)
          .select()
          .single();

        if (error) throw error;
        setHabits(prev => prev.map(h => h.id === editingHabit.id ? data : h));
      } else {
        const { data, error } = await supabase
          .from('habits')
          .insert([{ user_id: user.id, title: fullTitle, xp_reward: parseInt(newXp) || 20 }])
          .select()
          .single();

        if (error) throw error;
        setHabits(prev => [...prev, data]);
      }
      
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error saving habit:', error);
      alert(`Erro ao salvar hábito: ${error.message || JSON.stringify(error)}`);
    }
  };

  const handleDeleteHabit = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja excluir este hábito?')) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Test mode fallback
        setHabits(prev => prev.filter(h => h.id !== id));
        setLogs(prev => prev.filter(l => l.habit_id !== id));
        return;
      }

      const { error } = await supabase.from('habits').delete().eq('id', id);
      if (error) throw error;
      setHabits(prev => prev.filter(h => h.id !== id));
      setLogs(prev => prev.filter(l => l.habit_id !== id));
    } catch (error) {
      console.error('Error deleting habit:', error);
    }
  };

  const toggleHabit = async (habitId: string, dateStr: string) => {
    const key = `${habitId}_${dateStr}`;
    if (processingLogs.has(key)) return;

    setProcessingLogs(prev => new Set(prev).add(key));
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Test mode fallback
        setLogs(prevLogs => {
          const existingLog = prevLogs.find(l => l.habit_id === habitId && l.completed_date === dateStr);
          if (existingLog) {
            return prevLogs.filter(l => l.id !== existingLog.id);
          } else {
            const fakeId = Math.random().toString(36).substring(7);
            return [...prevLogs, { id: fakeId, habit_id: habitId, completed_date: dateStr }];
          }
        });
        return;
      }

      let isChecked = false;
      let existingLogId: string | null = null;
      
      setLogs(prevLogs => {
        const existingLog = prevLogs.find(l => l.habit_id === habitId && l.completed_date === dateStr);
        if (existingLog) {
          isChecked = true;
          existingLogId = existingLog.id;
          return prevLogs.filter(l => l.id !== existingLog.id);
        } else {
          isChecked = false;
          existingLogId = `temp_${Math.random()}`;
          return [...prevLogs, { id: existingLogId, habit_id: habitId, completed_date: dateStr, user_id: user.id }];
        }
      });

      if (isChecked && existingLogId) {
        // Uncheck
        const { error } = await supabase.from('habit_logs').delete().eq('id', existingLogId);
        if (error) {
          // Revert on error
          setLogs(prevLogs => [...prevLogs, { id: existingLogId!, habit_id: habitId, completed_date: dateStr, user_id: user.id } as any]);
          throw error;
        }
      } else if (!isChecked && existingLogId) {
        // Check
        const { data, error } = await supabase
          .from('habit_logs')
          .insert([{ user_id: user.id, habit_id: habitId, completed_date: dateStr }])
          .select()
          .single();
          
        if (error) {
          // Revert on error
          setLogs(prevLogs => prevLogs.filter(l => l.id !== existingLogId));
          throw error;
        }
        
        // Update temp ID with real ID
        setLogs(prevLogs => prevLogs.map(l => l.id === existingLogId ? { ...data, completed_date: data.completed_date.split('T')[0] } : l));
      }
    } catch (error: any) {
      console.error('Error toggling habit:', error);
      alert(`Erro ao registrar hábito: ${error.message || JSON.stringify(error)}`);
    } finally {
      setProcessingLogs(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const generateWeeks = () => {
    const weeks = [];
    for (let w = 0; w < 4; w++) {
      const weekDays = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date();
        const daysAgo = 27 - (w * 7 + d);
        date.setDate(date.getDate() - daysAgo);
        weekDays.push(date);
      }
      weeks.push(weekDays);
    }
    return weeks;
  };
  const weeks = generateWeeks();

  const completedCount = logs.filter(l => l.completed_date === todayStr).length;
  const totalCount = habits.length;
  const progress = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;
  const xpEarned = logs.filter(l => l.completed_date === todayStr).reduce((acc, log) => {
    const habit = habits.find(h => h.id === log.habit_id);
    return acc + (habit?.xp_reward || 0);
  }, 0);

  const maxStreak = habits.length > 0 ? Math.max(...habits.map(habit => {
    return logs.filter(l => l.habit_id === habit.id).length;
  })) : 0;

  if (loading) {
    return <div className="p-12 text-center font-mono text-text-muted">CARREGANDO DADOS DO SUPABASE...</div>;
  }

  return (
    <div className="space-y-12 pb-12">
      {!hideHeader && (
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
      )}

      {/* Grade de Hábitos (Design System Style) */}
      <div className="bg-surface-2 border border-border-subtle p-6 overflow-x-auto hide-scrollbar">
        <div className="flex justify-between items-center mb-8 min-w-[800px]">
          <div className="flex items-baseline gap-4">
            <span className="text-[11px] font-bold text-accent tracking-[0.1em] font-mono border border-border-accent px-2 py-0.5">01</span>
            <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase text-text-main">Grade de Hábitos</h2>
          </div>
          <button onClick={() => openModal()} className="btn-secondary flex items-center gap-2 text-[10px] py-2 px-4">
            <Plus className="w-3 h-3" /> ADICIONAR HÁBITO
          </button>
        </div>

        <div className="min-w-[800px]">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-48 p-2"></th>
                {weeks.map((week, i) => (
                  <th key={i} colSpan={7} className="text-center text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] pb-4">
                    Semana {i + 1}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="text-left p-2 pb-4 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] border-b border-border-subtle">Hábito</th>
                {weeks.flatMap((week, wIndex) => 
                  week.map((date, dIndex) => {
                    const dayNum = wIndex * 7 + dIndex + 1;
                    const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    const weekDay = date.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase().replace('.', '');
                    const isToday = date.toISOString().split('T')[0] === todayStr;
                    
                    return (
                      <th key={dayNum} className={`p-1 pb-4 text-center border-b border-border-subtle ${isToday ? 'bg-surface-3/50' : ''}`}>
                        <div className="flex flex-col items-center justify-center text-[9px] font-mono text-text-muted gap-0.5">
                          <span className="text-text-main font-bold text-[10px]">DIA {dayNum.toString().padStart(2, '0')}</span>
                        </div>
                      </th>
                    );
                  })
                )}
              </tr>
            </thead>
            <tbody>
              {habits.length === 0 ? (
                <tr>
                  <td colSpan={29} className="p-8 text-center text-xs font-mono text-text-muted uppercase">
                    Nenhum hábito cadastrado.
                  </td>
                </tr>
              ) : (
                habits.map(habit => {
                  const habitLogs = logs.filter(l => l.habit_id === habit.id);
                  const percentage = Math.round((habitLogs.length / 28) * 100);
                  const displayTitle = habit.title.split('|days:')[0];

                  return (
                    <tr key={habit.id} className="group hover:bg-surface transition-colors">
                      <td className="p-3 border-b border-border-subtle">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-text-main uppercase tracking-[0.05em] group-hover:text-accent transition-colors">{displayTitle}</span>
                            <div className="h-0.5 w-6 bg-accent mt-1.5 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono text-text-muted">{percentage}%</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openModal(habit)} className="text-text-muted hover:text-accent p-1">
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button onClick={(e) => handleDeleteHabit(habit.id, e)} className="text-text-muted hover:text-error p-1">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                      {weeks.flatMap((week, wIndex) => 
                        week.map((date, dIndex) => {
                          const dateStr = getLocalDateString(date);
                          const isDone = logs.some(l => l.habit_id === habit.id && l.completed_date === dateStr);
                          const isToday = dateStr === todayStr;
                          
                          const habitDays = habit.title.split('|days:')[1] ? habit.title.split('|days:')[1].split(',').map(Number) : [0, 1, 2, 3, 4, 5, 6];
                          const isRequiredDay = habitDays.includes(date.getDay());

                          return (
                            <td key={dateStr} className={`p-1 text-center border-b border-border-subtle ${isToday ? 'bg-surface-3/50' : ''}`}>
                              {isRequiredDay ? (
                                <button 
                                  onClick={() => toggleHabit(habit.id, dateStr)}
                                  disabled={processingLogs.has(`${habit.id}_${dateStr}`)}
                                  className={`w-6 h-6 flex items-center justify-center mx-auto rounded-none transition-all hover:scale-110 focus:outline-none ${processingLogs.has(`${habit.id}_${dateStr}`) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  {isDone ? (
                                    <div className="w-4 h-4 rounded-full bg-accent flex items-center justify-center shadow-[0_0_10px_rgba(249,115,22,0.4)]">
                                      <Check className="w-3 h-3 text-black stroke-[3]" />
                                    </div>
                                  ) : (
                                    <div className="w-4 h-4 rounded-full border border-border-subtle hover:border-accent transition-colors"></div>
                                  )}
                                </button>
                              ) : (
                                <div className="w-6 h-6 flex items-center justify-center mx-auto">
                                  <div className="w-1 h-1 rounded-full bg-border-subtle"></div>
                                </div>
                              )}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {/* Progresso do Dia */}
        <div className="bg-surface-2 border border-border-subtle p-6">
          <div className="flex items-baseline gap-4 mb-6">
            <span className="text-[11px] font-bold text-accent tracking-[0.1em] font-mono border border-border-accent px-2 py-0.5">02</span>
            <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Status</h2>
          </div>
          <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
            <Activity className="w-3 h-3 text-info" />
            ADERÊNCIA DIÁRIA (HOJE)
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
            MAIOR STREAK
          </div>
          <div className="text-4xl font-black tracking-[-1px] text-error">{maxStreak} DIAS</div>
          <div className="text-[10px] font-mono text-text-muted mt-2 uppercase">Maior sequência ativa atual</div>
        </div>
      </div>

      {/* Modal Novo Hábito */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-surface-2 border border-border-subtle w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-border-subtle bg-surface-3/50">
              <h3 className="text-sm font-bold uppercase tracking-[0.1em]">{editingHabit ? 'Editar Hábito' : 'Novo Hábito'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-error transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveHabit} className="p-6 space-y-6">
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
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Dias da Semana</label>
                <div className="flex gap-2">
                  {WEEK_DAYS.map(day => {
                    const isSelected = selectedDays.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (selectedDays.length > 1) {
                              setSelectedDays(selectedDays.filter(d => d !== day.id));
                            }
                          } else {
                            setSelectedDays([...selectedDays, day.id].sort());
                          }
                        }}
                        className={`w-8 h-8 flex items-center justify-center text-xs font-mono font-bold transition-colors ${
                          isSelected 
                            ? 'bg-accent text-black' 
                            : 'bg-surface border border-border-subtle text-text-muted hover:border-accent/50'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-text-muted mt-2 font-mono">Selecione os dias em que você deve realizar este hábito.</p>
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
                {editingHabit ? 'SALVAR ALTERAÇÕES' : 'CRIAR HÁBITO'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
