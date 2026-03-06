import React, { useState, useEffect } from 'react';
import { Target, Lock, CheckCircle2, Circle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const LEVELS_DATA = [
  { level: 1, title: 'Despertar', xpRequired: 0, description: 'O início da jornada. Estabelecendo as bases.', requirements: [{ desc: 'Criar conta no sistema', done: true }, { desc: 'Definir os primeiros 3 hábitos', done: true }] },
  { level: 2, title: 'Iniciado', xpRequired: 500, description: 'Primeiros passos rumo à consistência.', requirements: [{ desc: 'Manter 1 hábito perfeito por 7 dias', done: true }, { desc: 'Registrar a primeira receita', done: true }] },
  { level: 3, title: 'Aprendiz', xpRequired: 1200, description: 'Entendendo as regras do jogo da vida.', requirements: [{ desc: 'Ler 1 livro completo', done: true }, { desc: 'Juntar R$ 1.000,00 de saldo', done: true }] },
  { level: 4, title: 'Focado', xpRequired: 2500, description: 'A distração perde força. O foco aumenta.', requirements: [{ desc: 'Acordar no horário por 21 dias', done: false }, { desc: 'Atingir R$ 5.000,00 de saldo', done: false }, { desc: 'Completar 50 missões', done: true }] },
  { level: 5, title: 'Disciplinado', xpRequired: 4500, description: 'A disciplina começa a superar a motivação.', requirements: [{ desc: '3 meses de consistência nos hábitos', done: false }, { desc: 'Investir R$ 10.000,00', done: false }] },
  { level: 6, title: 'Guerreiro', xpRequired: 7500, description: 'Forjando o corpo e a mente.', requirements: [{ desc: 'Treinar 4x na semana por 1 mês', done: false }, { desc: 'Ler 5 livros', done: false }] },
  { level: 7, title: 'Especialista', xpRequired: 12000, description: 'Dominando uma habilidade de alto valor.', requirements: [{ desc: 'Concluir 1 curso técnico/avançado', done: false }, { desc: 'Aumentar a renda mensal em 20%', done: false }] },
  { level: 8, title: 'Veterano', xpRequired: 18000, description: 'A experiência dita as regras.', requirements: [{ desc: '6 meses sem falhar o hábito principal', done: false }, { desc: 'Atingir R$ 50.000,00 de patrimônio', done: false }] },
  { level: 9, title: 'Elite', xpRequired: 26000, description: 'Acima da média. Resultados excepcionais.', requirements: [{ desc: 'Ler 12 livros no ano', done: false }, { desc: 'Completar 500 missões', done: false }] },
  { level: 10, title: 'Mestre', xpRequired: 36000, description: 'Domínio total sobre a própria rotina.', requirements: [{ desc: '1 ano de consistência', done: false }, { desc: 'Atingir R$ 100.000,00 de patrimônio', done: false }] },
  { level: 11, title: 'Grão-Mestre', xpRequired: 50000, description: 'Ensinando pelo exemplo.', requirements: [{ desc: 'Mentor de 1 pessoa', done: false }, { desc: 'Renda passiva cobrindo 20% do custo', done: false }] },
  { level: 12, title: 'Implacável', xpRequired: 68000, description: 'Nada pode parar o seu progresso.', requirements: [{ desc: 'Correr uma meia maratona (21km)', done: false }, { desc: 'Atingir R$ 250.000,00 de patrimônio', done: false }] },
  { level: 13, title: 'Titã', xpRequired: 90000, description: 'Força e resiliência inabaláveis.', requirements: [{ desc: '1000 missões concluídas', done: false }, { desc: 'Ler 30 livros', done: false }] },
  { level: 14, title: 'Lenda', xpRequired: 120000, description: 'Seu nome começa a ser lembrado.', requirements: [{ desc: 'Renda passiva cobrindo 50% do custo', done: false }, { desc: 'Atingir R$ 500.000,00 de patrimônio', done: false }] },
  { level: 15, title: 'Mito', xpRequired: 160000, description: 'Realizações que parecem impossíveis.', requirements: [{ desc: 'Correr uma maratona (42km) ou Ironman', done: false }, { desc: '5 anos de consistência', done: false }] },
  { level: 16, title: 'Ascendente', xpRequired: 210000, description: 'Transcendendo as limitações humanas.', requirements: [{ desc: 'Atingir R$ 1.000.000,00 de patrimônio', done: false }, { desc: 'Fluência em 3 idiomas', done: false }] },
  { level: 17, title: 'Iluminado', xpRequired: 280000, description: 'Paz de espírito e controle absoluto.', requirements: [{ desc: 'Renda passiva cobrindo 100% do custo (Independência)', done: false }, { desc: 'Retiro espiritual/meditação de 10 dias', done: false }] },
  { level: 18, title: 'Soberano', xpRequired: 370000, description: 'O rei do próprio império.', requirements: [{ desc: 'Atingir R$ 5.000.000,00 de patrimônio', done: false }, { desc: 'Impactar 1000 pessoas positivamente', done: false }] },
  { level: 19, title: 'Imortal', xpRequired: 480000, description: 'Seu legado viverá para sempre.', requirements: [{ desc: 'Escrever e publicar um livro', done: false }, { desc: 'Criar uma instituição/projeto social', done: false }] },
  { level: 20, title: 'Ápice', xpRequired: 600000, description: 'O nível máximo da existência humana.', requirements: [{ desc: 'Atingir R$ 10.000.000,00 de patrimônio', done: false }, { desc: 'Domínio completo de Corpo, Mente e Espírito', done: false }] },
];

export default function Levels() {
  const [totalXp, setTotalXp] = useState(0);
  const [currentLevelId, setCurrentLevelId] = useState(1);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('total_xp, level_id')
        .eq('id', user.id)
        .single();

      if (profile) {
        setTotalXp(profile.total_xp || 0);
        setCurrentLevelId(profile.level_id || 1);
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
    }
  };

  const calculateLevelStatus = (levelIndex: number) => {
    const levelData = LEVELS_DATA[levelIndex];
    const nextLevelData = LEVELS_DATA[levelIndex + 1];

    if (totalXp >= levelData.xpRequired && (!nextLevelData || totalXp < nextLevelData.xpRequired)) {
      return 'current';
    } else if (totalXp >= levelData.xpRequired) {
      return 'completed';
    } else {
      return 'locked';
    }
  };

  const calculateProgress = (levelIndex: number) => {
    const levelData = LEVELS_DATA[levelIndex];
    const nextLevelData = LEVELS_DATA[levelIndex + 1];

    if (calculateLevelStatus(levelIndex) === 'current' && nextLevelData) {
      const xpInCurrentLevel = totalXp - levelData.xpRequired;
      const xpNeededForNextLevel = nextLevelData.xpRequired - levelData.xpRequired;
      return Math.min(100, Math.max(0, Math.round((xpInCurrentLevel / xpNeededForNextLevel) * 100)));
    }
    return 0;
  };

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
            Sua vida como um RPG. 20 níveis de evolução. Cumpra metas reais, desenvolva disciplina e acumule XP para desbloquear o próximo estágio da sua evolução.
          </p>
        </div>
      </section>

      <section className="relative">
        {/* Linha vertical conectando os níveis */}
        <div className="absolute left-8 top-0 bottom-0 w-px bg-border-subtle hidden md:block"></div>

        <div className="space-y-8 relative z-10">
          {LEVELS_DATA.map((lvl, index) => {
            const status = calculateLevelStatus(index);
            const isCompleted = status === 'completed';
            const isCurrent = status === 'current';
            const isLocked = status === 'locked';
            const progress = calculateProgress(index);

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
                    
                    <div className="flex flex-col items-end shrink-0">
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
                        <span className="text-accent">{progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-black border border-border-subtle overflow-hidden relative">
                        <div className="absolute top-0 left-0 h-full bg-accent shadow-glow" style={{ width: `${progress}%` }}></div>
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
