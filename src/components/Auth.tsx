import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthProps {
  onLogin: () => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isSupabaseConfigured) {
      setError('Supabase não configurado. Adicione as variáveis de ambiente.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onLogin();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: name,
            }
          }
        });
        if (error) throw error;
        
        setSuccessMsg('Cadastro realizado! Verifique seu e-mail ou faça login se a confirmação estiver desativada.');
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro na autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text-main flex items-center justify-center relative overflow-hidden font-sans p-4">
      {/* Background effects */}
      <div className="absolute inset-0 z-0 opacity-5 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }}></div>
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_50%,rgba(249,115,22,0.10)_0%,transparent_70%)] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md p-8 bg-surface border border-border-subtle shadow-lg">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-text-muted uppercase mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></div>
          AUTHENTICATION // {isLogin ? 'LOGIN' : 'REGISTER'}
        </div>

        <h1 className="text-[40px] font-black leading-[0.9] tracking-[-1px] uppercase mb-2">
          {isLogin ? 'ACCESS' : 'CREATE'}<br/><span className="text-surface-3">ACCOUNT</span>
        </h1>
        <p className="text-xs text-text-muted font-mono mb-8 border-l-2 border-accent pl-3">
          {isLogin 
            ? 'Insira suas credenciais para acessar o painel de controle EpicLife.' 
            : 'Cadastre-se para iniciar sua jornada de produtividade gamificada.'}
        </p>

        {!isSupabaseConfigured && (
          <div className="mb-6 p-3 bg-error/10 border border-error/30 text-error text-xs font-mono">
            [!] Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas.
          </div>
        )}

        {error && (
          <div className="mb-6 p-3 bg-error/10 border border-error/30 text-error text-xs font-mono">
            [!] {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-3 bg-success/10 border border-success/30 text-success text-xs font-mono">
            [✓] {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-1">Nome de Usuário</label>
              <input 
                type="text" 
                required 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface-2 border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors placeholder:text-text-muted/50 uppercase" 
                placeholder="GUERREIRO_01" 
              />
            </div>
          )}
          <div>
            <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-1">E-mail</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-2 border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors placeholder:text-text-muted/50 uppercase" 
              placeholder="OPERADOR@SISTEMA.COM" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-1">Senha</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-2 border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors placeholder:text-text-muted/50" 
              placeholder="••••••••" 
            />
          </div>

          <div className="pt-4 space-y-3">
            <button type="submit" disabled={loading || !isSupabaseConfigured} className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'PROCESSANDO...' : (isLogin ? 'INICIAR SESSÃO →' : 'REGISTRAR ACESSO →')}
            </button>
            
            <button 
              type="button" 
              onClick={() => onLogin()} 
              className="btn-secondary w-full justify-center border-accent/50 text-accent hover:bg-accent/10"
            >
              [ MODO TESTE: ENTRAR SEM LOGIN ]
            </button>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-border-subtle text-center">
          <button 
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setSuccessMsg(null);
            }} 
            className="text-[11px] font-mono text-text-muted hover:text-accent transition-colors uppercase tracking-[0.05em]"
          >
            {isLogin ? '[ CRIAR NOVA CONTA ]' : '[ JÁ POSSUO ACESSO ]'}
          </button>
        </div>
      </div>
    </div>
  );
}
