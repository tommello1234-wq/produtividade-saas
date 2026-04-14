import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CheckCircle2, Circle, Flame, Target, Wallet, Briefcase, Activity, Crosshair } from 'lucide-react';
import { supabase } from '../lib/supabase';

const progressData = [
  { day: '1', progress: 100 },
  { day: '2', progress: 100 },
  { day: '3', progress: 95 },
  { day: '4', progress: 90 },
  { day: '5', progress: 85 },
  { day: '6', progress: 80 },
  { day: '7', progress: 70 },
  { day: '8', progress: 40 },
  { day: '9', progress: 10 },
  { day: '10', progress: 5 },
  { day: '11', progress: 5 },
  { day: '12', progress: 5 },
  { day: '13', progress: 10 },
  { day: '14', progress: 15 },
];

interface Habit {
  id: string;
  title: string;
  xp_reward: number;
}

interface HabitLog {
  id: string;
  habit_id: string;
}

const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Dashboard() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [balance, setBalance] = useState(0);
  const [pendingTasks, setPendingTasks] = useState(0);

  const todayStr = getLocalDateString(new Date());

  useEffect(() => {
    fetchDashboardData();

    const handleRefresh = () => fetchDashboardData();
    window.addEventListener('app_data_changed', handleRefresh);
    return () => window.removeEventListener('app_data_changed', handleRefresh);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch Balance
      const { data: transactions } = await supabase
        .from('financial_transactions')
        .select('amount')
        .eq('user_id', user.id);

      if (transactions) {
        const currentBalance = transactions.reduce((acc, curr) => acc + Number(curr.amount), 0);
        setBalance(currentBalance);
      }

      // Fetch Pending Tasks
      const { data: tasks } = await supabase
        .from('work_tasks')
        .select('id')
        .eq('user_id', user.id)
        .neq('status', 'done');

      if (tasks) {
        setPendingTasks(tasks.length);
      }

      // Fetch Habits
      const [habitsRes, logsRes] = await Promise.all([
        supabase.from('habits').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('habit_logs').select('*').eq('user_id', user.id).eq('completed_date', todayStr)
      ]);

      if (habitsRes.data) setHabits(habitsRes.data);
      if (logsRes.data) setHabitLogs(logsRes.data);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const toggleHabit = async (habitId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const existingLog = habitLogs.find(l => l.habit_id === habitId);

      if (!user) {
        // Test mode fallback
        if (existingLog) {
          setHabitLogs(habitLogs.filter(l => l.id !== existingLog.id));
        } else {
          const fakeId = Math.random().toString(36).substring(7);
          setHabitLogs([...habitLogs, { id: fakeId, habit_id: habitId }]);
        }
        return;
      }

      if (existingLog) {
        // Uncheck
        const { error } = await supabase.from('habit_logs').delete().eq('id', existingLog.id);
        if (error) throw error;
        setHabitLogs(habitLogs.filter(l => l.id !== existingLog.id));
      } else {
        // Check
        const { data, error } = await supabase
          .from('habit_logs')
          .insert([{ user_id: user.id, habit_id: habitId, completed_date: todayStr }])
          .select()
          .single();
        if (error) throw error;
        setHabitLogs([...habitLogs, data]);
      }
    } catch (error: any) {
      console.error('Error toggling habit:', error);
      alert(`Erro ao registrar hábito: ${error.message || JSON.stringify(error)}`);
    }
  };

  const xpToday = habitLogs.reduce((acc, log) => {
    const habit = habits.find(h => h.id === log.habit_id);
    return acc + (habit?.xp_reward || 0);
  }, 0);
  const xpGoal = 100;

  return (
    <div className="space-y-12 pb-12">
      {/* Secao 01 - Hero / Status Geral */}
      <section id="secao-01" className="relative border-b border-border-subtle pb-12 mb-12">
        <div className="absolute inset-0 z-0 opacity-5 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-text-muted uppercase mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
            SYSTEM ONLINE // HABIT TRACKER
          </div>
          <h1 className="text-[64px] font-black leading-[0.9] tracking-[-2px] uppercase mb-2">
            OVERVIEW<br/><span className="text-surface-3">DASHBOARD</span>
          </h1>
          <p className="text-[13px] text-text-muted max-w-lg leading-[1.7] mb-7 font-mono border-l-2 border-accent pl-3">
            Monitoramento de consistência e execução de rotinas. Mantenha os níveis de XP altos para garantir o progresso.
          </p>
        </div>
      </section>

      {/* Secao 02 - Progresso Geral */}
      <section id="secao-02">
        <div className="flex items-baseline gap-4 mb-9">
          <span className="text-[11px] font-bold text-accent tracking-[0.1em] font-mono border border-border-accent px-2 py-0.5">01</span>
          <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Progresso Geral</h2>
          <span className="text-xs text-text-muted ml-auto font-mono">// 14 dias</span>
        </div>
        
        <div className="bg-surface-2 border border-border-subtle p-6">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={progressData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="day" stroke="#A6A6A6" tick={{fill: '#A6A6A6', fontSize: 10, fontFamily: 'monospace'}} axisLine={false} tickLine={false} />
                <YAxis stroke="#A6A6A6" tick={{fill: '#A6A6A6', fontSize: 10, fontFamily: 'monospace'}} tickFormatter={(value) => `${value}%`} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', borderColor: 'rgba(255,255,255,0.1)', color: '#FAFAFA', fontSize: '12px', fontFamily: 'monospace' }}
                  itemStyle={{ color: '#F97316' }}
                />
                <Area type="monotone" dataKey="progress" stroke="#F97316" strokeWidth={2} fillOpacity={1} fill="url(#colorProgress)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Secao 03 - Resumo do Dia */}
      <section id="secao-03">
        <div className="flex items-baseline gap-4 mb-9">
          <span className="text-[11px] font-bold text-accent tracking-[0.1em] font-mono border border-border-accent px-2 py-0.5">02</span>
          <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Resumo do Dia</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hábitos de Hoje */}
          <div className="lg:col-span-2 bg-surface-2 border border-border-subtle p-6">
            <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-6 flex justify-between">
              <span>Hábitos de Hoje</span>
              <span>{habitLogs.length} / {habits.filter(h => {
                const habitDays = h.title.split('|days:')[1] ? h.title.split('|days:')[1].split(',').map(Number) : [0, 1, 2, 3, 4, 5, 6];
                return habitDays.includes(new Date().getDay());
              }).length} CONCLUÍDOS</span>
            </div>
            <div className="space-y-3">
              {habits.filter(h => {
                const habitDays = h.title.split('|days:')[1] ? h.title.split('|days:')[1].split(',').map(Number) : [0, 1, 2, 3, 4, 5, 6];
                return habitDays.includes(new Date().getDay());
              }).length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-text-muted uppercase border border-border-subtle bg-surface">
                  Nenhum hábito para hoje.
                </div>
              ) : (
                habits.filter(h => {
                  const habitDays = h.title.split('|days:')[1] ? h.title.split('|days:')[1].split(',').map(Number) : [0, 1, 2, 3, 4, 5, 6];
                  return habitDays.includes(new Date().getDay());
                }).map(habit => {
                  const isDone = habitLogs.some(l => l.habit_id === habit.id);
                  const displayTitle = habit.title.split('|days:')[0];
                  return (
                    <button
                      key={habit.id}
                      onClick={() => toggleHabit(habit.id)}
                      className={`w-full flex items-center justify-between p-4 border transition-colors ${
                        isDone 
                          ? 'border-success/30 bg-success/5' 
                          : 'border-border-subtle bg-surface hover:border-accent/50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        ) : (
                          <Circle className="w-5 h-5 text-text-muted" />
                        )}
                        <span className={`font-mono text-sm uppercase tracking-[0.05em] ${isDone ? 'text-text-muted line-through' : 'text-text-main'}`}>
                          {displayTitle}
                        </span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold ${isDone ? 'text-success' : 'text-accent'}`}>
                        +{habit.xp_reward} XP
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Status do Dia */}
          <div className="space-y-6">
            {/* XP do Dia */}
            <div className="bg-surface-2 border border-border-subtle p-6">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
                <Target className="w-3 h-3 text-accent" />
                XP HOJE VS META
              </div>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-4xl font-black tracking-[-1px] text-success">+{xpToday}</span>
                <span className="text-sm font-mono text-text-muted mb-1">/ {xpGoal} XP</span>
              </div>
              <div className="h-1.5 w-full bg-surface border border-border-subtle overflow-hidden relative">
                <div className="absolute top-0 left-0 h-full bg-success shadow-glow transition-all duration-500" style={{ width: `${Math.min(100, (xpToday / xpGoal) * 100)}%` }}></div>
              </div>
            </div>

            {/* Streak */}
            <div className="bg-surface-2 border border-border-subtle p-6">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
                <Flame className="w-3 h-3 text-error" />
                STREAK ATUAL
              </div>
              <div className="text-4xl font-black tracking-[-1px] text-error">12 DIAS</div>
              <div className="text-[10px] font-mono text-text-muted mt-2 uppercase">Mantenha o fogo aceso</div>
            </div>

            {/* Próxima Missão */}
            <div className="bg-surface-2 border border-border-subtle p-6">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
                <Crosshair className="w-3 h-3 text-info" />
                PRÓXIMA MISSÃO
              </div>
              <div className="text-sm font-bold uppercase tracking-[0.05em] mb-2">Acordar às 06:00</div>
              <div className="text-[10px] font-mono text-text-muted uppercase">15/21 DIAS CONCLUÍDOS</div>
            </div>
          </div>
        </div>
      </section>

      {/* Secao 04 - Metricas Rapidas */}
      <section id="secao-04">
        <div className="flex items-baseline gap-4 mb-9">
          <span className="text-[11px] font-bold text-accent tracking-[0.1em] font-mono border border-border-accent px-2 py-0.5">03</span>
          <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Métricas Rápidas</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface border border-border-subtle p-6 hover:border-info/50 transition-colors cursor-pointer group">
            <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-4 flex justify-between items-center">
              SALDO ATUAL
              <Wallet className="w-4 h-4 text-info group-hover:scale-110 transition-transform" />
            </div>
            <div className={`text-2xl font-black tracking-[-1px] ${balance >= 0 ? 'text-info' : 'text-error'}`}>
              R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-surface border border-border-subtle p-6 hover:border-error/50 transition-colors cursor-pointer group">
            <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-4 flex justify-between items-center">
              TAREFAS PENDENTES
              <Briefcase className="w-4 h-4 text-error group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-black tracking-[-1px] text-error">
              {pendingTasks.toString().padStart(2, '0')}
            </div>
          </div>

          <div className="bg-surface border border-border-subtle p-6 hover:border-success/50 transition-colors cursor-pointer group">
            <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-4 flex justify-between items-center">
              ADERÊNCIA ROTINA
              <Activity className="w-4 h-4 text-success group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-black tracking-[-1px] text-success">
              {habits.length > 0 ? ((habitLogs.length / habits.length) * 100).toFixed(0) : 0}%
            </div>
          </div>

          <div className="bg-surface border border-border-subtle p-6 hover:border-accent/50 transition-colors cursor-pointer group">
            <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-4 flex justify-between items-center">
              MISSÕES ATIVAS
              <Target className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-black tracking-[-1px] text-accent">04</div>
          </div>
        </div>
      </section>
    </div>
  );
}
