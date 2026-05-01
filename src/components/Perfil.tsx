import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Bell, Moon, Sun, Globe, LogOut, Trophy, Star, Activity, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Levels from './Levels';

const LEVELS_DATA = [
  { level: 1, title: 'Despertar', xpRequired: 0 },
  { level: 2, title: 'Iniciado', xpRequired: 500 },
  { level: 3, title: 'Aprendiz', xpRequired: 1200 },
  { level: 4, title: 'Focado', xpRequired: 2500 },
  { level: 5, title: 'Disciplinado', xpRequired: 4500 },
  { level: 6, title: 'Guerreiro', xpRequired: 7500 },
  { level: 7, title: 'Especialista', xpRequired: 12000 },
  { level: 8, title: 'Veterano', xpRequired: 18000 },
  { level: 9, title: 'Elite', xpRequired: 26000 },
  { level: 10, title: 'Mestre', xpRequired: 36000 },
  { level: 11, title: 'Grão-Mestre', xpRequired: 50000 },
  { level: 12, title: 'Implacável', xpRequired: 68000 },
  { level: 13, title: 'Titã', xpRequired: 90000 },
  { level: 14, title: 'Lenda', xpRequired: 120000 },
  { level: 15, title: 'Mito', xpRequired: 160000 },
  { level: 16, title: 'Ascendente', xpRequired: 210000 },
  { level: 17, title: 'Iluminado', xpRequired: 280000 },
  { level: 18, title: 'Soberano', xpRequired: 370000 },
  { level: 19, title: 'Imortal', xpRequired: 480000 },
  { level: 20, title: 'Ápice', xpRequired: 600000 },
];

export default function Perfil() {
  const [userEmail, setUserEmail] = useState<string>('');
  const [totalXp, setTotalXp] = useState(0);
  const [currentLevelId, setCurrentLevelId] = useState(1);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'perfil' | 'niveis'>('perfil');

  // Settings states (UI only for now)
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUserEmail('usuario@teste.com');
        setLoading(false);
        return;
      }

      setUserEmail(user.email || '');

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
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const currentLevel = LEVELS_DATA.find(l => l.level === currentLevelId) || LEVELS_DATA[0];
  const nextLevel = LEVELS_DATA.find(l => l.level === currentLevelId + 1);
  
  const xpForCurrentLevel = currentLevel.xpRequired;
  const xpForNextLevel = nextLevel ? nextLevel.xpRequired : currentLevel.xpRequired;
  const xpProgress = nextLevel 
    ? ((totalXp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100 
    : 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-accent font-mono text-xs animate-pulse">CARREGANDO PERFIL...</div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-12 animate-in fade-in duration-500">
      <section className="relative border-b border-border-subtle pb-12 mb-12">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-text-muted uppercase mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
            USER SYSTEM // PROFILE
          </div>
          <h1 className="text-[64px] font-black leading-[0.9] tracking-[-2px] uppercase mb-2">
            USER<br/><span className="text-surface-3">PROFILE</span>
          </h1>
        </div>
      </section>

      {/* Sub-tabs (Perfil | Níveis) — segue o padrão da aba Vendas */}
      <div className="flex border-b border-border-subtle -mt-12 mb-8 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setSubTab('perfil')}
          className={`px-6 py-4 text-[11px] font-mono tracking-[0.1em] uppercase transition-colors border-b-2 whitespace-nowrap ${
            subTab === 'perfil'
              ? 'text-accent border-accent bg-accent/5'
              : 'text-text-muted border-transparent hover:text-text-main hover:bg-surface'
          }`}
        >
          PERFIL
        </button>
        <button
          onClick={() => setSubTab('niveis')}
          className={`px-6 py-4 text-[11px] font-mono tracking-[0.1em] uppercase transition-colors border-b-2 whitespace-nowrap ${
            subTab === 'niveis'
              ? 'text-accent border-accent bg-accent/5'
              : 'text-text-muted border-transparent hover:text-text-main hover:bg-surface'
          }`}
        >
          NÍVEIS
        </button>
      </div>

      {subTab === 'niveis' && (
        <div className="animate-in fade-in duration-300">
          <Levels />
        </div>
      )}

      {subTab === 'perfil' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
        {/* Left Column: User Card & Stats */}
        <div className="lg:col-span-1 space-y-8">
          {/* User Card */}
          <div className="bg-surface-2 border border-border-subtle p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-accent/20"></div>
            
            <div className="w-24 h-24 mx-auto bg-surface-3 rounded-full flex items-center justify-center mb-6 border-4 border-surface-2 shadow-xl relative">
              <User className="w-10 h-10 text-text-muted" />
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-accent rounded-full flex items-center justify-center text-black font-black text-xs border-2 border-surface-2">
                {currentLevelId}
              </div>
            </div>
            
            <h2 className="text-xl font-black uppercase tracking-tight mb-1 truncate px-4">
              {userEmail.split('@')[0]}
            </h2>
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-text-muted mb-6">
              <Mail className="w-3 h-3" />
              <span className="truncate">{userEmail}</span>
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-3 rounded-full text-xs font-mono uppercase tracking-[0.1em] text-accent">
              <Trophy className="w-4 h-4" />
              {currentLevel.title}
            </div>
          </div>

          {/* Life Score Stats */}
          <div className="bg-surface-2 border border-border-subtle p-6">
            <h3 className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-6 flex items-center gap-2">
              <Activity className="w-3 h-3" />
              Life Score
            </h3>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs font-mono mb-2">
                  <span className="text-text-muted uppercase">Progresso do Nível</span>
                  <span className="text-accent">{Math.floor(xpProgress)}%</span>
                </div>
                <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent transition-all duration-1000"
                    style={{ width: `${Math.min(100, Math.max(0, xpProgress))}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-text-muted mt-2">
                  <span>{totalXp.toLocaleString('pt-BR')} XP</span>
                  <span>{nextLevel ? `${nextLevel.xpRequired.toLocaleString('pt-BR')} XP` : 'MÁX'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-subtle">
                <div>
                  <div className="text-[10px] font-mono text-text-muted uppercase mb-1">Total XP</div>
                  <div className="text-xl font-black text-text-main flex items-center gap-2">
                    <Star className="w-4 h-4 text-accent" />
                    {totalXp.toLocaleString('pt-BR')}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-text-muted uppercase mb-1">Nível Atual</div>
                  <div className="text-xl font-black text-text-main flex items-center gap-2">
                    <Shield className="w-4 h-4 text-accent" />
                    {currentLevelId}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Settings */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-surface-2 border border-border-subtle">
            <div className="p-6 border-b border-border-subtle">
              <h3 className="text-sm font-bold uppercase tracking-[0.1em]">Configurações do Sistema</h3>
              <p className="text-xs font-mono text-text-muted mt-1">Preferências e ajustes da interface</p>
            </div>
            
            <div className="divide-y divide-border-subtle">
              {/* Theme Toggle */}
              <div className="p-6 flex items-center justify-between hover:bg-surface transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center text-text-main">
                    {darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="text-sm font-bold uppercase tracking-[0.05em]">Modo Escuro</div>
                    <div className="text-xs font-mono text-text-muted">Aparência da interface</div>
                  </div>
                </div>
                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${darkMode ? 'bg-accent' : 'bg-surface-3'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-black absolute top-1 transition-all ${darkMode ? 'left-7' : 'left-1 bg-text-muted'}`}></div>
                </button>
              </div>

              {/* Notifications Toggle */}
              <div className="p-6 flex items-center justify-between hover:bg-surface transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center text-text-main">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold uppercase tracking-[0.05em]">Notificações</div>
                    <div className="text-xs font-mono text-text-muted">Avisos de missões e metas</div>
                  </div>
                </div>
                <button 
                  onClick={() => setNotifications(!notifications)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${notifications ? 'bg-accent' : 'bg-surface-3'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-black absolute top-1 transition-all ${notifications ? 'left-7' : 'left-1 bg-text-muted'}`}></div>
                </button>
              </div>

              {/* Sound Effects Toggle */}
              <div className="p-6 flex items-center justify-between hover:bg-surface transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center text-text-main">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold uppercase tracking-[0.05em]">Efeitos Sonoros</div>
                    <div className="text-xs font-mono text-text-muted">Sons ao completar tarefas</div>
                  </div>
                </div>
                <button 
                  onClick={() => setSoundEffects(!soundEffects)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${soundEffects ? 'bg-accent' : 'bg-surface-3'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-black absolute top-1 transition-all ${soundEffects ? 'left-7' : 'left-1 bg-text-muted'}`}></div>
                </button>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-surface-2 border border-error/30 p-6">
            <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-error mb-4">Zona de Perigo</h3>
            <p className="text-xs font-mono text-text-muted mb-6">
              Encerrar a sessão atual no dispositivo. Você precisará fazer login novamente para acessar seus dados.
            </p>
            <button 
              onClick={handleLogout}
              className="w-full sm:w-auto px-8 py-4 bg-error/10 hover:bg-error text-error hover:text-black text-xs font-mono font-bold uppercase tracking-[0.1em] transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair do Sistema
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
