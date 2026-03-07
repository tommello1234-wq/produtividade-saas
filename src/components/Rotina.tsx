import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, Circle, Plus, Activity, Calendar, TrendingUp, AlertTriangle } from 'lucide-react';

interface RoutineBlock {
  id: string;
  startTime: string;
  endTime: string;
  activity: string;
  daysOfWeek: number[]; // 0 = Dom, 1 = Seg, etc.
  xpReward: number;
  completed: boolean;
}

const initialBlocks: RoutineBlock[] = [
  { id: '1', startTime: '06:00', endTime: '06:30', activity: 'Meditação & Alongamento', daysOfWeek: [1, 2, 3, 4, 5], xpReward: 15, completed: true },
  { id: '2', startTime: '06:30', endTime: '07:30', activity: 'Treino de Força', daysOfWeek: [1, 2, 3, 4, 5], xpReward: 30, completed: true },
  { id: '3', startTime: '08:00', endTime: '12:00', activity: 'Deep Work (Foco Total)', daysOfWeek: [1, 2, 3, 4, 5], xpReward: 50, completed: false },
  { id: '4', startTime: '13:00', endTime: '18:00', activity: 'Trabalho / Reuniões', daysOfWeek: [1, 2, 3, 4, 5], xpReward: 40, completed: false },
  { id: '5', startTime: '21:00', endTime: '22:00', activity: 'Leitura & Descompressão', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], xpReward: 20, completed: false },
];

const DAYS_OF_WEEK = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export default function Rotina({ hideHeader = false }: { hideHeader?: boolean }) {
  const [blocks, setBlocks] = useState<RoutineBlock[]>(initialBlocks);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Form state
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [activity, setActivity] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Seg-Sex default
  const [xpReward, setXpReward] = useState(20);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Atualiza a cada minuto
    return () => clearInterval(timer);
  }, []);

  const toggleBlock = (id: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, completed: !b.completed } : b));
  };

  const toggleDay = (dayIndex: number) => {
    setSelectedDays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex].sort()
    );
  };

  const handleAddBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startTime || !endTime || !activity || selectedDays.length === 0) return;

    const newBlock: RoutineBlock = {
      id: Date.now().toString(),
      startTime,
      endTime,
      activity,
      daysOfWeek: selectedDays,
      xpReward,
      completed: false
    };

    setBlocks([...blocks, newBlock].sort((a, b) => a.startTime.localeCompare(b.startTime)));
    
    setStartTime('');
    setEndTime('');
    setActivity('');
    setXpReward(20);
  };

  // Pega apenas os blocos de hoje (simulando que hoje é um dia da semana que tem blocos)
  const todayDayOfWeek = currentTime.getDay();
  const todaysBlocks = blocks.filter(b => b.daysOfWeek.includes(todayDayOfWeek)).sort((a, b) => a.startTime.localeCompare(b.startTime));

  const currentHourMinutes = currentTime.getHours().toString().padStart(2, '0') + ':' + currentTime.getMinutes().toString().padStart(2, '0');

  // Estatísticas
  const completedToday = todaysBlocks.filter(b => b.completed).length;
  const totalToday = todaysBlocks.length;
  const adherence = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

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
              <div className="w-1.5 h-1.5 rounded-full bg-info animate-pulse"></div>
              TIME MANAGEMENT // TIMELINE
            </div>
            <h1 className="text-[64px] font-black leading-[0.9] tracking-[-2px] uppercase mb-2">
              DAILY<br/><span className="text-surface-3">ROUTINE</span>
            </h1>
            <p className="text-[13px] text-text-muted max-w-lg leading-[1.7] mb-7 font-mono border-l-2 border-info pl-3">
              Estruture seu dia em blocos de tempo. Cumpra a rotina planejada para maximizar sua eficiência e ganhar XP bônus.
            </p>
          </div>
        </section>
      )}

      {/* Secao 01 - Rotina de Hoje (Timeline) */}
      <section id="secao-01">
        <div className="flex items-baseline gap-4 mb-9">
          <span className="text-[11px] font-bold text-info tracking-[0.1em] font-mono border border-info/30 px-2 py-0.5">01</span>
          <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Rotina de Hoje</h2>
          <span className="text-xs text-text-muted ml-auto font-mono uppercase flex items-center gap-2">
            <Clock className="w-3 h-3 text-info" />
            {currentHourMinutes}
          </span>
        </div>

        <div className="bg-surface-2 border border-border-subtle p-6 md:p-10 relative">
          {/* Linha vertical da timeline */}
          <div className="absolute left-[4.5rem] md:left-[8.5rem] top-10 bottom-10 w-px bg-border-subtle"></div>

          {/* Linha do tempo atual (simulada) */}
          <div className="absolute left-0 right-0 h-px bg-info/50 z-10 flex items-center pointer-events-none" style={{ top: '45%' }}>
            <div className="w-2 h-2 rounded-full bg-info shadow-glow ml-[4.25rem] md:ml-[8.25rem] -translate-x-1/2"></div>
            <span className="text-[10px] font-mono text-info ml-4 bg-surface-2 px-2 py-0.5 border border-info/30">AGORA</span>
          </div>

          <div className="space-y-8 relative z-20">
            {todaysBlocks.map((block, index) => {
              const isPast = block.endTime < currentHourMinutes;
              const isCurrent = block.startTime <= currentHourMinutes && block.endTime >= currentHourMinutes;

              return (
                <div key={block.id} className="flex items-start gap-4 md:gap-8 group">
                  {/* Horário */}
                  <div className="w-12 md:w-24 shrink-0 text-right pt-1">
                    <div className={`text-sm md:text-base font-black tracking-[-0.5px] ${isCurrent ? 'text-info' : 'text-text-main'}`}>
                      {block.startTime}
                    </div>
                    <div className="text-[10px] font-mono text-text-muted">
                      {block.endTime}
                    </div>
                  </div>

                  {/* Marcador na linha */}
                  <div className="relative shrink-0 mt-1.5">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center bg-surface-2 transition-colors ${
                      block.completed 
                        ? 'border-success' 
                        : isCurrent 
                          ? 'border-info shadow-glow' 
                          : isPast 
                            ? 'border-error/50' 
                            : 'border-border-subtle group-hover:border-info/50'
                    }`}>
                      {block.completed && <div className="w-1.5 h-1.5 rounded-full bg-success"></div>}
                      {isCurrent && !block.completed && <div className="w-1.5 h-1.5 rounded-full bg-info animate-pulse"></div>}
                    </div>
                  </div>

                  {/* Card do Bloco */}
                  <div 
                    onClick={() => toggleBlock(block.id)}
                    className={`flex-1 border p-4 cursor-pointer transition-all hover:-translate-y-0.5 ${
                      block.completed 
                        ? 'border-success/30 bg-success/5' 
                        : isCurrent
                          ? 'border-info bg-info/5 shadow-[0_0_15px_rgba(34,211,238,0.1)]'
                          : 'border-border-subtle bg-surface hover:border-info/50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        {block.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                        ) : (
                          <Circle className={`w-5 h-5 shrink-0 ${isPast ? 'text-error/50' : 'text-text-muted'}`} />
                        )}
                        <h3 className={`font-bold text-sm md:text-base uppercase tracking-[0.05em] ${
                          block.completed ? 'text-text-muted line-through' : 'text-text-main'
                        }`}>
                          {block.activity}
                        </h3>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-2 py-1 border ${
                        block.completed ? 'text-success border-success/30 bg-success/10' : 'text-info border-info/30 bg-info/10'
                      }`}>
                        +{block.xpReward} XP
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {todaysBlocks.length === 0 && (
              <div className="text-center py-12 border border-dashed border-border-subtle text-text-muted font-mono text-sm">
                NENHUM BLOCO DE ROTINA CONFIGURADO PARA HOJE.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Secao 02 - Configurar Rotina */}
      <section id="secao-02">
        <div className="flex items-baseline gap-4 mb-6">
          <span className="text-[11px] font-bold text-info tracking-[0.1em] font-mono border border-info/30 px-2 py-0.5">02</span>
          <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Configurar Rotina</h2>
        </div>

        <form onSubmit={handleAddBlock} className="bg-surface-2 border border-border-subtle p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">
            <div className="md:col-span-8 space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Atividade *</label>
                <input 
                  type="text" 
                  required
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-info transition-colors placeholder:text-text-muted/50 uppercase" 
                  placeholder="EX: DEEP WORK (FOCO TOTAL)" 
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Dias da Semana *</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day, index) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(index)}
                      className={`px-3 py-2 text-[10px] font-mono uppercase tracking-[0.1em] border transition-colors ${
                        selectedDays.includes(index)
                          ? 'bg-info/10 border-info/50 text-info'
                          : 'bg-surface border-border-subtle text-text-muted hover:border-text-muted'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="md:col-span-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Início *</label>
                  <input 
                    type="time" 
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-info transition-colors" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Fim *</label>
                  <input 
                    type="time" 
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-info transition-colors" 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">XP Reward *</label>
                <input 
                  type="number" 
                  required
                  min="5"
                  step="5"
                  value={xpReward}
                  onChange={(e) => setXpReward(Number(e.target.value))}
                  className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-info transition-colors" 
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-border-subtle pt-6">
            <button type="submit" className="btn-primary !bg-info hover:!bg-info/80 !text-black flex items-center gap-2">
              <Plus className="w-4 h-4" />
              ADICIONAR BLOCO
            </button>
          </div>
        </form>
      </section>

      {/* Secao 03 - Aderencia */}
      <section id="secao-03">
        <div className="flex items-baseline gap-4 mb-6">
          <span className="text-[11px] font-bold text-info tracking-[0.1em] font-mono border border-info/30 px-2 py-0.5">03</span>
          <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Aderência</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface-2 border border-border-subtle p-6">
            <div className="text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
              <Activity className="w-3 h-3 text-info" />
              CUMPRIMENTO (HOJE)
            </div>
            <div className="flex items-end gap-2 mb-2">
              <div className="text-4xl font-black tracking-[-1px] text-info">{adherence}%</div>
              <div className="text-xs font-mono text-text-muted mb-1">({completedToday}/{totalToday})</div>
            </div>
            <div className="h-1.5 w-full bg-surface border border-border-subtle overflow-hidden relative mt-4">
              <div className="absolute top-0 left-0 h-full bg-info shadow-glow transition-all duration-500" style={{ width: `${adherence}%` }}></div>
            </div>
          </div>

          <div className="bg-surface-2 border border-border-subtle p-6">
            <div className="text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-success" />
              MELHOR DIA
            </div>
            <div className="text-3xl font-black tracking-[-1px] mb-1 text-success">TERÇA-FEIRA</div>
            <div className="text-[10px] font-mono text-text-muted uppercase">92% de aderência média</div>
          </div>

          <div className="bg-surface-2 border border-border-subtle p-6">
            <div className="text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-error" />
              PIOR HORÁRIO
            </div>
            <div className="text-3xl font-black tracking-[-1px] mb-1 text-error">14:00</div>
            <div className="text-[10px] font-mono text-text-muted uppercase">Maior taxa de falha (Pós-almoço)</div>
          </div>
        </div>
      </section>
    </div>
  );
}
