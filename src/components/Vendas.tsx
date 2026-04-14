import React, { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DollarSign, Calendar, TrendingUp, Activity, Filter, Plus, X, Trash2, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Transaction {
  id: string;
  description: string;
  category: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
}

export default function Vendas() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | '90d' | 'this_month' | 'last_month'>('30d');
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  
  // New state for Empresa tabs
  const [activeTab, setActiveTab] = useState<'receitas' | 'despesas'>('receitas');
  
  // New state for Manual Expenses
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseCategory, setExpenseCategory] = useState('Software|#60A5FA');
  const [isExpenseRecurring, setIsExpenseRecurring] = useState(false);
  const [expenseSubItems, setExpenseSubItems] = useState<{desc: string, amount: string, date: string}[]>([]);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  // New state for Manual Income
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [incomeDesc, setIncomeDesc] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeDate, setIncomeDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [incomeToDelete, setIncomeToDelete] = useState<string | null>(null);

  // Sync state
  const [isSyncingAsaas, setIsSyncingAsaas] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const toggleProduct = (productName: string) => {
    setExpandedProducts(prev => ({ ...prev, [productName]: !prev[productName] }));
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id);
    });
    fetchData();
  }, []);

  const handleSync = async () => {
    if (!userId) return;
    setIsSyncingAsaas(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/asaas/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.error) {
        setSyncMessage({ type: 'error', text: data.error });
      } else if (data.count === 0) {
        setSyncMessage({ type: 'info', text: data.message || 'Nenhuma nova venda importada.' });
      } else {
        setSyncMessage({ type: 'success', text: `Sincronização concluída! ${data.count} novas vendas importadas.` });
        fetchData(); // refresh transactions
      }
    } catch (e) {
      setSyncMessage({ type: 'error', text: 'Erro ao sincronizar com o Asaas.' });
    } finally {
      setIsSyncingAsaas(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;
      
      const allTxs = (data || []).filter(tx => 
        tx.description.includes('[Asaas]') || 
        tx.description.includes('[CNPJ]') || 
        tx.description.includes('[Receita]')
      );
      
      // Auto-generate recurring CNPJ transactions for current month
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const cnpjTxs = allTxs.filter(t => t.description.includes('[CNPJ]'));
      const latestByDesc = new Map<string, Transaction>();
      
      cnpjTxs.forEach(t => {
        const existing = latestByDesc.get(t.description);
        if (!existing || new Date(t.date) > new Date(existing.date)) {
          latestByDesc.set(t.description, t);
        }
      });

      const newTransactionsToInsert: any[] = [];

      latestByDesc.forEach(tx => {
        if (tx.category.endsWith('|recurring')) {
          const txDate = new Date(tx.date);
          if (txDate.getFullYear() < currentYear || (txDate.getFullYear() === currentYear && txDate.getMonth() < currentMonth)) {
            const hasCurrentMonthTx = cnpjTxs.some(t => {
              const d = new Date(t.date);
              return t.description === tx.description && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            });

            if (!hasCurrentMonthTx) {
              const newDate = new Date(currentYear, currentMonth, txDate.getDate());
              if (newDate.getMonth() !== currentMonth) {
                newDate.setDate(0);
              }

              newTransactionsToInsert.push({
                user_id: user.id,
                description: tx.description,
                category: tx.category,
                amount: tx.amount,
                type: tx.type,
                date: newDate.toISOString().split('T')[0]
              });
            }
          }
        }
      });

      if (newTransactionsToInsert.length > 0) {
        const { data: insertedData, error: insertError } = await supabase
          .from('financial_transactions')
          .insert(newTransactionsToInsert)
          .select();
          
        if (!insertError && insertedData) {
          setTransactions([...insertedData, ...allTxs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
          setLoading(false);
          return;
        }
      }

      setTransactions(allTxs);
    } catch (error) {
      console.error('Error fetching company data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditExpense = (tx: Transaction) => {
    setEditingExpenseId(tx.id);
    
    let cleanDesc = tx.description.replace('[CNPJ] ', '');
    setExpenseDesc(cleanDesc);
    setExpenseAmount(Math.abs(tx.amount).toString());
    setExpenseDate(tx.date.split('T')[0]);
    
    let cat = tx.category;
    if (cat.endsWith('|recurring')) {
      setIsExpenseRecurring(true);
      cat = cat.replace('|recurring', '');
    } else {
      setIsExpenseRecurring(false);
    }
    setExpenseCategory(cat);
    
    setExpenseSubItems([]); // Disable sub-items when editing
    setIsExpenseModalOpen(true);
  };

  const handleAddSubItem = (group: { name: string, category: string }) => {
    setEditingExpenseId(null);
    setExpenseDesc(group.name);
    
    let cat = group.category;
    if (cat.endsWith('|recurring')) {
      setIsExpenseRecurring(true);
      cat = cat.replace('|recurring', '');
    } else {
      setIsExpenseRecurring(false);
    }
    setExpenseCategory(cat);
    
    setExpenseAmount('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setExpenseSubItems([{ desc: '', amount: '', date: new Date().toISOString().split('T')[0] }]);
    setIsExpenseModalOpen(true);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const finalCategory = isExpenseRecurring ? `${expenseCategory}|recurring` : expenseCategory;

      if (editingExpenseId) {
        if (expenseSubItems.length > 0) {
          // Delete the original transaction
          await supabase.from('financial_transactions').delete().eq('id', editingExpenseId);
          
          const newTxs = [];
          for (const sub of expenseSubItems) {
            if (!sub.desc || !sub.amount) continue;
            newTxs.push({
              user_id: user.id,
              description: `[CNPJ] ${expenseDesc} - ${sub.desc}`,
              category: finalCategory,
              amount: parseFloat(sub.amount.replace(',', '.')),
              type: 'expense',
              date: sub.date || expenseDate
            });
          }
          if (newTxs.length > 0) {
            const { error } = await supabase.from('financial_transactions').insert(newTxs);
            if (error) throw error;
          }
        } else {
          if (!expenseAmount) return;
          const amount = parseFloat(expenseAmount.replace(',', '.'));
          
          const { error } = await supabase
            .from('financial_transactions')
            .update({
              description: `[CNPJ] ${expenseDesc}`,
              category: finalCategory,
              amount: amount,
              date: expenseDate
            })
            .eq('id', editingExpenseId);
            
          if (error) throw error;
        }
      } else {
        const newTxs = [];

        if (expenseSubItems.length > 0) {
          for (const sub of expenseSubItems) {
            if (!sub.desc || !sub.amount) continue;
            newTxs.push({
              user_id: user.id,
              description: `[CNPJ] ${expenseDesc} - ${sub.desc}`,
              category: finalCategory,
              amount: parseFloat(sub.amount.replace(',', '.')),
              type: 'expense',
              date: sub.date || expenseDate
            });
          }
        } else {
          if (!expenseAmount) return;
          newTxs.push({
            user_id: user.id,
            description: `[CNPJ] ${expenseDesc}`,
            category: finalCategory,
            amount: parseFloat(expenseAmount.replace(',', '.')),
            type: 'expense',
            date: expenseDate
          });
        }

        if (newTxs.length === 0) return;

        const { error } = await supabase.from('financial_transactions').insert(newTxs);
        if (error) throw error;
      }

      setIsExpenseModalOpen(false);
      setExpenseDesc('');
      setExpenseAmount('');
      setIsExpenseRecurring(false);
      setExpenseSubItems([]);
      setEditingExpenseId(null);
      fetchData();
    } catch (error) {
      console.error('Error adding/updating expense:', error);
      alert('Erro ao salvar despesa.');
    }
  };

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomeDesc || !incomeAmount) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const amount = parseFloat(incomeAmount.replace(',', '.'));

      if (editingIncomeId) {
        const { error } = await supabase
          .from('financial_transactions')
          .update({
            description: `[Receita] ${incomeDesc}`,
            amount: amount,
            date: incomeDate
          })
          .eq('id', editingIncomeId);
          
        if (error) throw error;
      } else {
        const { error } = await supabase.from('financial_transactions').insert({
          user_id: user.id,
          description: `[Receita] ${incomeDesc}`,
          category: 'Vendas',
          amount: amount,
          type: 'income',
          date: incomeDate
        });
        if (error) throw error;
      }

      setIsIncomeModalOpen(false);
      setIncomeDesc('');
      setIncomeAmount('');
      setEditingIncomeId(null);
      fetchData();
    } catch (error) {
      console.error('Error adding/updating income:', error);
      alert('Erro ao salvar receita.');
    }
  };

  const handleEditIncome = (tx: { id: string, description: string, amount: number, date: string }) => {
    setEditingIncomeId(tx.id);
    setIncomeDesc(tx.description.replace('[Receita] ', ''));
    setIncomeAmount(Math.abs(tx.amount).toString());
    setIncomeDate(tx.date.split('T')[0]);
    setIsIncomeModalOpen(true);
  };

  const handleDeleteIncome = (id: string) => {
    setIncomeToDelete(id);
  };

  const confirmDeleteIncome = async (id: string) => {
    try {
      const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
      if (error) throw error;
      setIncomeToDelete(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting income:', error);
    }
  };

  const handleDeleteExpense = (id: string) => {
    setExpenseToDelete(id);
  };

  const confirmDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
      if (error) throw error;
      setExpenseToDelete(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  // Separate transactions
  const asaasTxs = transactions.filter(tx => tx.description.includes('[Asaas]') || tx.description.includes('[Receita]'));
  const cnpjExpenses = transactions.filter(tx => tx.description.includes('[CNPJ]'));

  // Group CNPJ Expenses
  const groupedExpensesMap = new Map<string, { total: number, count: number, category: string, date: string, items: Transaction[], hasSubItems: boolean }>();
  
  cnpjExpenses.forEach(tx => {
    let cleanDesc = tx.description.replace('[CNPJ] ', '');
    let mainDesc = cleanDesc;
    let isSubItem = false;
    
    if (cleanDesc.includes(' - ')) {
      mainDesc = cleanDesc.split(' - ')[0];
      isSubItem = true;
    }

    if (!groupedExpensesMap.has(mainDesc)) {
      groupedExpensesMap.set(mainDesc, { total: 0, count: 0, category: tx.category, date: tx.date, items: [], hasSubItems: isSubItem });
    }
    
    const group = groupedExpensesMap.get(mainDesc)!;
    group.total += Math.abs(tx.amount);
    group.count += 1;
    group.items.push(tx);
    if (isSubItem) group.hasSubItems = true;
  });

  const groupedExpenses = Array.from(groupedExpensesMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filter transactions based on selected date range
  const filteredTxs = asaasTxs.filter(tx => {
    if (dateFilter === 'all') return true;
    
    const txDate = new Date(tx.date);
    const today = new Date();
    
    if (dateFilter === '7d') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      return txDate >= sevenDaysAgo;
    }
    
    if (dateFilter === '30d') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      return txDate >= thirtyDaysAgo;
    }
    
    if (dateFilter === '90d') {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(today.getDate() - 90);
      return txDate >= ninetyDaysAgo;
    }
    
    if (dateFilter === 'this_month') {
      return txDate.getMonth() === today.getMonth() && txDate.getFullYear() === today.getFullYear();
    }
    
    if (dateFilter === 'last_month') {
      const lastMonth = new Date();
      lastMonth.setMonth(today.getMonth() - 1);
      return txDate.getMonth() === lastMonth.getMonth() && txDate.getFullYear() === lastMonth.getFullYear();
    }
    
    return true;
  });

  // Group transactions by product and date to merge installments into single sales
  const groupedSalesMap = new Map<string, { id: string, description: string, amount: number, date: string, count: number, isManual: boolean, originalTxId: string }>();
  
  filteredTxs.forEach(tx => {
    let cleanDesc = tx.description.replace('[Asaas] ', '').replace('[Receita] ', '').replace(/\(ID: .*\)/, '').trim();
    cleanDesc = cleanDesc.replace(/^Parcela \d+ de \d+\.\s*/i, '');
    
    const isManual = tx.description.includes('[Receita]');
    
    // Key based on product name and date (or unique ID for manual)
    const dateStr = tx.date.split('T')[0];
    const key = isManual ? `manual-${tx.id}` : `${cleanDesc}-${dateStr}`;
    
    if (groupedSalesMap.has(key)) {
      const existing = groupedSalesMap.get(key)!;
      existing.amount += Math.abs(tx.amount);
      existing.count += 1;
    } else {
      groupedSalesMap.set(key, {
        id: tx.id,
        description: cleanDesc,
        amount: Math.abs(tx.amount),
        date: tx.date,
        count: 1,
        isManual: isManual,
        originalTxId: tx.id
      });
    }
  });

  const groupedSales = Array.from(groupedSalesMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalSales = groupedSales.reduce((acc, curr) => acc + curr.amount, 0);
  const salesCount = groupedSales.length;
  const averageTicket = salesCount > 0 ? totalSales / salesCount : 0;

  // Group by Product Family
  const productFamilyMap = new Map<string, { total: number, count: number, plans: Map<string, { total: number, count: number, isManual: boolean, originalTxId: string, date: string, name: string }> }>();

  groupedSales.forEach(sale => {
    let family = sale.description;
    
    // Smart grouping logic for known products
    if (family.toLowerCase().includes('gravyx')) {
      family = 'GravyX';
    } else if (family.toLowerCase().includes('web designer')) {
      family = 'Web Designer do Futuro';
    } else {
      // Generic fallback: remove common prefixes and suffixes
      family = family.replace(/^Acesso à oferta /i, '').replace(/^Acesso ao /i, '');
      family = family.split(' - ')[0].replace(/Premium|Starter|Basic|Pro|VIP/ig, '').trim();
    }

    if (!productFamilyMap.has(family)) {
      productFamilyMap.set(family, { total: 0, count: 0, plans: new Map() });
    }
    
    const familyData = productFamilyMap.get(family)!;
    familyData.total += sale.amount;
    familyData.count += 1; 
    
    const planKey = sale.isManual ? sale.id : sale.description;
    
    if (!familyData.plans.has(planKey)) {
      familyData.plans.set(planKey, { total: 0, count: 0, isManual: sale.isManual, originalTxId: sale.originalTxId, date: sale.date, name: sale.description });
    }
    const planData = familyData.plans.get(planKey)!;
    planData.total += sale.amount;
    planData.count += 1;
  });

  // Data for Pie Chart (Grouped by Family)
  let productData = Array.from(productFamilyMap.entries())
    .map(([name, data]) => ({ name, value: data.total }))
    .sort((a, b) => b.value - a.value);

  if (productData.length > 5) {
    const top5 = productData.slice(0, 5);
    const othersValue = productData.slice(5).reduce((sum, item) => sum + item.value, 0);
    const existingOutrosIndex = top5.findIndex(p => p.name === 'Outros');
    if (existingOutrosIndex >= 0) {
      top5[existingOutrosIndex].value += othersValue;
      productData = top5;
    } else {
      productData = [...top5, { name: 'Outros', value: othersValue }];
    }
  }

  // Data for Product List
  const productFamiliesList = Array.from(productFamilyMap.entries())
    .map(([name, data]) => ({
      name,
      total: data.total,
      count: data.count,
      plans: Array.from(data.plans.entries()).map(([planKey, planData]) => ({
        name: planData.name,
        total: planData.total,
        count: planData.count,
        isManual: planData.isManual,
        originalTxId: planData.originalTxId,
        date: planData.date
      })).sort((a, b) => b.total - a.total)
    }))
    .sort((a, b) => b.total - a.total);

  // Group by Day for the chart
  const dailyDataMap = new Map<string, number>();
  
  // Initialize dates based on filter to show empty days too
  if (dateFilter !== 'all') {
    const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : dateFilter === '90d' ? 90 : 30; // approx for months
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyDataMap.set(dateStr, 0);
    }
  }

  filteredTxs.forEach(tx => {
    const dateStr = tx.date.split('T')[0];
    dailyDataMap.set(dateStr, (dailyDataMap.get(dateStr) || 0) + Math.abs(tx.amount));
  });

  const dailyData = Array.from(dailyDataMap.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6'];

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-accent font-mono text-xs animate-pulse">CARREGANDO DADOS DA EMPRESA...</div>
      </div>
    );
  }

  const totalExpenses = cnpjExpenses.reduce((acc, curr) => acc + Math.abs(curr.amount), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-[-1px] text-white">Financeiro Empresa</h1>
          <p className="text-sm font-mono text-text-muted">Gestão de receitas (Asaas) e despesas (CNPJ)</p>
        </div>
        
        {activeTab === 'receitas' && (
          <div className="flex items-center gap-4">
            {syncMessage && (
              <div className={`text-xs px-3 py-1.5 rounded-sm font-medium ${
                syncMessage.type === 'success' ? 'bg-success/20 text-success' : 
                syncMessage.type === 'error' ? 'bg-danger/20 text-danger' : 
                'bg-accent/20 text-accent'
              }`}>
                {syncMessage.text}
              </div>
            )}
            <div className="flex items-center gap-2 bg-surface border border-border-subtle p-1 rounded-sm">
              <Filter className="w-4 h-4 text-text-muted ml-2" />
              <select 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="bg-transparent border-none text-xs font-mono text-white focus:ring-0 cursor-pointer py-1"
              >
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="90d">Últimos 90 dias</option>
                <option value="this_month">Este Mês</option>
                <option value="last_month">Mês Passado</option>
                <option value="all">Todo o Período</option>
              </select>
            </div>
            <button
              onClick={handleSync}
              disabled={isSyncingAsaas}
              className="bg-accent text-bg px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] hover:bg-accent/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Activity className={`w-4 h-4 ${isSyncingAsaas ? 'animate-spin' : ''}`} />
              {isSyncingAsaas ? 'Sincronizando...' : 'Sincronizar Asaas'}
            </button>
            <button
              onClick={() => setIsIncomeModalOpen(true)}
              className="bg-success text-bg px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] hover:bg-success/90 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Receita
            </button>
          </div>
        )}
      </div>

      {/* Sub-tabs Navigation */}
      <div className="flex border-b border-border-subtle overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab('receitas')}
          className={`px-6 py-4 text-[11px] font-mono tracking-[0.1em] uppercase transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'receitas' 
              ? 'text-accent border-accent bg-accent/5' 
              : 'text-text-muted border-transparent hover:text-text-main hover:bg-surface'
          }`}
        >
          RECEITAS (ASAAS)
        </button>
        <button
          onClick={() => setActiveTab('despesas')}
          className={`px-6 py-4 text-[11px] font-mono tracking-[0.1em] uppercase transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'despesas' 
              ? 'text-accent border-accent bg-accent/5' 
              : 'text-text-muted border-transparent hover:text-text-main hover:bg-surface'
          }`}
        >
          DESPESAS MANUAIS
        </button>
      </div>

      {activeTab === 'receitas' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface border border-border-subtle p-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-success/5 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-2 flex items-center gap-2">
              <DollarSign className="w-3 h-3 text-success" />
              Receita Total
            </div>
            <div className="text-3xl font-black tracking-[-1px] text-success">
              R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border-subtle p-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-accent/5 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-2 flex items-center gap-2">
              <Activity className="w-3 h-3 text-accent" />
              Vendas Realizadas
            </div>
            <div className="text-3xl font-black tracking-[-1px] text-white">
              {salesCount}
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border-subtle p-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-warning/5 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500"></div>
          <div className="relative z-10">
            <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-2 flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-warning" />
              Ticket Médio
            </div>
            <div className="text-3xl font-black tracking-[-1px] text-warning">
              R$ {averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue by Day */}
        <div className="lg:col-span-2 bg-surface border border-border-subtle p-6">
          <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted mb-6">Faturamento por Dia</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#666" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => {
                    const [year, month, day] = value.split('-');
                    return `${day}/${month}`;
                  }}
                />
                <YAxis 
                  stroke="#666" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `R$${value}`}
                />
                <Tooltip 
                  formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Faturamento']}
                  labelFormatter={(label) => {
                    const [year, month, day] = label.split('-');
                    return `${day}/${month}/${year}`;
                  }}
                  contentStyle={{ backgroundColor: '#0A0A0A', borderColor: '#333', borderRadius: '0px' }}
                  itemStyle={{ color: '#10B981', fontSize: '12px', fontFamily: 'monospace' }}
                  labelStyle={{ color: '#666', fontSize: '10px', fontFamily: 'monospace', marginBottom: '4px' }}
                  cursor={{ fill: '#ffffff0a' }}
                />
                <Bar dataKey="amount" fill="#10B981" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Product */}
        <div className="bg-surface border border-border-subtle p-6">
          <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted mb-6">Receita por Produto</h3>
          <div className="h-72">
            {productData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={productData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {productData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    contentStyle={{ backgroundColor: '#0A0A0A', borderColor: '#333', borderRadius: '0px' }}
                    itemStyle={{ color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm font-mono text-text-muted">
                Sem dados no período
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Product Families List */}
      <div className="bg-surface border border-border-subtle overflow-hidden">
        <div className="p-4 border-b border-border-subtle bg-surface-2/50 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Vendas por Produto</h3>
          <div className="text-[10px] font-mono text-text-muted">{productFamiliesList.length} produtos</div>
        </div>
        {productFamiliesList.length === 0 ? (
          <div className="p-8 text-center text-sm font-mono text-text-muted">
            Nenhuma venda registrada neste período.
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {productFamiliesList.map(family => (
              <div key={family.name} className="flex flex-col">
                <div 
                  className="p-4 flex items-center justify-between hover:bg-surface-2/30 transition-colors cursor-pointer"
                  onClick={() => toggleProduct(family.name)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20 shrink-0">
                      <DollarSign className="w-4 h-4 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate" title={family.name}>
                        {family.name}
                      </div>
                      <div className="text-[10px] font-mono text-text-muted flex items-center gap-2">
                        <span>{family.count} vendas</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4 flex items-center gap-4">
                    <div>
                      <div className="text-sm font-mono font-bold text-success">
                        R$ {family.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="text-text-muted">
                      {expandedProducts[family.name] ? '▼' : '▶'}
                    </div>
                  </div>
                </div>
                
                {/* Plans Breakdown */}
                {expandedProducts[family.name] && (
                  <div className="bg-surface-2/30 border-t border-border-subtle p-4 pl-16 space-y-3">
                    {family.plans.map((plan, idx) => (
                      <div key={plan.originalTxId || `${plan.name}-${idx}`} className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-white/80 truncate" title={plan.name}>
                            {plan.name}
                          </div>
                          <div className="text-[10px] font-mono text-text-muted">
                            {plan.count} vendas
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-xs font-mono font-bold text-success/80">
                            R$ {plan.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          {plan.isManual && (
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleEditIncome({ id: plan.originalTxId, description: plan.name, amount: plan.total, date: plan.date }); }}
                                className="p-1 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteIncome(plan.originalTxId); }}
                                className="p-1 text-text-muted hover:text-danger hover:bg-danger/10 rounded-sm transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
      )}

      {activeTab === 'despesas' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <div className="bg-surface border border-border-subtle p-6 relative overflow-hidden group flex-1 max-w-sm">
              <div className="absolute inset-0 bg-danger/5 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500"></div>
              <div className="relative z-10">
                <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-2 flex items-center gap-2">
                  <Activity className="w-3 h-3 text-danger" />
                  Total de Despesas (CNPJ)
                </div>
                <div className="text-3xl font-black tracking-[-1px] text-danger">
                  R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="bg-accent text-bg px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] hover:bg-accent/90 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Despesa
            </button>
          </div>

          <div className="bg-surface border border-border-subtle overflow-hidden">
            <div className="p-4 border-b border-border-subtle bg-surface-2/50 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Histórico de Despesas</h3>
              <div className="text-[10px] font-mono text-text-muted">{cnpjExpenses.length} registros</div>
            </div>
            {groupedExpenses.length === 0 ? (
              <div className="p-8 text-center text-sm font-mono text-text-muted">
                Nenhuma despesa registrada para a empresa.
              </div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {groupedExpenses.map(group => {
                  const [catName, catColor] = group.category.split('|');
                  
                  return (
                    <div key={group.name} className="flex flex-col">
                      <div 
                        className={`p-4 flex items-center justify-between hover:bg-surface-2/30 transition-colors group ${group.hasSubItems ? 'cursor-pointer' : ''}`}
                        onClick={() => { if (group.hasSubItems) toggleProduct(`exp_${group.name}`); }}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center border border-danger/20 shrink-0">
                            <DollarSign className="w-4 h-4 text-danger" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white truncate flex items-center gap-2" title={group.name}>
                              {group.name}
                              {group.category.endsWith('|recurring') && (
                                <span className="text-[9px] bg-accent/20 text-accent px-1 rounded-sm font-bold" title="Recorrente">R</span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-text-muted flex items-center gap-2">
                              <span>{new Date(group.date).toLocaleDateString('pt-BR')}</span>
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: catColor || '#9CA3AF' }}></span>
                                {catName || 'Outros'}
                              </span>
                              {group.hasSubItems && (
                                <span className="bg-surface-3 px-1.5 py-0.5 rounded-sm text-[9px] text-white">
                                  {group.count} {group.count === 1 ? 'item' : 'itens'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-4 flex items-center gap-4">
                          <div>
                            <div className="text-sm font-mono font-bold text-danger">
                              - R$ {group.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          {!group.hasSubItems ? (
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleAddSubItem(group); }}
                                className="p-2 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm transition-colors opacity-0 group-hover:opacity-100"
                                title="Adicionar Subitem"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleEditExpense(group.items[0]); }}
                                className="p-2 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm transition-colors opacity-0 group-hover:opacity-100"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteExpense(group.items[0].id); }}
                                className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-sm transition-colors opacity-0 group-hover:opacity-100"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleAddSubItem(group); }}
                                className="p-2 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm transition-colors opacity-0 group-hover:opacity-100"
                                title="Adicionar Subitem"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <div className="text-text-muted w-8 text-center">
                                {expandedProducts[`exp_${group.name}`] ? '▼' : '▶'}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Sub-items Breakdown */}
                      {group.hasSubItems && expandedProducts[`exp_${group.name}`] && (
                        <div className="bg-surface-2/30 border-t border-border-subtle p-4 pl-16 space-y-3">
                          {group.items.map(tx => {
                            const subName = tx.description.replace('[CNPJ] ', '').replace(`${group.name} - `, '');
                            return (
                              <div key={tx.id} className="flex items-center justify-between group/sub">
                                <div className="min-w-0">
                                  <div className="text-xs font-medium text-white/80 truncate" title={subName}>
                                    {subName}
                                  </div>
                                  <div className="text-[10px] font-mono text-text-muted">
                                    {new Date(tx.date).toLocaleDateString('pt-BR')}
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-xs font-mono font-bold text-danger/80">
                                    - R$ {Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button 
                                      onClick={() => handleEditExpense(tx)}
                                      className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm transition-colors opacity-0 group-hover/sub:opacity-100"
                                      title="Editar"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteExpense(tx.id)}
                                      className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-sm transition-colors opacity-0 group-hover/sub:opacity-100"
                                      title="Excluir"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-sm border border-border-subtle shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-2">Excluir Despesa?</h3>
            <p className="text-sm text-text-muted mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setExpenseToDelete(null)}
                className="flex-1 py-2 text-xs font-bold uppercase tracking-[0.1em] text-text-muted hover:text-white bg-surface-2 hover:bg-surface-3 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => confirmDelete(expenseToDelete)}
                className="flex-1 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white bg-danger hover:bg-danger/90 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Income Confirmation Modal */}
      {incomeToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-sm border border-border-subtle shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-2">Excluir Receita?</h3>
            <p className="text-sm text-text-muted mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIncomeToDelete(null)}
                className="flex-1 py-2 text-xs font-bold uppercase tracking-[0.1em] text-text-muted hover:text-white bg-surface-2 hover:bg-surface-3 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => confirmDeleteIncome(incomeToDelete)}
                className="flex-1 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white bg-danger hover:bg-danger/90 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Income Modal */}
      {isIncomeModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-md border border-border-subtle shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border-subtle">
              <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-white">
                {editingIncomeId ? 'Editar Receita Manual' : 'Nova Receita Manual'}
              </h2>
              <button 
                onClick={() => {
                  setIsIncomeModalOpen(false);
                  setEditingIncomeId(null);
                  setIncomeDesc('');
                  setIncomeAmount('');
                }}
                className="text-text-muted hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddIncome} className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-2">Descrição da Receita</label>
                <input
                  type="text"
                  value={incomeDesc}
                  onChange={(e) => setIncomeDesc(e.target.value)}
                  placeholder="Ex: Consultoria, Mentoria..."
                  className="w-full bg-surface-2 border border-border-subtle p-3 text-sm text-white focus:border-success focus:outline-none transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-2">Valor Total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={incomeAmount}
                    onChange={(e) => setIncomeAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-surface-2 border border-border-subtle p-3 text-sm text-white focus:border-success focus:outline-none transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-2">Data</label>
                  <input
                    type="date"
                    value={incomeDate}
                    onChange={(e) => setIncomeDate(e.target.value)}
                    className="w-full bg-surface-2 border border-border-subtle p-3 text-sm text-white focus:border-success focus:outline-none transition-colors"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-success text-bg py-3 text-xs font-bold uppercase tracking-[0.1em] hover:bg-success/90 transition-colors mt-4"
              >
                {editingIncomeId ? 'Salvar Alterações' : 'Salvar Receita'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-md border border-border-subtle shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border-subtle">
              <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-white">
                {editingExpenseId ? 'Editar Despesa (CNPJ)' : 'Nova Despesa (CNPJ)'}
              </h2>
              <button 
                onClick={() => {
                  setIsExpenseModalOpen(false);
                  setEditingExpenseId(null);
                  setExpenseDesc('');
                  setExpenseAmount('');
                  setIsExpenseRecurring(false);
                  setExpenseSubItems([]);
                }}
                className="text-text-muted hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddExpense} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto hide-scrollbar">
              <div>
                <label className="block text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-2">Descrição Principal</label>
                <input
                  type="text"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="Ex: Meta Ads"
                  className="w-full bg-surface-2 border border-border-subtle p-3 text-sm text-white focus:border-accent focus:outline-none transition-colors"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="expenseRecurring"
                  checked={isExpenseRecurring}
                  onChange={(e) => setIsExpenseRecurring(e.target.checked)}
                  className="w-4 h-4 bg-surface-2 border-border-subtle text-accent focus:ring-accent focus:ring-offset-surface rounded-sm"
                />
                <label htmlFor="expenseRecurring" className="text-xs font-mono text-text-main cursor-pointer">
                  Despesa Recorrente (Mensal)
                </label>
              </div>

              {/* Sub-items Section */}
              <div className="border border-border-subtle p-4 bg-surface-2/30 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-mono text-text-muted uppercase tracking-[0.1em]">Subitens (Opcional)</label>
                  <button
                    type="button"
                    onClick={() => setExpenseSubItems([...expenseSubItems, { desc: '', amount: '', date: expenseDate }])}
                    className="text-[10px] font-bold text-accent hover:text-accent/80 uppercase tracking-[0.1em] flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Adicionar
                  </button>
                </div>

                  {expenseSubItems.length > 0 && (
                    <div className="space-y-3">
                      {expenseSubItems.map((sub, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              value={sub.desc}
                              onChange={(e) => {
                                const newSubs = [...expenseSubItems];
                                newSubs[idx].desc = e.target.value;
                                setExpenseSubItems(newSubs);
                              }}
                              placeholder="Descrição (ex: Fatura 1)"
                              className="w-full bg-surface-2 border border-border-subtle p-2 text-xs text-white focus:border-accent focus:outline-none"
                              required
                            />
                            <div className="flex gap-2">
                              <input
                                type="number"
                                step="0.01"
                                value={sub.amount}
                                onChange={(e) => {
                                  const newSubs = [...expenseSubItems];
                                  newSubs[idx].amount = e.target.value;
                                  setExpenseSubItems(newSubs);
                                }}
                                placeholder="Valor"
                                className="w-1/2 bg-surface-2 border border-border-subtle p-2 text-xs text-white focus:border-accent focus:outline-none"
                                required
                              />
                              <input
                                type="date"
                                value={sub.date}
                                onChange={(e) => {
                                  const newSubs = [...expenseSubItems];
                                  newSubs[idx].date = e.target.value;
                                  setExpenseSubItems(newSubs);
                                }}
                                className="w-1/2 bg-surface-2 border border-border-subtle p-2 text-xs text-white focus:border-accent focus:outline-none"
                                required
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newSubs = expenseSubItems.filter((_, i) => i !== idx);
                              setExpenseSubItems(newSubs);
                            }}
                            className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-sm transition-colors mt-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              {(expenseSubItems.length === 0 || editingExpenseId) && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-2">Valor Total (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-surface-2 border border-border-subtle p-3 text-sm text-white focus:border-accent focus:outline-none transition-colors"
                      required={expenseSubItems.length === 0 || !!editingExpenseId}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-2">Data</label>
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full bg-surface-2 border border-border-subtle p-3 text-sm text-white focus:border-accent focus:outline-none transition-colors"
                      required={expenseSubItems.length === 0 || !!editingExpenseId}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-2">Categoria</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle p-3 text-sm text-white focus:border-accent focus:outline-none transition-colors"
                >
                  <option value="Impostos|#EF4444">Impostos</option>
                  <option value="Software|#60A5FA">Software / Ferramentas</option>
                  <option value="Marketing|#F59E0B">Marketing / Ads</option>
                  <option value="Equipe|#8B5CF6">Equipe / Freelancers</option>
                  <option value="Contabilidade|#10B981">Contabilidade</option>
                  <option value="Outros|#9CA3AF">Outros</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-accent text-bg py-3 text-xs font-bold uppercase tracking-[0.1em] hover:bg-accent/90 transition-colors mt-4"
              >
                {editingExpenseId ? 'Salvar Alterações' : 'Salvar Despesa'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
