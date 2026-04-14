import React, { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { JarvisChat } from './JarvisChat';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

export default function Layout({ children, activeTab, setActiveTab, onLogout }: LayoutProps) {
  const [totalXp, setTotalXp] = useState(0);
  const [balance, setBalance] = useState(0);
  const [levelId, setLevelId] = useState(1);

  const tabs = [
    { id: 'dashboard', label: 'OVERVIEW' },
    { id: 'acoes', label: 'AÇÕES' },
    { id: 'vendas', label: 'VENDAS' },
    { id: 'tesouro', label: 'TESOURO' },
    { id: 'niveis', label: 'NÍVEIS' },
    { id: 'trabalho', label: 'TRABALHO' },
    { id: 'academy', label: 'ACADEMY' },
    { id: 'perfil', label: 'PERFIL' },
    { id: 'segundo-cerebro', label: 'SEGUNDO CÉREBRO' },
  ];

  useEffect(() => {
    fetchGlobalMetrics();

    // Set up a simple interval to refresh metrics every 10 seconds
    // (A more robust solution would use Supabase Realtime subscriptions)
    const interval = setInterval(fetchGlobalMetrics, 10000);
    
    const handleRefresh = () => fetchGlobalMetrics();
    window.addEventListener('app_data_changed', handleRefresh);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('app_data_changed', handleRefresh);
    };
  }, []);

  const fetchGlobalMetrics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch Profile (XP and Level)
      const { data: profile } = await supabase
        .from('profiles')
        .select('total_xp, level_id')
        .eq('id', user.id)
        .single();

      if (profile) {
        setTotalXp(profile.total_xp || 0);
        setLevelId(profile.level_id || 1);
      }

      // Fetch Transactions (Balance)
      const { data: transactions } = await supabase
        .from('financial_transactions')
        .select('amount')
        .eq('user_id', user.id);

      if (transactions) {
        const currentBalance = transactions.reduce((acc, curr) => acc + Number(curr.amount), 0);
        setBalance(currentBalance);
      }
    } catch (error) {
      console.error('Error fetching global metrics:', error);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text-main font-sans selection:bg-accent/30 flex flex-col">
      {/* Header Fixo no Topo */}
      <header className="h-16 border-b border-border-subtle bg-bg/95 backdrop-blur flex items-center justify-between px-6 fixed top-0 w-full z-50">
        <div className="flex items-center gap-8 h-full">
          <div className="font-black text-2xl tracking-tighter">EPIC <span className="text-accent">LIFE</span></div>
          
          <nav className="hidden xl:flex h-full">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 h-full flex items-center text-[11px] font-mono tracking-[0.1em] uppercase transition-colors border-b-2 ${
                  activeTab === tab.id ? 'text-accent border-accent bg-accent/5' : 'text-text-muted border-transparent hover:text-text-main hover:bg-surface'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-6">
          {/* Métricas Globais */}
          <div className="hidden md:flex items-center gap-6 font-mono text-xs">
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-text-muted tracking-[0.1em]">XP TOTAL</span>
              <span className="text-success font-bold">{totalXp.toLocaleString('pt-BR')} XP</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-text-muted tracking-[0.1em]">SALDO</span>
              <span className={balance >= 0 ? 'text-info font-bold' : 'text-error font-bold'}>
                R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex flex-col items-end border-l border-border-subtle pl-6">
              <span className="text-[9px] text-text-muted tracking-[0.1em]">LVL {levelId.toString().padStart(2, '0')}</span>
              <span className="text-accent font-bold">NÍVEL ATUAL</span>
            </div>
          </div>
          
          <button onClick={onLogout} className="text-text-muted hover:text-error transition-colors ml-4" title="Sair do Sistema">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 pt-16">
        {/* Sidebar Esquerda (Indicadores de Seção) */}
        <aside className="w-16 fixed left-0 top-16 bottom-0 border-r border-border-subtle bg-bg/50 flex-col items-center py-8 gap-4 z-40 hidden md:flex">
          {['01', '02', '03', '04'].map((num, i) => (
            <div 
              key={num} 
              className={`w-8 h-8 flex items-center justify-center font-mono text-[10px] font-bold cursor-pointer transition-all ${
                i === 0 ? 'bg-accent text-black shadow-glow scale-110' : 'text-text-muted hover:text-text-main border border-border-subtle hover:border-accent/50'
              }`}
            >
              {num}
            </div>
          ))}
        </aside>

        {/* Navegação Mobile (Aparece apenas em telas pequenas) */}
        <div className="xl:hidden fixed bottom-0 left-0 right-0 border-t border-border-subtle bg-bg z-50 overflow-x-auto flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-4 shrink-0 text-[10px] font-mono tracking-[0.1em] uppercase transition-colors border-t-2 ${
                activeTab === tab.id ? 'text-accent border-accent bg-accent/5' : 'text-text-muted border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conteúdo Principal */}
        <main className="flex-1 md:ml-16 pb-20 xl:pb-0 min-h-screen">
          <div className="max-w-7xl mx-auto p-4 md:p-8">
            {children}
          </div>
        </main>
        <JarvisChat />
      </div>
    </div>
  );
}
