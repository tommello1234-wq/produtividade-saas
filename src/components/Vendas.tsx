import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DollarSign, Calendar, TrendingUp, Activity, Filter, Plus, X, Trash2, Edit2, RefreshCw, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Finances from './Finances';

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
  const [expandedExpenseMonths, setExpandedExpenseMonths] = useState<Record<string, boolean>>({});
  
  // New state for Empresa tabs
  const [activeTab, setActiveTab] = useState<'receitas' | 'despesas' | 'cpf'>('receitas');
  
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
  const [isSyncingContaSimples, setIsSyncingContaSimples] = useState(false);
  const [isSyncingTicto, setIsSyncingTicto] = useState(false);
  const [isSyncingStripe, setIsSyncingStripe] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isImportingExpenses, setIsImportingExpenses] = useState(false);
  const [showSyncMenu, setShowSyncMenu] = useState(false);
  const syncMenuRef = useRef<HTMLDivElement>(null);

  // Close sync dropdown when clicking outside
  useEffect(() => {
    if (!showSyncMenu) return;
    const handler = (e: MouseEvent) => {
      if (syncMenuRef.current && !syncMenuRef.current.contains(e.target as Node)) {
        setShowSyncMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSyncMenu]);

  const toggleProduct = (productName: string) => {
    setExpandedProducts(prev => ({ ...prev, [productName]: !prev[productName] }));
  };

  // Formata "YYYY-MM-DD" (ou "YYYY-MM-DD HH:MM:SS") como "DD/MM/YYYY" SEM
  // criar Date object — evita o shift de timezone que faz '2026-04-01' virar
  // '31/03/2026' no browser BR (parsing UTC vs local). Consistente com o
  // bucketing (que também usa split('-')).
  const formatDateBR = (s: string): string => {
    if (!s) return '';
    const [y, m, d] = String(s).split(/[T ]/)[0].split('-');
    return d && m && y ? `${d}/${m}/${y}` : String(s);
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
        setSyncMessage({ type: 'info', text: data.message || 'Nada novo no Asaas.' });
      } else {
        const parts: string[] = [];
        if (data.payments) parts.push(`${data.payments} venda${data.payments === 1 ? '' : 's'}`);
        if (data.transfers) parts.push(`${data.transfers} saque${data.transfers === 1 ? '' : 's'}`);
        const summary = parts.length ? parts.join(' + ') : `${data.count} item(s)`;
        setSyncMessage({ type: 'success', text: `Asaas sincronizado: ${summary}.` });
        fetchData();
      }
    } catch (e) {
      setSyncMessage({ type: 'error', text: 'Erro ao sincronizar com o Asaas.' });
    } finally {
      setIsSyncingAsaas(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  // Sincroniza extrato + cartão da Conta Simples (PJ).
  // O endpoint cuida de auth OAuth, paginação e dedup.
  const handleSyncContaSimples = async () => {
    if (!userId) return;
    setIsSyncingContaSimples(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/conta-simples/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, days: 90 }),
      });
      const data = await res.json();
      if (data.error) {
        setSyncMessage({ type: 'error', text: data.error });
      } else if (data.count === 0) {
        setSyncMessage({
          type: 'info',
          text: data.message || 'Nada novo do Conta Simples.',
        });
      } else {
        setSyncMessage({
          type: 'success',
          text: `Conta Simples: ${data.count} novas transações importadas${data.skipped ? ` (${data.skipped} já existiam)` : ''}.`,
        });
        fetchData();
      }
    } catch (e) {
      setSyncMessage({ type: 'error', text: 'Erro ao sincronizar com o Conta Simples.' });
    } finally {
      setIsSyncingContaSimples(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  // Sincroniza vendas Ticto via API (OAuth2 client_credentials).
  // Usa mesmo prefixo `[Ticto]` do CSV — dedup por (ID:) cobre os 2 caminhos.
  const handleSyncTicto = async () => {
    if (!userId) return;
    setIsSyncingTicto(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/ticto/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, days: 90 }),
      });
      const data = await res.json();
      if (data.error) {
        setSyncMessage({ type: 'error', text: data.error });
      } else if (data.count === 0) {
        setSyncMessage({
          type: 'info',
          text: data.message || `Nada novo do Ticto (${data.total || 0} orders, ${data.skipped || 0} já existiam).`,
        });
      } else {
        setSyncMessage({
          type: 'success',
          text: `Ticto: ${data.count} venda${data.count === 1 ? '' : 's'} importada${data.count === 1 ? '' : 's'}${data.skipped ? ` (${data.skipped} já existiam)` : ''}.`,
        });
        fetchData();
      }
    } catch (e) {
      setSyncMessage({ type: 'error', text: 'Erro ao sincronizar com o Ticto.' });
    } finally {
      setIsSyncingTicto(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  const handleSyncStripe = async () => {
    if (!userId) return;
    setIsSyncingStripe(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/stripe/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.error) {
        setSyncMessage({ type: 'error', text: data.error });
      } else if (data.count === 0) {
        setSyncMessage({ type: 'info', text: data.message || 'Nada novo da Stripe.' });
      } else {
        setSyncMessage({
          type: 'success',
          text: `Stripe: ${data.count} novas (${data.saques || 0} saques, ${data.charges || 0} vendas).`,
        });
        fetchData();
      }
    } catch (e) {
      setSyncMessage({ type: 'error', text: 'Erro ao sincronizar com a Stripe.' });
    } finally {
      setIsSyncingStripe(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  // -------- Importador de CSV da Ticto --------
  const parseCSV = (text: string): Array<Record<string, string>> => {
    // Remove BOM se houver
    const clean = text.replace(/^\uFEFF/, '').trim();
    const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    // Detecta separador (vírgula ou ponto-e-vírgula)
    const firstLine = lines[0];
    const sep = firstLine.includes(';') ? ';' : ',';
    // Parser simples respeitando aspas
    const parseLine = (line: string): string[] => {
      const out: string[] = [];
      let cur = '';
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
          else inQuote = !inQuote;
        } else if (ch === sep && !inQuote) {
          out.push(cur); cur = '';
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out.map((s) => s.trim());
    };
    const headers = parseLine(lines[0]);
    return lines.slice(1).map((line) => {
      const vals = parseLine(line);
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
  };

  // -------- Importador de CSV de DESPESAS (CNPJ) --------
  const handleExpenseImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !userId) return;
    setIsImportingExpenses(true);
    setSyncMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(buffer);
      if (text.includes('\uFFFD')) {
        text = new TextDecoder('iso-8859-1').decode(buffer);
      }
      const rows = parseCSV(text);
      if (rows.length === 0) {
        setSyncMessage({ type: 'error', text: 'CSV vazio ou inválido.' });
        return;
      }
      const res = await fetch('/api/expenses/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, rows }),
      });
      const data = await res.json();
      if (data.error) {
        setSyncMessage({ type: 'error', text: data.error });
      } else if (data.count === 0) {
        setSyncMessage({ type: 'info', text: data.message || `Nenhuma nova despesa. ${data.skipped || 0} já existiam.` });
      } else {
        setSyncMessage({
          type: 'success',
          text: `${data.count} despesas importadas em ${data.vendors} grupo(s)! ${data.skipped || 0} já existiam.`,
        });
        fetchData();
      }
    } catch (err: any) {
      setSyncMessage({ type: 'error', text: err?.message || 'Falha ao importar CSV.' });
    } finally {
      setIsImportingExpenses(false);
      setTimeout(() => setSyncMessage(null), 6000);
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
      
      const allTxsRaw = (data || []).filter(tx =>
        tx.description.includes('[Asaas]') ||
        tx.description.includes('[Saque Asaas]') ||
        tx.description.includes('[Ticto]') ||
        tx.description.includes('[Saque Ticto]') ||
        tx.description.includes('[Stripe]') ||
        tx.description.includes('[Saque Stripe]') ||
        tx.description.includes('[CNPJ]') ||
        tx.description.includes('[Receita]')
      );

      // Netting de estornos: se um estorno bate por ID com a venda original, ambos somem.
      // (assim a venda reembolsada some do dia da venda; estornos órfãos continuam visíveis)
      const refundIds = new Set<string>();
      allTxsRaw.forEach((tx: any) => {
        const d = String(tx.description || '');
        if (tx.type === 'expense' && /ESTORNO|Estorno/.test(d)) {
          const m = d.match(/\(ID:\s*([^)]+)\)/);
          if (m) refundIds.add(m[1].trim());
        }
      });
      const allTxs = allTxsRaw.filter((tx: any) => {
        const m = String(tx.description || '').match(/\(ID:\s*([^)]+)\)/);
        if (!m) return true;
        return !refundIds.has(m[1].trim());
      });


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

  // Helpers de toggle entre modais Receita/Despesa, transferindo dados digitados
  const switchToExpense = () => {
    setExpenseDesc(incomeDesc);
    setExpenseAmount(incomeAmount);
    setExpenseDate(incomeDate);
    setIsIncomeModalOpen(false);
    setIsExpenseModalOpen(true);
  };
  const switchToIncome = () => {
    setIncomeDesc(expenseDesc);
    setIncomeAmount(expenseAmount);
    setIncomeDate(expenseDate);
    setIsExpenseModalOpen(false);
    setIsIncomeModalOpen(true);
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

  // Separa transações por origem:
  // - asaasTxs: vendas automáticas (Asaas + Ticto) — exibidas na aba RECEITAS (ASAAS)
  // - manualIncomes: receitas ([Receita] manuais + [Saque Asaas] automáticos) — aba MANUAIS lado entradas
  //   Modelo do usuário: saque do Asaas = ENTRADA (dinheiro chegando pra ele), não saída.
  // - cnpjExpenses: despesas manuais ([CNPJ]) — aba MANUAIS lado saídas
  const asaasTxs = transactions.filter(tx =>
    tx.description.includes('[Asaas]') ||   // não casa com [Saque Asaas] (bracket diferente)
    tx.description.includes('[Ticto]') ||
    tx.description.includes('[Stripe]')     // vendas Stripe entram na mesma aba
  );
  const manualIncomes = transactions.filter(tx =>
    tx.description.includes('[Receita]') ||
    tx.description.includes('[Saque Asaas]') ||
    tx.description.includes('[Saque Ticto]') ||
    tx.description.includes('[Saque Stripe]')
  );
  const cnpjExpenses = transactions.filter(tx => tx.description.includes('[CNPJ]'));

  // Group CNPJ Expenses POR MÊS + VENDOR (evita que um grupo cruze meses)
  const cleanCnpjDesc = (raw: string) => {
    let s = raw
      .replace('[CNPJ] ', '')
      .replace('[Saque Asaas] ', '')
      .replace(/\(ID: [^)]+\)\s*$/, '')
      .trim();
    let main = s;
    let isSub = false;
    if (s.includes(' - ')) { main = s.split(' - ')[0]; isSub = true; }
    return { mainDesc: main, isSubItem: isSub };
  };

  // Mapa: "YYYY-MM::vendor" → group
  const groupedExpensesMonthMap = new Map<string, { month: string, mainDesc: string, total: number, count: number, category: string, date: string, items: Transaction[], hasSubItems: boolean }>();

  cnpjExpenses.forEach(tx => {
    const { mainDesc, isSubItem } = cleanCnpjDesc(tx.description);
    const month = (tx.date || '').slice(0, 7); // YYYY-MM
    const key = `${month}::${mainDesc}`;

    if (!groupedExpensesMonthMap.has(key)) {
      groupedExpensesMonthMap.set(key, { month, mainDesc, total: 0, count: 0, category: tx.category, date: tx.date, items: [], hasSubItems: isSubItem });
    }
    const group = groupedExpensesMonthMap.get(key)!;
    // Soma com SINAL: estornos têm amount negativo e subtraem do total da despesa
    group.total += Number(tx.amount);
    group.count += 1;
    group.items.push(tx);
    if (isSubItem) group.hasSubItems = true;
    // Mantém a data mais recente como representativa do grupo (afeta ordenação dentro do mês)
    if (new Date(tx.date).getTime() > new Date(group.date).getTime()) group.date = tx.date;
  });

  const groupedExpenses = Array.from(groupedExpensesMonthMap.values())
    .map(g => ({ name: g.mainDesc, total: g.total, count: g.count, category: g.category, date: g.date, items: g.items, hasSubItems: g.hasSubItems }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filtro genérico de data — usado para income E expenses
  const matchesDateFilter = (txDateStr: string) => {
    if (dateFilter === 'all') return true;
    const txDate = new Date(txDateStr);
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
  };

  // Filter transactions based on selected date range
  const filteredTxs = asaasTxs.filter((tx) => matchesDateFilter(tx.date));
  // Despesas: SEM filtro de data — agrupadas por mês (cada mês colapsável separadamente)
  // Mantemos `filteredCnpjExpenses` apenas pra compatibilidade local, mas o totalExpenses
  // e a listagem usam o conjunto completo abaixo.
  const filteredCnpjExpenses = cnpjExpenses;
  const filteredGroupedExpenses = groupedExpenses;

  // Despesas agrupadas POR MÊS (Março De 2026 / Abril De 2026 ...)
  // Cada bucket mantém os "groupedExpenses" daquele mês + o total.
  type ExpenseGroup = typeof groupedExpenses[number];
  const expensesByMonth: { key: string; label: string; total: number; groups: ExpenseGroup[] }[] = (() => {
    const buckets = new Map<string, { key: string; label: string; total: number; groups: ExpenseGroup[]; sortKey: number }>();
    groupedExpenses.forEach((g) => {
      const [y, m, d] = g.date.split('-');
      const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d || '1'));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      let label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      label = label.charAt(0).toUpperCase() + label.slice(1).replace(' de ', ' De ');
      if (!buckets.has(key)) {
        buckets.set(key, { key, label, total: 0, groups: [], sortKey: date.getFullYear() * 100 + date.getMonth() });
      }
      const b = buckets.get(key)!;
      b.total += g.total;
      b.groups.push(g);
    });
    return Array.from(buckets.values())
      .sort((a, b) => b.sortKey - a.sortKey) // mais recente primeiro
      .map(({ sortKey: _, ...rest }) => rest);
  })();

  const totalManualIncomes = manualIncomes.reduce((acc, curr) => acc + Math.abs(curr.amount), 0);

  // União mês-a-mês: cada bucket combina entradas (manualIncomes) + saídas (groupedExpenses)
  // do mesmo mês. Usado pelo layout estilo PESSOAL — header full-width, expansão revela
  // tabela de entradas | tabela de saídas dentro daquele mês.
  type MonthUnion = {
    key: string;
    label: string;
    incomes: Transaction[];
    expenseGroups: ExpenseGroup[];
    totalIncome: number;
    totalExpense: number;
  };
  const allMonthBuckets: MonthUnion[] = (() => {
    const buckets = new Map<string, MonthUnion & { sortKey: number }>();
    const ensure = (date: Date) => {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!buckets.has(key)) {
        let label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        label = label.charAt(0).toUpperCase() + label.slice(1).replace(' de ', ' De ');
        buckets.set(key, {
          key,
          label,
          incomes: [],
          expenseGroups: [],
          totalIncome: 0,
          totalExpense: 0,
          sortKey: date.getFullYear() * 100 + date.getMonth(),
        });
      }
      return buckets.get(key)!;
    };
    manualIncomes.forEach((tx) => {
      const [y, m, d] = tx.date.split('-');
      const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d || '1'));
      const b = ensure(date);
      b.incomes.push(tx);
      b.totalIncome += Math.abs(tx.amount);
    });
    groupedExpenses.forEach((g) => {
      const [y, m, d] = g.date.split('-');
      const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d || '1'));
      const b = ensure(date);
      b.expenseGroups.push(g);
      b.totalExpense += g.total;
    });
    return Array.from(buckets.values())
      .sort((a, b) => b.sortKey - a.sortKey)
      .map(({ sortKey: _, ...rest }) => rest);
  })();

  // Default: mês mais recente expandido se nada foi tocado ainda
  const isMonthExpanded = (key: string) => {
    if (key in expandedExpenseMonths) return expandedExpenseMonths[key];
    return key === allMonthBuckets[0]?.key;
  };
  const toggleMonth = (key: string) => {
    setExpandedExpenseMonths((prev) => ({ ...prev, [key]: !isMonthExpanded(key) }));
  };

  // Group transactions by product and date to merge installments into single sales
  // Estornos (type='expense') subtraem do total; vendas (type='income') somam.
  const groupedSalesMap = new Map<string, { id: string, description: string, amount: number, date: string, count: number, isManual: boolean, originalTxId: string }>();

  filteredTxs.forEach(tx => {
    let cleanDesc = tx.description
      .replace('[Asaas] ', '')
      .replace('[Ticto] ', '')
      .replace('[Stripe] ', '')
      .replace('[Receita] ', '')
      .replace(/\(ID: .*\)/, '').trim();
    cleanDesc = cleanDesc.replace(/^Parcela \d+ de \d+\.\s*/i, '');

    const isManual = tx.description.includes('[Receita]');
    const sign = tx.type === 'expense' ? -1 : 1;     // estorno = negativo
    const signedAmount = sign * Math.abs(tx.amount);

    const dateStr = tx.date.split('T')[0];
    const key = isManual ? `manual-${tx.id}` : `${cleanDesc}-${dateStr}`;

    if (groupedSalesMap.has(key)) {
      const existing = groupedSalesMap.get(key)!;
      existing.amount += signedAmount;
      existing.count += 1;
    } else {
      groupedSalesMap.set(key, {
        id: tx.id,
        description: cleanDesc,
        amount: signedAmount,
        date: tx.date,
        count: 1,
        isManual: isManual,
        originalTxId: tx.id
      });
    }
  });

  const groupedSales = Array.from(groupedSalesMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalSales = groupedSales.reduce((acc, curr) => acc + curr.amount, 0);    // já líquido (vendas - estornos)
  // Conta SÓ vendas reais (income), excluindo estornos da contagem
  const salesCount = filteredTxs.filter(tx => tx.type !== 'expense').length;
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
    familyData.count += sale.count; // conta transações reais, não grupos por dia

    const planKey = sale.isManual ? sale.id : sale.description;

    if (!familyData.plans.has(planKey)) {
      familyData.plans.set(planKey, { total: 0, count: 0, isManual: sale.isManual, originalTxId: sale.originalTxId, date: sale.date, name: sale.description });
    }
    const planData = familyData.plans.get(planKey)!;
    planData.total += sale.amount;
    planData.count += sale.count;
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

  // Group by Day for the chart — agora mantém breakdown por origem (Asaas vs Ticto)
  // pra tooltip mostrar a divisão. `amount` total continua sendo o valor da barra.
  type DailyBucket = { asaas: number; ticto: number; stripe: number; manual: number; amount: number };
  const dailyDataMap = new Map<string, DailyBucket>();

  // Initialize dates based on filter to show empty days too
  if (dateFilter !== 'all') {
    const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : dateFilter === '90d' ? 90 : 30; // approx for months
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyDataMap.set(dateStr, { asaas: 0, ticto: 0, stripe: 0, manual: 0, amount: 0 });
    }
  }

  filteredTxs.forEach(tx => {
    const dateStr = tx.date.split('T')[0];
    const bucket = dailyDataMap.get(dateStr) || { asaas: 0, ticto: 0, stripe: 0, manual: 0, amount: 0 };
    // Vendas somam, estornos subtraem (mostra receita líquida real)
    const sign = tx.type === 'expense' ? -1 : 1;
    const v = sign * Math.abs(tx.amount);
    if (tx.description.includes('[Stripe]')) bucket.stripe += v;
    else if (tx.description.includes('[Asaas]')) bucket.asaas += v;
    else if (tx.description.includes('[Ticto]')) bucket.ticto += v;
    else if (tx.description.includes('[Receita]')) bucket.manual += v;
    bucket.amount += v;
    dailyDataMap.set(dateStr, bucket);
  });

  const dailyData = Array.from(dailyDataMap.entries())
    .map(([date, b]) => ({ date, ...b }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6'];

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-accent font-mono text-xs animate-pulse">CARREGANDO DADOS DA EMPRESA...</div>
      </div>
    );
  }

  // Soma com sinal: estornos (amount negativo) subtraem do total
  const totalExpenses = filteredCnpjExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);

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
            {/* Sync menu — agrupa as ações de sincronização que normalmente
                são automáticas (webhook Asaas/Ticto, cron Conta Simples).
                Útil só pra backfill ou forçar uma sync agora. */}
            <div className="relative" ref={syncMenuRef}>
              <button
                onClick={() => setShowSyncMenu((v) => !v)}
                disabled={isSyncingAsaas || isSyncingContaSimples || isSyncingTicto || isSyncingStripe}
                className="bg-surface border border-border-subtle text-text-muted hover:text-text-main hover:bg-surface-2 px-3 py-2 text-xs font-mono tracking-[0.1em] uppercase transition-colors flex items-center gap-2 disabled:opacity-50"
                title="Sincronizar manualmente (normalmente é automático)"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${(isSyncingAsaas || isSyncingContaSimples || isSyncingTicto || isSyncingStripe) ? 'animate-spin' : ''}`} />
                Sincronizar
                <ChevronDown className="w-3 h-3" />
              </button>
              {showSyncMenu && (
                <div className="absolute right-0 mt-1 w-72 bg-surface border border-border-subtle shadow-xl z-50 py-1">
                  <div className="px-3 py-2 text-[10px] font-mono tracking-[0.2em] text-text-muted border-b border-border-subtle">
                    SINCRONIZAÇÕES
                  </div>
                  <button
                    onClick={() => { setShowSyncMenu(false); handleSync(); }}
                    disabled={isSyncingAsaas}
                    className="w-full text-left px-3 py-2.5 hover:bg-surface-2 transition-colors disabled:opacity-50 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-main">Asaas</span>
                      <span className="text-[9px] font-mono text-success">AUTO via webhook</span>
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5">Forçar sync (backfill histórico)</div>
                  </button>
                  <button
                    onClick={() => { setShowSyncMenu(false); handleSyncContaSimples(); }}
                    disabled={isSyncingContaSimples}
                    className="w-full text-left px-3 py-2.5 hover:bg-surface-2 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-main">Conta Simples</span>
                      <span className="text-[9px] font-mono text-success">AUTO 6h da manhã</span>
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5">Forçar sync agora (últimos 90 dias)</div>
                  </button>
                  <button
                    onClick={() => { setShowSyncMenu(false); handleSyncTicto(); }}
                    disabled={isSyncingTicto}
                    className="w-full text-left px-3 py-2.5 hover:bg-surface-2 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-main">Ticto (API)</span>
                      <span className="text-[9px] font-mono text-success">AUTO via webhook</span>
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5">Forçar sync via OAuth (últimos 90 dias)</div>
                  </button>
                  <button
                    onClick={() => { setShowSyncMenu(false); handleSyncStripe(); }}
                    disabled={isSyncingStripe}
                    className="w-full text-left px-3 py-2.5 hover:bg-surface-2 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-main">Stripe</span>
                      <span className="text-[9px] font-mono text-success">AUTO via webhook</span>
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5">Forçar sync (saques + vendas)</div>
                  </button>
                </div>
              )}
            </div>
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
          CONTAS (CNPJ)
        </button>
        <button
          onClick={() => setActiveTab('cpf')}
          className={`px-6 py-4 text-[11px] font-mono tracking-[0.1em] uppercase transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'cpf'
              ? 'text-accent border-accent bg-accent/5'
              : 'text-text-muted border-transparent hover:text-text-main hover:bg-surface'
          }`}
        >
          CONTAS (CPF)
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
                  cursor={{ fill: '#ffffff0a' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d: any = payload[0].payload;
                    const [year, month, day] = String(label).split('-');
                    const fmt = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                    return (
                      <div className="bg-bg border border-border-subtle px-3 py-2 font-mono">
                        <div className="text-[10px] text-text-muted mb-1.5">{day}/{month}/{year}</div>
                        <div className="text-xs font-bold text-success mb-1">Total: {fmt(d.amount || 0)}</div>
                        {d.asaas !== 0 && (
                          <div className={`text-[10px] flex justify-between gap-3 ${d.asaas < 0 ? 'text-error' : 'text-success/80'}`}>
                            <span>● Asaas</span><span>{fmt(d.asaas)}</span>
                          </div>
                        )}
                        {d.ticto !== 0 && (
                          <div className={`text-[10px] flex justify-between gap-3 ${d.ticto < 0 ? 'text-error' : 'text-info'}`}>
                            <span>● Ticto{d.ticto < 0 ? ' (estorno)' : ''}</span><span>{fmt(d.ticto)}</span>
                          </div>
                        )}
                        {d.stripe !== 0 && (
                          <div className="text-[10px] flex justify-between gap-3" style={{ color: d.stripe < 0 ? '#EF4444' : '#635BFF' }}>
                            <span>● Stripe{d.stripe < 0 ? ' (estorno)' : ''}</span><span>{fmt(d.stripe)}</span>
                          </div>
                        )}
                        {d.manual !== 0 && (
                          <div className="text-[10px] text-text-muted flex justify-between gap-3">
                            <span>● Manual</span><span>{fmt(d.manual)}</span>
                          </div>
                        )}
                      </div>
                    );
                  }}
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
          {/* Header: 2 metric cards (Entradas + Saídas) + 3 botões de ação */}
          <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 max-w-2xl">
              {/* Card: Total Entradas Manuais */}
              <div className="bg-surface border border-border-subtle p-6 relative overflow-hidden group">
                <div className="absolute inset-0 bg-success/5 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500"></div>
                <div className="relative z-10">
                  <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-2 flex items-center gap-2">
                    <DollarSign className="w-3 h-3 text-success" />
                    Total Entradas Manuais
                  </div>
                  <div className="text-3xl font-black tracking-[-1px] text-success">
                    R$ {totalManualIncomes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Card: Total Despesas (CNPJ) */}
              <div className="bg-surface border border-border-subtle p-6 relative overflow-hidden group">
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
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsIncomeModalOpen(true)}
                className="bg-accent text-bg px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] hover:bg-accent/90 transition-colors flex items-center gap-2"
                title="Adicionar receita ou despesa (toggle dentro do modal)"
              >
                <Plus className="w-4 h-4" />
                Nova Transação
              </button>
            </div>
          </div>

          {/* Acordeão por mês — estilo PESSOAL: header full-width, expansão revela Entradas|Saídas dentro */}
          {allMonthBuckets.length === 0 ? (
            <div className="p-12 text-center text-sm font-mono text-text-muted uppercase border border-border-subtle bg-surface">
              Nenhuma movimentação registrada ainda. Use os botões acima pra adicionar.
            </div>
          ) : (
            <div className="space-y-8">
              {allMonthBuckets.map((m) => {
                const isOpen = isMonthExpanded(m.key);
                const saldo = m.totalIncome - m.totalExpense;
                return (
                  <div key={m.key} className="space-y-4">
                    {/* Header do mês — card destacado com resumo inline (entradas/saídas/saldo) */}
                    <button
                      onClick={() => toggleMonth(m.key)}
                      className={`w-full bg-surface border ${isOpen ? 'border-accent/40' : 'border-border-subtle'} p-5 hover:bg-surface-2/40 transition-all flex flex-col lg:flex-row lg:items-center gap-4 group`}
                    >
                      {/* Título do mês */}
                      <div className="flex items-center gap-3 lg:flex-1">
                        <ChevronDown className={`w-5 h-5 text-text-muted transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180 text-accent' : ''}`} />
                        <h3 className="text-2xl font-black tracking-tight text-white capitalize">{m.label}</h3>
                      </div>

                      {/* Resumo inline */}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-success text-sm">▲</span>
                          <span className="text-text-muted uppercase tracking-[0.05em] text-[10px]">Entradas</span>
                          <span className="font-bold text-success">
                            +R$ {m.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-danger text-sm">▼</span>
                          <span className="text-text-muted uppercase tracking-[0.05em] text-[10px]">Saídas</span>
                          <span className="font-bold text-danger">
                            -R$ {m.totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 lg:pl-4 lg:border-l lg:border-border-subtle">
                          <span className="text-text-muted uppercase tracking-[0.05em] text-[10px]">Saldo</span>
                          <span className={`text-lg font-black tracking-tight ${saldo >= 0 ? 'text-success' : 'text-danger'}`}>
                            {saldo >= 0 ? '+' : ''}R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                          {/* ENTRADAS deste mês */}
                          <div className="bg-surface border border-border-subtle overflow-hidden">
                            <div className="p-4 border-b border-border-subtle bg-surface-2/50 flex justify-between items-center">
                              <h4 className="text-xs font-bold uppercase tracking-[0.1em] text-success flex items-center gap-2">
                                <span>▲</span> Entradas
                              </h4>
                              <span className="text-[10px] font-mono text-text-muted">
                                {m.incomes.length} {m.incomes.length === 1 ? 'item' : 'itens'}
                              </span>
                            </div>
                            {m.incomes.length === 0 ? (
                              <div className="p-6 text-center text-xs font-mono text-text-muted">
                                Sem entradas neste mês.
                              </div>
                            ) : (
                              <div className="divide-y divide-border-subtle">
                                {m.incomes.map((tx) => {
                                  const isSaqueAsaas = tx.description.includes('[Saque Asaas]');
                                  const isSaqueTicto = tx.description.includes('[Saque Ticto]');
                                  const cleanDesc = tx.description
                                    .replace('[Receita] ', '')
                                    .replace('[Saque Asaas] ', '')
                                    .replace('[Saque Ticto] ', '')
                                    .replace(/\(ID: [^)]+\)\s*$/, '')
                                    .trim();
                                  return (
                                    <div
                                      key={tx.id}
                                      className="p-4 flex items-center justify-between hover:bg-surface-2/30 transition-colors group border-l-2 border-l-transparent hover:border-l-success/40"
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center border border-success/20 shrink-0">
                                          <DollarSign className="w-4 h-4 text-success" />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-sm font-bold text-white truncate flex items-center gap-2" title={cleanDesc}>
                                            {cleanDesc}
                                            {isSaqueAsaas && (
                                              <span className="text-[9px] bg-success/20 text-success px-1 rounded-sm font-bold" title="Saque do Asaas — sincronizado automaticamente">ASAAS</span>
                                            )}
                                            {isSaqueTicto && (
                                              <span className="text-[9px] bg-info/20 text-info px-1 rounded-sm font-bold" title="Saque do Ticto — registrado manualmente">TICTO</span>
                                            )}
                                          </div>
                                          <div className="text-[10px] font-mono text-text-muted">{formatDateBR(tx.date)}</div>
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0 ml-3 flex items-center gap-2">
                                        <div className="text-sm font-mono font-bold text-success">+ R$ {Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleEditIncome(tx); }}
                                            className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm"
                                            title="Editar"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteIncome(tx.id); }}
                                            className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-sm"
                                            title="Excluir"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {m.incomes.length > 0 && (
                              <div className="p-3 border-t border-border-subtle bg-surface-2/30 flex justify-between items-center">
                                <span className="text-[10px] font-mono uppercase text-text-muted tracking-[0.1em]">Total Entradas</span>
                                <span className="text-sm font-mono font-bold text-success">+ R$ {m.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}
                          </div>

                          {/* SAÍDAS deste mês — preserva grouping + sub-items + recurring + edit/delete */}
                          <div className="bg-surface border border-border-subtle overflow-hidden">
                            <div className="p-4 border-b border-border-subtle bg-surface-2/50 flex justify-between items-center gap-3">
                              <h4 className="text-xs font-bold uppercase tracking-[0.1em] text-danger flex items-center gap-2 shrink-0">
                                <span>▼</span> Saídas
                              </h4>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-[10px] font-mono text-text-muted">
                                  {m.expenseGroups.length} {m.expenseGroups.length === 1 ? 'grupo' : 'grupos'}
                                </span>
                                <label
                                  className={`bg-info text-bg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.05em] hover:bg-info/90 transition-colors flex items-center gap-1.5 cursor-pointer ${
                                    isImportingExpenses ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                  title="Importar CSV de fatura ou extrato bancário (datas vêm do CSV)"
                                >
                                  <Activity className={`w-3 h-3 ${isImportingExpenses ? 'animate-spin' : ''}`} />
                                  {isImportingExpenses ? 'Importando...' : 'Importar CSV'}
                                  <input
                                    type="file"
                                    accept=".csv,text/csv"
                                    onChange={handleExpenseImport}
                                    disabled={isImportingExpenses}
                                    className="hidden"
                                  />
                                </label>
                              </div>
                            </div>
                            {m.expenseGroups.length === 0 ? (
                              <div className="p-6 text-center text-xs font-mono text-text-muted">
                                Sem saídas neste mês.
                              </div>
                            ) : (
                              <div className="divide-y divide-border-subtle">
                                {m.expenseGroups.map((group) => {
                                  const [catName, catColor] = group.category.split('|');
                                  return (
                                    <div key={group.name} className="flex flex-col">
                                      <div
                                        className={`p-4 flex items-center justify-between hover:bg-surface-2/30 transition-colors group ${
                                          group.hasSubItems
                                            ? 'cursor-pointer bg-surface-2/20 border-l-2 border-l-accent/40 hover:border-l-accent'
                                            : 'border-l-2 border-l-transparent'
                                        }`}
                                        onClick={() => { if (group.hasSubItems) toggleProduct(`exp_${group.name}`); }}
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div className="w-9 h-9 rounded-full bg-danger/10 flex items-center justify-center border border-danger/20 shrink-0">
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
                                              <span>{formatDateBR(group.date)}</span>
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
                                        <div className="text-right shrink-0 ml-3 flex items-center gap-2">
                                          <div className={`text-sm font-mono font-bold ${group.total < 0 ? 'text-success' : 'text-danger'}`}>{group.total < 0 ? '+ ' : '- '}R$ {Math.abs(group.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                          {!group.hasSubItems ? (
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleAddSubItem(group); }}
                                                className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm"
                                                title="Adicionar Subitem"
                                              >
                                                <Plus className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleEditExpense(group.items[0]); }}
                                                className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm"
                                                title="Editar"
                                              >
                                                <Edit2 className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteExpense(group.items[0].id); }}
                                                className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-sm"
                                                title="Excluir"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="flex items-center justify-end gap-1">
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleAddSubItem(group); }}
                                                className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm opacity-0 group-hover:opacity-100"
                                                title="Adicionar Subitem"
                                              >
                                                <Plus className="w-3.5 h-3.5" />
                                              </button>
                                              <div className="text-text-muted text-xs ml-1">
                                                {expandedProducts[`exp_${group.name}`] ? '▼' : '▶'}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {group.hasSubItems && expandedProducts[`exp_${group.name}`] && (
                                        <div className="bg-surface-2/30 border-t border-border-subtle p-4 pl-12 space-y-3">
                                          {group.items.map((tx) => {
                                            const subName = tx.description.replace('[CNPJ] ', '').replace(`${group.name} - `, '');
                                            return (
                                              <div key={tx.id} className="flex items-center justify-between group/sub">
                                                <div className="min-w-0">
                                                  <div className="text-xs font-medium text-white/80 truncate" title={subName}>{subName}</div>
                                                  <div className="text-[10px] font-mono text-text-muted">{formatDateBR(tx.date)}</div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                  <div className={`text-xs font-mono font-bold ${Number(tx.amount) < 0 ? 'text-success/80' : 'text-danger/80'}`}>{Number(tx.amount) < 0 ? '+ ' : '- '}R$ {Math.abs(Number(tx.amount)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                  <div className="flex items-center gap-1">
                                                    <button
                                                      onClick={() => handleEditExpense(tx)}
                                                      className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm opacity-0 group-hover/sub:opacity-100"
                                                      title="Editar"
                                                    >
                                                      <Edit2 className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                      onClick={() => handleDeleteExpense(tx.id)}
                                                      className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-sm opacity-0 group-hover/sub:opacity-100"
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
                            {m.expenseGroups.length > 0 && (
                              <div className="p-3 border-t border-border-subtle bg-surface-2/30 flex justify-between items-center">
                                <span className="text-[10px] font-mono uppercase text-text-muted tracking-[0.1em]">Total Saídas</span>
                                <span className="text-sm font-mono font-bold text-danger">- R$ {m.totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
                {editingIncomeId ? 'Editar Transação' : 'Nova Transação'}
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

            {/* Toggle Receita/Despesa — só pra novas transações (em edit fica fixo no tipo original) */}
            {!editingIncomeId && (
              <div className="px-4 pt-4">
                <div className="flex bg-surface-2 border border-border-subtle p-1 gap-1">
                  <button
                    type="button"
                    className="flex-1 py-2 text-[10px] font-mono uppercase tracking-[0.1em] bg-success/20 text-success font-bold"
                  >
                    ▲ Receita
                  </button>
                  <button
                    type="button"
                    onClick={switchToExpense}
                    className="flex-1 py-2 text-[10px] font-mono uppercase tracking-[0.1em] text-text-muted hover:text-white hover:bg-surface-3 transition-colors"
                  >
                    ▼ Despesa
                  </button>
                </div>
              </div>
            )}

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
                {editingExpenseId ? 'Editar Transação' : 'Nova Transação'}
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

            {/* Toggle Receita/Despesa — só pra novas transações */}
            {!editingExpenseId && (
              <div className="px-6 pt-4">
                <div className="flex bg-surface-2 border border-border-subtle p-1 gap-1">
                  <button
                    type="button"
                    onClick={switchToIncome}
                    className="flex-1 py-2 text-[10px] font-mono uppercase tracking-[0.1em] text-text-muted hover:text-white hover:bg-surface-3 transition-colors"
                  >
                    ▲ Receita
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-2 text-[10px] font-mono uppercase tracking-[0.1em] bg-danger/20 text-danger font-bold"
                  >
                    ▼ Despesa
                  </button>
                </div>
              </div>
            )}

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

      {activeTab === 'cpf' && (
        <div className="animate-in fade-in duration-300">
          <Finances embedded />
        </div>
      )}

    </div>
  );
}
