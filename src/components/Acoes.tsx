import React, { useState } from 'react';
import Habitos from './Habitos';
import Rotina from './Rotina';
import Tasks from './Tasks';

export default function Acoes() {
  const [activeTab, setActiveTab] = useState<'habitos' | 'rotina' | 'missoes'>('habitos');

  return (
    <div className="space-y-8 pb-12">
      <section className="relative border-b border-border-subtle pb-12">
        <div className="absolute inset-0 z-0 opacity-5 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-text-muted uppercase mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></div>
            SYSTEM MODULE // AÇÕES DIÁRIAS
          </div>
          <h1 className="text-[64px] font-black leading-[0.9] tracking-[-2px] uppercase mb-2">
            AÇÕES<br/><span className="text-surface-3">DIÁRIAS</span>
          </h1>
          <p className="text-[13px] text-text-muted max-w-lg leading-[1.7] mb-7 font-mono border-l-2 border-accent pl-3">
            Central de comando para sua produtividade. Gerencie seus hábitos, rotina e missões em um só lugar.
          </p>
        </div>
      </section>

      {/* Navegação de Abas */}
      <div className="flex border-b border-border-subtle mb-8">
        <button
          onClick={() => setActiveTab('habitos')}
          className={`px-8 py-4 text-[11px] font-mono font-bold uppercase tracking-[0.1em] transition-colors relative ${
            activeTab === 'habitos' 
              ? 'text-accent bg-accent/5' 
              : 'text-text-muted hover:text-text-main hover:bg-surface-2'
          }`}
        >
          HÁBITOS
          {activeTab === 'habitos' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('rotina')}
          className={`px-8 py-4 text-[11px] font-mono font-bold uppercase tracking-[0.1em] transition-colors relative ${
            activeTab === 'rotina' 
              ? 'text-accent bg-accent/5' 
              : 'text-text-muted hover:text-text-main hover:bg-surface-2'
          }`}
        >
          ROTINA
          {activeTab === 'rotina' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('missoes')}
          className={`px-8 py-4 text-[11px] font-mono font-bold uppercase tracking-[0.1em] transition-colors relative ${
            activeTab === 'missoes' 
              ? 'text-accent bg-accent/5' 
              : 'text-text-muted hover:text-text-main hover:bg-surface-2'
          }`}
        >
          MISSÕES
          {activeTab === 'missoes' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent"></div>
          )}
        </button>
      </div>

      {/* Conteúdo da Aba */}
      <div className="animate-in fade-in duration-500">
        {activeTab === 'habitos' && <Habitos hideHeader={true} />}
        {activeTab === 'rotina' && <Rotina hideHeader={true} />}
        {activeTab === 'missoes' && <Tasks hideHeader={true} />}
      </div>
    </div>
  );
}
