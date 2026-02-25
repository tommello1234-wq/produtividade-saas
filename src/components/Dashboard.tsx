import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const initialData = [
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

const habitsList = [
  'Estudar',
  'Beber 4L de água',
  'Cardio matinal',
  'Leitura',
  'Treinar',
  'Meditar'
];

const generateHabits = () => {
  const grid: Record<string, boolean[]> = {};
  habitsList.forEach(habit => {
    grid[habit] = Array.from({ length: 14 }, () => Math.random() > 0.5);
  });
  return grid;
};

export default function Dashboard() {
  const [habitGrid, setHabitGrid] = useState(generateHabits());

  const toggleHabit = (habit: string, dayIndex: number) => {
    setHabitGrid(prev => {
      const newGrid = { ...prev };
      newGrid[habit][dayIndex] = !newGrid[habit][dayIndex];
      return newGrid;
    });
  };

  return (
    <div className="space-y-12 pb-12">
      {/* Hero Section */}
      <section className="relative border-b border-border-subtle pb-12 mb-12">
        <div className="absolute inset-0 z-0 opacity-5 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-text-muted uppercase mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
            SYSTEM ONLINE // HABIT TRACKER
          </div>
          <h1 className="text-[64px] font-black leading-[0.9] tracking-[-2px] uppercase mb-2">
            OVERVIEW<br/><span className="text-surface-3">DASHBOARD</span>
          </h1>
          <p className="text-[13px] text-text-muted max-w-lg leading-[1.7] mb-7 font-mono border-l-2 border-accent pl-3">
            Monitoramento de consistência e execução de rotinas. Mantenha os níveis de XP altos para garantir o progresso.
          </p>
          <div className="flex gap-3 items-center flex-wrap">
            <button className="btn-primary">
              INICIAR ROTINA →
            </button>
            <button className="btn-secondary">
              VER RELATÓRIO ⊡
            </button>
          </div>
        </div>
      </section>

      {/* Chart Section */}
      <section>
        <div className="flex items-baseline gap-4 mb-9">
          <span className="text-[11px] font-bold text-accent tracking-[0.1em] font-mono border border-border-accent px-2 py-0.5">01</span>
          <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Progresso Geral</h2>
          <span className="text-xs text-text-muted ml-auto font-mono">// 14 dias</span>
        </div>
        
        <div className="bg-surface-2 border border-border-subtle p-6 rounded-md shadow-md">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={initialData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
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

      {/* Habits Grid Section */}
      <section>
        <div className="flex items-baseline gap-4 mb-9">
          <span className="text-[11px] font-bold text-accent tracking-[0.1em] font-mono border border-border-accent px-2 py-0.5">02</span>
          <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Grade de Hábitos</h2>
          <span className="text-xs text-text-muted ml-auto font-mono">// matriz de execução</span>
        </div>
        
        <div className="bg-surface-2 border border-border-subtle p-6 rounded-md shadow-md overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header */}
            <div className="flex mb-4 border-b border-border-subtle pb-2">
              <div className="w-48 shrink-0 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] flex items-end pb-1">Hábito</div>
              <div className="flex-1 flex justify-between px-2">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center w-8">
                    <span className="text-[10px] font-mono text-text-muted">{i + 1}</span>
                    <span className="text-[9px] text-text-dark uppercase font-mono tracking-[0.05em]">
                      {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][i % 7]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rows */}
            <div className="space-y-1">
              {habitsList.map(habit => (
                <div key={habit} className="flex items-center group hover:bg-surface-3 transition-colors rounded px-1 -mx-1">
                  <div className="w-48 shrink-0 flex items-center py-2">
                    <span className="text-xs font-semibold text-text-main uppercase tracking-[0.04em]">{habit}</span>
                  </div>
                  <div className="flex-1 flex justify-between px-2">
                    {habitGrid[habit].map((isDone, dayIndex) => (
                      <button
                        key={dayIndex}
                        onClick={() => toggleHabit(habit, dayIndex)}
                        className="w-8 h-8 flex items-center justify-center group/btn"
                      >
                        <div className={`w-4 h-4 border transition-all ${
                          isDone 
                            ? 'bg-accent border-accent shadow-glow' 
                            : 'border-border-subtle bg-surface group-hover/btn:border-accent/50'
                        }`}>
                          {isDone && (
                            <svg viewBox="0 0 14 14" fill="none" className="w-full h-full text-black p-0.5">
                              <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"/>
                            </svg>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
