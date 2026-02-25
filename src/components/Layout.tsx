import React from 'react';
import { LayoutDashboard, CheckSquare, Wallet, Settings, Target, LogOut } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

export default function Layout({ children, activeTab, setActiveTab, onLogout }: LayoutProps) {
  const navItems = [
    { id: 'dashboard', label: 'Hábitos', icon: LayoutDashboard },
    { id: 'tasks', label: 'Missões', icon: CheckSquare },
    { id: 'finances', label: 'Tesouro', icon: Wallet },
    { id: 'levels', label: 'Níveis', icon: Target },
  ];

  return (
    <div className="min-h-screen bg-bg text-text-main flex font-sans">
      {/* Sidebar */}
      <aside className="w-11 border-r border-border-subtle bg-surface flex flex-col items-center py-4 shrink-0 z-50 relative">
        <nav className="flex-1 flex flex-col gap-0.5 w-full items-center">
          {navItems.map((item, index) => {
            const isActive = activeTab === item.id;
            return (
               <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={item.label}
                className={`w-7 h-7 flex items-center justify-center border text-[10px] font-bold transition-all tracking-[0.05em] ${
                  isActive 
                    ? 'border-accent text-accent bg-accent/10' 
                    : 'border-border-subtle text-text-muted hover:border-accent hover:text-accent hover:bg-accent/10'
                }`}
              >
                0{index + 1}
              </button>
            );
          })}
        </nav>

        <div className="w-px flex-1 bg-border-subtle my-2 max-h-12"></div>

        <button 
          onClick={onLogout}
          title="Sair do Sistema"
          className="w-7 h-7 flex items-center justify-center border border-border-subtle text-text-muted hover:border-error hover:text-error hover:bg-error/10 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Topbar */}
        <header className="h-14 border-b border-border-subtle bg-black/85 backdrop-blur-md flex items-center justify-between shrink-0 z-40 relative">
          <div className="flex items-center h-full">
            <div className="text-base font-black tracking-[-0.5px] text-text-main border-r border-border-subtle px-5 h-full flex items-center gap-2 uppercase">
              Epic<span className="text-accent">Life</span>
            </div>
            <nav className="hidden md:flex items-center h-full">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-5 h-full flex items-center text-xs font-medium tracking-[0.06em] uppercase border-r border-border-subtle transition-colors ${
                    activeTab === item.id ? 'text-text-main bg-surface-2' : 'text-text-muted hover:text-text-main hover:bg-surface'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          
          <div className="flex items-center h-full">
            {/* Stats */}
            <div className="hidden lg:flex items-center h-full border-l border-border-subtle">
              <div className="px-5 h-full flex flex-col justify-center border-r border-border-subtle">
                <span className="text-[9px] font-mono text-text-muted uppercase tracking-[0.1em] mb-0.5">XP Hoje</span>
                <span className="text-xs font-mono font-bold text-success">+450 XP</span>
              </div>
              <div className="px-5 h-full flex flex-col justify-center border-r border-border-subtle">
                <span className="text-[9px] font-mono text-text-muted uppercase tracking-[0.1em] mb-0.5">Saldo</span>
                <span className="text-xs font-mono font-bold text-text-main">R$ 2.450,00</span>
              </div>
            </div>

            {/* Level & Progress */}
            <div className="flex items-center h-full px-5 gap-4 bg-surface-2 border-l border-border-subtle">
              <div className="flex flex-col items-end">
                <span className="text-[11px] font-mono font-bold text-accent tracking-[0.1em]">LVL 04</span>
                <span className="text-[9px] font-mono text-text-muted uppercase tracking-[0.05em]">Guerreiro</span>
              </div>
              <div className="w-24 h-1.5 bg-black border border-border-subtle relative overflow-hidden">
                <div className="absolute top-0 left-0 h-full bg-accent w-[65%] shadow-glow"></div>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto p-10">
          <div className="max-w-[960px] mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
