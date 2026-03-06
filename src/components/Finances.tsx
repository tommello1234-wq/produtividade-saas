import React, { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Plus, Wallet, TrendingUp, Target, Coins, Activity, Calendar, DollarSign, X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

type SubTab = 'overview' | 'transactions' | 'patrimony' | 'treasures';

interface Transaction {
  id: string;
  description: string;
  category: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
}

interface Asset {
  id: string;
  ticker: string;
  name: string;
  type: string;
  qtd: number;
  pm: number;
  cotacao: number;
  color: string;
}

interface Treasure {
  id: string;
  title: string;
  target: number;
  current: number;
  deadline: string;
  status: 'active' | 'achieved';
  achieved_at?: string;
  xp?: number;
}

export default function Finances() {
  const [activeTab, setActiveTab] = useState<SubTab>('overview');
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isTreasureModalOpen, setIsTreasureModalOpen] = useState(false);

  // Data state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [treasures, setTreasures] = useState<Treasure[]>([]);

  // Form states - Transaction
  const [txType, setTxType] = useState<'income'|'expense'>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [txCategory, setTxCategory] = useState('Outros');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);

  // Form states - Asset
  const [assetTicker, setAssetTicker] = useState('');
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState('Ação');
  const [assetQtd, setAssetQtd] = useState('');
  const [assetPm, setAssetPm] = useState('');
  const [assetCotacao, setAssetCotacao] = useState('');

  // Form states - Treasure
  const [treasureTitle, setTreasureTitle] = useState('');
  const [treasureTarget, setTreasureTarget] = useState('');
  const [treasureCurrent, setTreasureCurrent] = useState('');
  const [treasureDeadline, setTreasureDeadline] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [txRes, assetsRes, treasuresRes] = await Promise.all([
        supabase.from('financial_transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('financial_assets').select('*').eq('user_id', user.id),
        supabase.from('financial_treasures').select('*').eq('user_id', user.id)
      ]);

      if (txRes.data) setTransactions(txRes.data);
      if (assetsRes.data) setAssets(assetsRes.data);
      if (treasuresRes.data) setTreasures(treasuresRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || !txDesc) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Você está no Modo Teste. Faça login para salvar dados no banco.');
        return;
      }

      const amount = parseFloat(txAmount);
      const newTx = {
        user_id: user.id,
        description: txDesc,
        category: txCategory,
        amount: txType === 'expense' ? -Math.abs(amount) : Math.abs(amount),
        type: txType,
        date: txDate
      };

      const { data, error } = await supabase
        .from('financial_transactions')
        .insert([newTx])
        .select()
        .single();

      if (error) throw error;

      setTransactions([data, ...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      
      setIsTxModalOpen(false);
      setTxAmount('');
      setTxDesc('');
      setTxCategory('Outros');
      setTxDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Erro ao adicionar transação.');
    }
  };

  const handleDeleteTx = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
      if (error) throw error;
      setTransactions(transactions.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Você está no Modo Teste. Faça login para salvar dados no banco.');
        return;
      }

      let color = 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      if (assetType === 'FII') color = 'bg-purple-500/20 text-purple-500 border-purple-500/30';
      if (assetType === 'RF') color = 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30';
      if (assetType === 'Crypto') color = 'bg-orange-500/20 text-orange-500 border-orange-500/30';

      const newAsset = {
        user_id: user.id,
        ticker: assetTicker,
        name: assetName,
        type: assetType,
        qtd: parseFloat(assetQtd),
        pm: parseFloat(assetPm),
        cotacao: parseFloat(assetCotacao),
        color
      };

      const { data, error } = await supabase.from('financial_assets').insert([newAsset]).select().single();
      if (error) throw error;

      setAssets([...assets, data]);
      setIsAssetModalOpen(false);
      setAssetTicker(''); setAssetName(''); setAssetQtd(''); setAssetPm(''); setAssetCotacao('');
    } catch (error) {
      console.error('Error adding asset:', error);
      alert('Erro ao adicionar ativo. Verifique se a tabela financial_assets existe.');
    }
  };

  const handleDeleteAsset = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('financial_assets').delete().eq('id', id);
      if (error) throw error;
      setAssets(assets.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting asset:', error);
    }
  };

  const handleAddTreasure = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Você está no Modo Teste. Faça login para salvar dados no banco.');
        return;
      }

      const target = parseFloat(treasureTarget);
      const current = parseFloat(treasureCurrent || '0');
      const status = current >= target ? 'achieved' : 'active';
      const achieved_at = status === 'achieved' ? new Date().toLocaleDateString('pt-BR') : null;
      const xp = status === 'achieved' ? 500 : 0; // Example XP reward

      const newTreasure = {
        user_id: user.id,
        title: treasureTitle,
        target,
        current,
        deadline: treasureDeadline,
        status,
        achieved_at,
        xp
      };

      const { data, error } = await supabase.from('financial_treasures').insert([newTreasure]).select().single();
      if (error) throw error;

      setTreasures([...treasures, data]);
      setIsTreasureModalOpen(false);
      setTreasureTitle(''); setTreasureTarget(''); setTreasureCurrent(''); setTreasureDeadline('');
    } catch (error) {
      console.error('Error adding treasure:', error);
      alert('Erro ao adicionar tesouro. Verifique se a tabela financial_treasures existe.');
    }
  };

  const handleDeleteTreasure = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('financial_treasures').delete().eq('id', id);
      if (error) throw error;
      setTreasures(treasures.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting treasure:', error);
    }
  };

  // --- Calculations ---
  const currentBalance = transactions.reduce((acc, curr) => acc + curr.amount, 0);
  
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const currentMonthTxs = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const monthIncome = currentMonthTxs.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const monthExpense = Math.abs(currentMonthTxs.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0));

  const totalInvested = assets.reduce((acc, curr) => acc + (curr.qtd * curr.cotacao), 0);
  const totalPatrimony = currentBalance + totalInvested;

  // Calculate asset allocation
  const allocationMap = assets.reduce((acc, asset) => {
    const value = asset.qtd * asset.cotacao;
    if (!acc[asset.type]) acc[asset.type] = { name: asset.type, value: 0, color: asset.color.split(' ')[1].replace('text-', '') };
    acc[asset.type].value += value;
    return acc;
  }, {} as Record<string, any>);
  
  const assetAllocation = Object.values(allocationMap).map(a => {
    // Map tailwind colors to hex for Recharts
    let hex = '#3B82F6'; // blue
    if (a.color.includes('purple')) hex = '#8B5CF6';
    if (a.color.includes('emerald')) hex = '#10B981';
    if (a.color.includes('orange')) hex = '#F59E0B';
    return { ...a, color: hex };
  });

  // Mock patrimony history for now
  const patrimonyHistory = [
    { month: 'Out', total: 42000 },
    { month: 'Nov', total: 45500 },
    { month: 'Dez', total: 48200 },
    { month: 'Jan', total: 50100 },
    { month: 'Fev', total: 51800 },
    { month: 'Mar', total: totalPatrimony },
  ];

  const renderOverview = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Cards Topo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-2 border border-border-subtle p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-4">PATRIMÔNIO TOTAL</div>
          <div className="text-4xl font-black tracking-[-1px] mb-2 text-white">
            R$ {totalPatrimony.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-success">
            <ArrowUpRight className="w-3 h-3" />
            <span>+3,2% no mês</span>
          </div>
        </div>
        <div className="bg-surface border border-border-subtle p-6">
          <div className="text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-4">SALDO EM CONTA</div>
          <div className={`text-3xl font-black tracking-[-1px] mb-2 ${currentBalance >= 0 ? 'text-info' : 'text-error'}`}>
            R$ {currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] font-mono text-text-muted uppercase">Disponível para alocação</div>
        </div>
        <div className="bg-surface border border-border-subtle p-6">
          <div className="text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-4">TOTAL INVESTIDO</div>
          <div className="text-3xl font-black tracking-[-1px] mb-2 text-accent">
            R$ {totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-success">
            <ArrowUpRight className="w-3 h-3" />
            <span>+4,1% no mês</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface border border-border-subtle p-6 flex justify-between items-center">
          <div>
            <div className="text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">RECEITAS DO MÊS</div>
            <div className="text-2xl font-black tracking-[-1px] text-success">
              R$ {monthIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <ArrowUpRight className="w-8 h-8 text-success/20" />
        </div>
        <div className="bg-surface border border-border-subtle p-6 flex justify-between items-center">
          <div>
            <div className="text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">DESPESAS DO MÊS</div>
            <div className="text-2xl font-black tracking-[-1px] text-error">
              R$ {monthExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <ArrowDownRight className="w-8 h-8 text-error/20" />
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface-2 border border-border-subtle p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em]">Evolução Patrimonial</div>
            <div className="flex gap-2">
              {['1M', '3M', '6M', '1A'].map(period => (
                <button key={period} className={`text-[9px] font-mono px-2 py-1 border ${period === '6M' ? 'border-accent text-accent bg-accent/10' : 'border-border-subtle text-text-muted hover:border-text-muted'}`}>
                  {period}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={patrimonyHistory} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FF6B00" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" stroke="#A6A6A6" tick={{fill: '#A6A6A6', fontSize: 10, fontFamily: 'monospace'}} axisLine={false} tickLine={false} />
                <YAxis stroke="#A6A6A6" tick={{fill: '#A6A6A6', fontSize: 10, fontFamily: 'monospace'}} tickFormatter={(val) => `R$${val/1000}k`} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', borderColor: 'rgba(255,255,255,0.1)', color: '#FAFAFA', fontSize: '12px', fontFamily: 'monospace' }}
                  formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
                />
                <Area type="monotone" dataKey="total" stroke="#FF6B00" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface-2 border border-border-subtle p-6">
          <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-6">Composição</div>
          <div className="h-48 w-full">
            {assetAllocation.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={assetAllocation} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                    {assetAllocation.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#171717', borderColor: 'rgba(255,255,255,0.1)', color: '#FAFAFA', fontSize: '12px', fontFamily: 'monospace' }}
                    formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs font-mono text-text-muted">Sem investimentos</div>
            )}
          </div>
          <div className="space-y-2 mt-4">
            {assetAllocation.map(asset => (
              <div key={asset.name} className="flex justify-between items-center text-[10px] font-mono uppercase">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: asset.color }}></div>
                  <span className="text-text-muted">{asset.name}</span>
                </div>
                <span className="text-text-main">R$ {asset.value.toLocaleString('pt-BR')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderTransactions = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Fluxo de Caixa</h2>
          <p className="text-xs font-mono text-text-muted mt-1">Histórico de receitas e despesas</p>
        </div>
        <button onClick={() => setIsTxModalOpen(true)} className="btn-primary !bg-accent hover:!bg-accent/80 !text-black flex items-center gap-2">
          <Plus className="w-4 h-4" />
          NOVA TRANSAÇÃO
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface-2 border border-border-subtle">
          <div className="flex border-b border-border-subtle bg-surface-3/50 p-4">
            <div className="w-1/2 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em]">Descrição / Categoria</div>
            <div className="w-1/4 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em]">Data</div>
            <div className="w-1/4 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] text-right">Valor</div>
          </div>
          <div className="divide-y divide-border-subtle max-h-[500px] overflow-y-auto">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-text-muted uppercase">Nenhuma transação registrada.</div>
            ) : (
              transactions.map(t => (
                <div key={t.id} className="flex p-4 items-center hover:bg-surface transition-colors group">
                  <div className="w-1/2 flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${t.type === 'income' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                      {t.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold uppercase tracking-[0.04em] text-text-main group-hover:text-accent transition-colors">{t.description}</div>
                      <div className="text-[10px] font-mono text-text-muted uppercase">{t.category}</div>
                    </div>
                  </div>
                  <div className="w-1/4 text-xs font-mono text-text-muted">
                    {new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                  </div>
                  <div className={`w-1/4 flex items-center justify-end gap-3 text-sm font-mono font-bold ${t.type === 'income' ? 'text-success' : 'text-error'}`}>
                    {t.type === 'income' ? '+' : '-'} R$ {Math.abs(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    <button onClick={() => handleDeleteTx(t.id)} className="text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-surface-2 border border-border-subtle p-6">
            <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-4">Maior Despesa (Mês)</div>
            <div className="text-xl font-black tracking-[-1px] text-error mb-1">
              {(() => {
                const expenses = currentMonthTxs.filter(t => t.type === 'expense');
                if (expenses.length === 0) return 'NENHUMA';
                const max = expenses.reduce((prev, current) => (Math.abs(prev.amount) > Math.abs(current.amount)) ? prev : current);
                return max.description;
              })()}
            </div>
            <div className="text-sm font-mono text-text-muted">
              {(() => {
                const expenses = currentMonthTxs.filter(t => t.type === 'expense');
                if (expenses.length === 0) return 'R$ 0,00';
                const max = expenses.reduce((prev, current) => (Math.abs(prev.amount) > Math.abs(current.amount)) ? prev : current);
                return `R$ ${Math.abs(max.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
              })()}
            </div>
          </div>
          <div className="bg-surface-2 border border-border-subtle p-6">
            <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-4">Média de Gastos Diários</div>
            <div className="text-2xl font-black tracking-[-1px] text-text-main mb-1">
              R$ {(monthExpense / new Date(currentYear, currentMonth + 1, 0).getDate()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] font-mono text-text-muted uppercase">Baseado em {new Date(currentYear, currentMonth + 1, 0).getDate()} dias</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPatrimony = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Carteira de Investimentos</h2>
          <p className="text-xs font-mono text-text-muted mt-1">Ativos, cotações e rentabilidade</p>
        </div>
        <button onClick={() => setIsAssetModalOpen(true)} className="btn-primary !bg-accent hover:!bg-accent/80 !text-black flex items-center gap-2">
          <Plus className="w-4 h-4" />
          ADICIONAR ATIVO
        </button>
      </div>

      <div className="bg-surface-2 border border-border-subtle overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-3/50">
              <th className="p-4 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] font-normal">Ativo</th>
              <th className="p-4 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] font-normal">Tipo</th>
              <th className="p-4 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] font-normal text-right">Qtd</th>
              <th className="p-4 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] font-normal text-right">P. Médio</th>
              <th className="p-4 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] font-normal text-right">Cotação</th>
              <th className="p-4 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] font-normal text-right">Valor Atual</th>
              <th className="p-4 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] font-normal text-right">Var %</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {assets.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-xs font-mono text-text-muted uppercase">Nenhum ativo registrado.</td>
              </tr>
            ) : (
              assets.map(asset => {
                const valorAtual = asset.qtd * asset.cotacao;
                const variacao = asset.pm > 0 ? ((asset.cotacao - asset.pm) / asset.pm) * 100 : 0;
                const isPositive = variacao >= 0;

                return (
                  <tr key={asset.id} className="hover:bg-surface transition-colors group cursor-pointer">
                    <td className="p-4">
                      <div className="font-bold text-sm uppercase text-text-main group-hover:text-accent transition-colors">{asset.ticker}</div>
                      <div className="text-[10px] font-mono text-text-muted">{asset.name}</div>
                    </td>
                    <td className="p-4">
                      <span className={`text-[9px] font-mono px-2 py-1 border uppercase tracking-[0.05em] ${asset.color}`}>
                        {asset.type}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono text-sm text-text-muted">{asset.qtd}</td>
                    <td className="p-4 text-right font-mono text-sm text-text-muted">R$ {asset.pm.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-4 text-right font-mono text-sm text-text-main">R$ {asset.cotacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-4 text-right font-mono text-sm font-bold text-text-main">R$ {valorAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className={`p-4 text-right font-mono text-sm font-bold flex items-center justify-end gap-1 ${isPositive ? 'text-success' : 'text-error'}`}>
                      {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {Math.abs(variacao).toFixed(2)}%
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => handleDeleteAsset(asset.id)} className="text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="bg-surface-3/30 border-t border-border-subtle">
              <td colSpan={5} className="p-4 text-right text-[10px] font-mono text-text-muted uppercase tracking-[0.1em]">TOTAL INVESTIDO:</td>
              <td className="p-4 text-right font-mono text-base font-black text-accent">R$ {totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  const renderTreasures = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Tesouros</h2>
          <p className="text-xs font-mono text-text-muted mt-1">Metas financeiras gamificadas</p>
        </div>
        <button onClick={() => setIsTreasureModalOpen(true)} className="btn-primary !bg-accent hover:!bg-accent/80 !text-black flex items-center gap-2">
          <Plus className="w-4 h-4" />
          NOVO TESOURO
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {treasures.length === 0 ? (
          <div className="col-span-2 p-8 text-center text-xs font-mono text-text-muted uppercase border border-border-subtle bg-surface-2">
            Nenhum tesouro registrado.
          </div>
        ) : (
          treasures.map(treasure => {
            const isAchieved = treasure.status === 'achieved';
            const progress = Math.min(100, (treasure.current / treasure.target) * 100);

            return (
              <div key={treasure.id} className={`border p-6 relative overflow-hidden transition-all group ${isAchieved ? 'bg-success/5 border-success/30' : 'bg-surface-2 border-border-subtle hover:border-accent/50'}`}>
                {isAchieved && (
                  <div className="absolute -right-10 top-6 bg-success text-black text-[9px] font-black uppercase tracking-[0.2em] py-1 px-10 rotate-45 shadow-glow">
                    CONQUISTADO
                  </div>
                )}
                
                <button 
                  onClick={() => handleDeleteTreasure(treasure.id)} 
                  className="absolute top-4 right-4 text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-4 mb-6">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border ${isAchieved ? 'bg-success/20 border-success/50 text-success' : 'bg-surface border-border-subtle text-accent'}`}>
                    <Target className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className={`text-lg font-black uppercase tracking-[-0.5px] pr-6 ${isAchieved ? 'text-success' : 'text-text-main'}`}>{treasure.title}</h3>
                    <div className="text-[10px] font-mono text-text-muted uppercase mt-1">
                      {isAchieved ? `Conquistado em: ${treasure.achieved_at}` : `Prazo: ${treasure.deadline}`}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-text-muted">Progresso</span>
                    <span className={isAchieved ? 'text-success font-bold' : 'text-accent font-bold'}>
                      {treasure.current.toLocaleString('pt-BR')} / {treasure.target.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-surface border border-border-subtle overflow-hidden relative">
                    <div 
                      className={`absolute top-0 left-0 h-full transition-all duration-1000 ${isAchieved ? 'bg-success shadow-[0_0_10px_rgba(76,175,80,0.5)]' : 'bg-accent shadow-[0_0_10px_rgba(255,107,0,0.5)]'}`} 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="text-right text-[10px] font-mono text-text-muted mt-1">
                    {progress.toFixed(1)}%
                  </div>
                </div>

                {isAchieved && treasure.xp && treasure.xp > 0 && (
                  <div className="mt-4 inline-block px-3 py-1 border border-success/30 bg-success/10 text-success text-[10px] font-mono font-bold uppercase tracking-[0.1em]">
                    +{treasure.xp} XP BÔNUS
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  if (loading) {
    return <div className="p-12 text-center font-mono text-text-muted">CARREGANDO DADOS DO SUPABASE...</div>;
  }

  return (
    <div className="space-y-8 pb-12 relative">
      {/* Hero Section */}
      <section className="relative border-b border-border-subtle pb-8">
        <div className="absolute inset-0 z-0 opacity-5 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-text-muted uppercase mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></div>
            FINANCIAL SYSTEM // WEALTH
          </div>
          <h1 className="text-[64px] font-black leading-[0.9] tracking-[-2px] uppercase mb-2">
            TESOURO<br/><span className="text-surface-3">NACIONAL</span>
          </h1>
          <p className="text-[13px] text-text-muted max-w-lg leading-[1.7] font-mono border-l-2 border-accent pl-3">
            Gestão de fluxo de caixa, carteira de investimentos e metas financeiras gamificadas.
          </p>
        </div>
      </section>

      {/* Sub-Navegação Interna */}
      <div className="flex border-b border-border-subtle overflow-x-auto hide-scrollbar">
        {(['overview', 'transactions', 'patrimony', 'treasures'] as SubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-4 text-[11px] font-mono tracking-[0.1em] uppercase transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab 
                ? 'text-accent border-accent bg-accent/5' 
                : 'text-text-muted border-transparent hover:text-text-main hover:bg-surface'
            }`}
          >
            {tab === 'overview' && 'OVERVIEW'}
            {tab === 'transactions' && 'TRANSAÇÕES'}
            {tab === 'patrimony' && 'PATRIMÔNIO'}
            {tab === 'treasures' && 'TESOUROS'}
          </button>
        ))}
      </div>

      {/* Conteúdo da Tab Ativa */}
      <div className="min-h-[500px]">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'transactions' && renderTransactions()}
        {activeTab === 'patrimony' && renderPatrimony()}
        {activeTab === 'treasures' && renderTreasures()}
      </div>

      {/* --- MODALS --- */}
      
      {/* Modal Nova Transação */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-surface-2 border border-border-subtle w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-border-subtle bg-surface-3/50">
              <h3 className="text-sm font-bold uppercase tracking-[0.1em]">Nova Transação</h3>
              <button onClick={() => setIsTxModalOpen(false)} className="text-text-muted hover:text-error transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddTx} className="p-6 space-y-6">
              <div className="flex bg-surface border border-border-subtle p-1">
                <button type="button" onClick={() => setTxType('income')} className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-[0.1em] transition-colors ${txType === 'income' ? 'bg-success/20 text-success font-bold' : 'text-text-muted hover:bg-surface-3'}`}>RECEITA</button>
                <button type="button" onClick={() => setTxType('expense')} className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-[0.1em] transition-colors ${txType === 'expense' ? 'bg-error/20 text-error font-bold' : 'text-text-muted hover:bg-surface-3'}`}>DESPESA</button>
              </div>
              
              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Valor (R$)</label>
                <input type="number" step="0.01" required value={txAmount} onChange={e => setTxAmount(e.target.value)} className="w-full bg-surface border border-border-subtle px-4 py-3 text-lg font-mono text-text-main focus:outline-none focus:border-accent transition-colors" placeholder="0.00" />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Data</label>
                <input type="date" required value={txDate} onChange={e => setTxDate(e.target.value)} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors uppercase" />
              </div>
              
              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Descrição</label>
                <input type="text" required value={txDesc} onChange={e => setTxDesc(e.target.value)} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors uppercase" placeholder="EX: ALMOÇO" />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Categoria</label>
                <select value={txCategory} onChange={e => setTxCategory(e.target.value)} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors uppercase">
                  <option value="Salário">Salário</option>
                  <option value="Moradia">Moradia</option>
                  <option value="Alimentação">Alimentação</option>
                  <option value="Transporte">Transporte</option>
                  <option value="Investimentos">Investimentos</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <button type="submit" className={`w-full py-4 text-[11px] font-mono font-bold uppercase tracking-[0.1em] transition-colors ${txType === 'income' ? 'bg-success hover:bg-success/80 text-black' : 'bg-error hover:bg-error/80 text-black'}`}>
                REGISTRAR {txType === 'income' ? 'RECEITA' : 'DESPESA'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Adicionar Ativo */}
      {isAssetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-surface-2 border border-border-subtle w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-border-subtle bg-surface-3/50">
              <h3 className="text-sm font-bold uppercase tracking-[0.1em]">Adicionar Ativo</h3>
              <button onClick={() => setIsAssetModalOpen(false)} className="text-text-muted hover:text-error transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddAsset} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Ticker / Código</label>
                <input type="text" required value={assetTicker} onChange={e => setAssetTicker(e.target.value.toUpperCase())} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors uppercase" placeholder="EX: PETR4" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Nome do Ativo</label>
                <input type="text" required value={assetName} onChange={e => setAssetName(e.target.value)} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors" placeholder="Petrobras PN" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Tipo</label>
                <select value={assetType} onChange={e => setAssetType(e.target.value)} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors uppercase">
                  <option value="Ação">Ação</option>
                  <option value="FII">Fundo Imobiliário (FII)</option>
                  <option value="RF">Renda Fixa</option>
                  <option value="Crypto">Criptomoeda</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Quantidade</label>
                  <input type="number" step="0.0001" required value={assetQtd} onChange={e => setAssetQtd(e.target.value)} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors" placeholder="0" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Preço Médio (R$)</label>
                  <input type="number" step="0.01" required value={assetPm} onChange={e => setAssetPm(e.target.value)} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors" placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Cotação Atual (R$)</label>
                <input type="number" step="0.01" required value={assetCotacao} onChange={e => setAssetCotacao(e.target.value)} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors" placeholder="0.00" />
              </div>
              <button type="submit" className="w-full py-4 text-[11px] font-mono font-bold uppercase tracking-[0.1em] transition-colors bg-accent hover:bg-accent/80 text-black mt-4">
                SALVAR ATIVO
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Tesouro */}
      {isTreasureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-surface-2 border border-border-subtle w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-border-subtle bg-surface-3/50">
              <h3 className="text-sm font-bold uppercase tracking-[0.1em]">Novo Tesouro</h3>
              <button onClick={() => setIsTreasureModalOpen(false)} className="text-text-muted hover:text-error transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddTreasure} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Título do Tesouro (Meta)</label>
                <input type="text" required value={treasureTitle} onChange={e => setTreasureTitle(e.target.value)} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors uppercase" placeholder="EX: RESERVA DE EMERGÊNCIA" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Alvo (R$ ou Qtd)</label>
                  <input type="number" step="0.01" required value={treasureTarget} onChange={e => setTreasureTarget(e.target.value)} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors" placeholder="15000" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Atual (Opcional)</label>
                  <input type="number" step="0.01" value={treasureCurrent} onChange={e => setTreasureCurrent(e.target.value)} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Prazo (Texto)</label>
                <input type="text" required value={treasureDeadline} onChange={e => setTreasureDeadline(e.target.value)} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors uppercase" placeholder="EX: DEZEMBRO 2026" />
              </div>
              <button type="submit" className="w-full py-4 text-[11px] font-mono font-bold uppercase tracking-[0.1em] transition-colors bg-accent hover:bg-accent/80 text-black mt-4">
                CRIAR TESOURO
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
