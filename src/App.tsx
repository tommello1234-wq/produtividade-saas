/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Tasks from './components/Tasks';
import Finances from './components/Finances';
import Levels from './components/Levels';
import Auth from './components/Auth';
import { supabase } from './lib/supabase';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
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
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-accent font-mono text-xs animate-pulse">INICIALIZANDO SISTEMA...</div>
      </div>
    );
  }

  if (!session) {
    return <Auth onLogin={() => {}} />;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      onLogout={handleLogout}
    >
      {activeTab === 'dashboard' && <Dashboard />}
      {activeTab === 'tasks' && <Tasks />}
      {activeTab === 'finances' && <Finances />}
      {activeTab === 'levels' && <Levels />}
    </Layout>
  );
}
