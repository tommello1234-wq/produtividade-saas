/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Acoes from './components/Acoes';
import Vendas from './components/Vendas';
import Finances from './components/Finances';
import Levels from './components/Levels';
import Trabalho from './components/Trabalho';
import Academy from './components/Academy';
import Perfil from './components/Perfil';
import SegundoCerebro from './components/SegundoCerebro';
import SaasMetrics from './components/SaasMetrics';
import Auth from './components/Auth';
import SharedMindMapViewer from './components/SharedMindMapViewer';
import { supabase } from './lib/supabase';
import { getShareIdFromUrl } from './lib/share';

export default function App() {
  // Public share viewer: bypasses auth entirely. Computed once on mount.
  const [shareId] = useState<string | null>(() => getShareIdFromUrl());

  const [session, setSession] = useState<any>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('vendas'); // Default to vendas for now to show the user

  useEffect(() => {
    // Skip auth setup entirely when in public-share mode
    if (shareId) return;

    // Verificar sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Escutar mudanças na autenticação (login, logout, etc)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [shareId]);

  // Short-circuit: if there's a share id in the URL, render the public viewer
  // and skip all auth/session UI below.
  if (shareId) {
    return <SharedMindMapViewer shareId={shareId} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-accent font-mono text-xs animate-pulse">INICIALIZANDO SISTEMA...</div>
      </div>
    );
  }

  if (!session && !isTestMode) {
    return <Auth onLogin={() => setIsTestMode(true)} />;
  }

  const handleLogout = async () => {
    setIsTestMode(false);
    await supabase.auth.signOut();
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      onLogout={handleLogout}
    >
      {activeTab === 'dashboard' && <Dashboard />}
      {activeTab === 'acoes' && <Acoes />}
      {activeTab === 'vendas' && <Vendas />}
      {activeTab === 'tesouro' && <Finances />}
      {activeTab === 'niveis' && <Levels />}
      {activeTab === 'trabalho' && <Trabalho />}
      {activeTab === 'academy' && <Academy />}
      {activeTab === 'perfil' && <Perfil />}
      {activeTab === 'segundo-cerebro' && <SegundoCerebro />}
      {activeTab === 'gravyx' && <SaasMetrics />}
    </Layout>
  );
}
