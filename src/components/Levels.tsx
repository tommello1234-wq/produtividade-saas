import React from 'react';
import { Target, Lock, CheckCircle2, Circle } from 'lucide-react';

export default function Levels() {
  const levels = [
    {
      level: 1,
      title: 'Despertar',
      xpRequired: 0,
      status: 'completed',
      description: 'O início da jornada. Estabelecendo as bases da disciplina.',
      requirements: [
        { desc: 'Criar conta no sistema', done: true },
        { desc: 'Definir os primeiros 3 hábitos', done: true },
      ]
    },
    {
      level: 2,
      title: 'Iniciado',
      xpRequired: 1000,
      status: 'completed',
      description: 'Primeiros passos rumo à consistência.',
      requirements: [
        { desc: 'Manter 1 hábito perfeito por 7 dias', done: true },
        { desc: 'Completar 10 missões diárias', done: true },
        { desc: 'Registrar a primeira receita no Tesouro', done: true },
      ]
    },
    {
      level: 3,
      title: 'Focado',
      xpRequired: 3000,
      status: 'completed',
      description: 'A disciplina começa a se tornar automática.',
      requirements: [
        { desc: 'Ler 1 livro completo', done: true },
        { desc: 'Juntar R$ 1.000,00 de saldo', done: true },
        { desc: 'Treinar 15 dias no mês', done: true },
      ]
    },
    {
      level: 4,
      title: 'Guerreiro',
      xpRequired: 6000,
      status: 'current',
      progress: 65,
      description: 'Forjando o corpo e a mente. Onde a maioria desiste, você continua.',
      requirements: [
        { desc: 'Acordar às 06:00 por 21 dias seguidos', done: false },
        { desc: 'Atingir R$ 5.000,00 de saldo', done: false },
        { desc: 'Completar 50 missões no total', done: true },
        { desc: 'Ler 3 livros', done: false },
      ]
    },
    {
      level: 5,
      title: 'Mestre',
      xpRequired: 12000,
      status: 'locked',
      description: 'Domínio total sobre a própria rotina e finanças.',
      requirements: [
        { desc: '6 meses de consistência nos hábitos principais', done: false },
        { desc: 'Atingir R$ 20.000,00 de saldo investido', done: false },
        { desc: 'Completar 200 missões', done: false },
        { desc: 'Correr 10km ou atingir meta física avançada', done: false },
      ]
    }
  ];

  return (
    <div className="space-y-12 pb-12">
      <section className="relative border-b border-border-subtle pb-12 mb-12">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-text-muted uppercase mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-accent"></div>
            SYSTEM PROGRESSION // ROADMAP
          </div>
          <h1 className="text-[64px] font-black leading-[0.9] tracking-[-2px] uppercase mb-2">
            LIFE<br/><span className="text-surface-3">LEVELS</span>
          </h1>
          <p className="text-[13px] text-text-muted max-w-lg leading-[1.7] mb-7 font-mono border-l-2 border-accent pl-3">
            Sua vida como um RPG. Cumpra metas reais, desenvolva disciplina e acumule XP para desbloquear o próximo estágio da sua evolução.
          </p>
        </div>
      </section>

      <section className="relative">
        {/* Linha vertical conectando os níveis */}
        <div className="absolute left-8 top-0 bottom-0 w-px bg-border-subtle hidden md:block"></div>

        <div className="space-y-8 relative z-10">
          {levels.map((lvl) => {
            const isCompleted = lvl.status === 'completed';
            const isCurrent = lvl.status === 'current';
            const isLocked = lvl.status === 'locked';

            return (
              <div 
                key={lvl.level} 
                className={`flex flex-col md:flex-row gap-6 md:gap-12 transition-all ${
                  isLocked ? 'opacity-50 grayscale' : ''
                }`}
              >
                {/* Indicador de Nível (Esquerda) */}
                <div className="flex items-center md:items-start gap-4 md:w-32 shrink-0 bg-bg">
                  <div className={`w-16 h-16 flex flex-col items-center justify-center border shrink-0 ${
                    isCurrent ? 'border-accent bg-accent/10 shadow-glow text-accent' : 
                    isCompleted ? 'border-success bg-success/10 text-success' : 
                    'border-border-subtle bg-surface text-text-muted'
                  }`}>
                    <span className="text-[10px] font-mono tracking-[0.1em] uppercase">LVL</span>
                    <span className="text-2xl font-black">{lvl.level}</span>
                  </div>
                  <div className="md:hidden flex-1">
                    <h3 className="text-xl font-bold uppercase tracking-[-0.5px]">{lvl.title}</h3>
                    <span className="text-[10px] font-mono text-text-muted">{lvl.xpRequired} XP REQ</span>
                  </div>
                </div>

                {/* Card de Conteúdo (Direita) */}
                <div className={`flex-1 border p-6 ${
                  isCurrent ? 'border-accent bg-surface-2' : 
                  'border-border-subtle bg-surface'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="hidden md:block">
                      <h3 className={`text-2xl font-black uppercase tracking-[-1px] mb-1 ${
                        isCurrent ? 'text-accent' : isCompleted ? 'text-success' : 'text-text-main'
                      }`}>
                        {lvl.title}
                      </h3>
                      <p className="text-xs font-mono text-text-muted">{lvl.description}</p>
                    </div>
                    
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-1">Status</span>
                      {isCompleted && <span className="text-xs font-mono font-bold text-success border border-success/30 px-2 py-1">COMPLETED</span>}
                      {isCurrent && <span className="text-xs font-mono font-bold text-accent border border-accent/30 px-2 py-1 animate-pulse">IN PROGRESS</span>}
                      {isLocked && <span className="text-xs font-mono font-bold text-text-muted border border-border-subtle px-2 py-1 flex items-center gap-1"><Lock className="w-3 h-3"/> LOCKED</span>}
                    </div>
                  </div>

                  {/* Barra de Progresso (Apenas Nível Atual) */}
                  {isCurrent && (
                    <div className="mb-6">
                      <div className="flex justify-between text-[10px] font-mono text-text-muted mb-2">
                        <span>PROGRESSO DO NÍVEL</span>
                        <span className="text-accent">{lvl.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-black border border-border-subtle overflow-hidden relative">
                        <div className="absolute top-0 left-0 h-full bg-accent shadow-glow" style={{ width: `${lvl.progress}%` }}></div>
                      </div>
                    </div>
                  )}

                  {/* Requisitos / Metas */}
                  <div>
                    <span className="text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] block mb-3">
                      Objetivos para conclusão:
                    </span>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {lvl.requirements.map((req, idx) => (
                        <div key={idx} className={`flex items-start gap-3 p-3 border ${
                          req.done ? 'border-success/30 bg-success/5' : 'border-border-subtle bg-surface-3/30'
                        }`}>
                          <div className="mt-0.5 shrink-0">
                            {req.done ? (
                              <CheckCircle2 className="w-4 h-4 text-success" />
                            ) : (
                              <Circle className="w-4 h-4 text-text-muted" />
                            )}
                          </div>
                          <span className={`text-xs font-mono leading-relaxed ${
                            req.done ? 'text-text-main' : 'text-text-muted'
                          }`}>
                            {req.desc}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
