import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Plus, Wallet, TrendingUp, Target, Coins, Activity, Calendar, DollarSign, X, Trash2, ChevronDown, ChevronUp, ChevronRight, MoreHorizontal, Edit2, Check, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';

type SubTab = 'overview' | 'transactions' | 'patrimony' | 'treasures' | 'sales';

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

let cachedStocks: any[] | null = null;
let cachedFiis: any[] | null = null;

interface FinancesProps {
  embedded?: boolean; // se true, mostra só a seção de Transações (sem header/sub-tabs)
}

export default function Finances({ embedded = false }: FinancesProps = {}) {
  const [activeTab, setActiveTab] = useState<SubTab>(embedded ? 'transactions' : 'overview');
  const [txTab, setTxTab] = useState<'income' | 'expense'>('expense');
  const [loading, setLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  
  // Modals state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isTreasureModalOpen, setIsTreasureModalOpen] = useState(false);

  // Data state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [treasures, setTreasures] = useState<Treasure[]>([]);

  // Período do gráfico Evolução Patrimonial
  const [patrimonyPeriod, setPatrimonyPeriod] = useState<'1M' | '3M' | '6M' | '1A'>('6M');

  // Form states - Transaction
  const [txType, setTxType] = useState<'income'|'expense'>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [txCategory, setTxCategory] = useState('Outros|#9CA3AF');
  const [txIsRecurring, setTxIsRecurring] = useState(false);
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [openTxMenuId, setOpenTxMenuId] = useState<string | null>(null);
  
  // Custom Tags state
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#F97316');
  const [customTags, setCustomTags] = useState<{name: string, color: string}[]>([]);
  const [isManageTagsModalOpen, setIsManageTagsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<{oldName: string, name: string, color: string} | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void} | null>(null);

  // Form states - Asset
  const [assetTicker, setAssetTicker] = useState('');
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState('Ação');
  const [assetQtd, setAssetQtd] = useState('');
  const [assetPm, setAssetPm] = useState('');
  const [assetCotacao, setAssetCotacao] = useState('');
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [openAssetMenuId, setOpenAssetMenuId] = useState<string | null>(null);
  
  // Patrimony Groups state
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (type: string) => {
    setExpandedGroups(prev => ({ ...prev, [type]: !prev[type] }));
  };

  // Form states - Treasure
  const [treasureTitle, setTreasureTitle] = useState('');
  const [treasureTarget, setTreasureTarget] = useState('');
  const [treasureCurrent, setTreasureCurrent] = useState('');
  const [treasureDeadline, setTreasureDeadline] = useState('');

  const [userId, setUserId] = useState<string | null>(null);
  const [isSyncingAsaas, setIsSyncingAsaas] = useState(false);
  const [isImportingFatura, setIsImportingFatura] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);
  const [expandedFaturaMonths, setExpandedFaturaMonths] = useState<Set<string>>(new Set());
  const [expandedFaturaVendors, setExpandedFaturaVendors] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id);
    });
  }, []);

  const existingTags = React.useMemo(() => {
    const tagsMap = new Map<string, string>();
    
    customTags.forEach(tag => {
      tagsMap.set(tag.name, tag.color);
    });

    transactions.forEach(t => {
      let cat = t.category;
      if (cat.endsWith('|recurring')) {
        cat = cat.replace('|recurring', '');
      }
      if (cat.includes('|')) {
        const [name, color] = cat.split('|');
        if (!tagsMap.has(name)) {
          tagsMap.set(name, color);
        }
      } else {
        if (!tagsMap.has(cat)) {
          tagsMap.set(cat, '#9CA3AF');
        }
      }
    });

    return Array.from(tagsMap.entries()).map(([name, color]) => ({ name, color }));
  }, [transactions, customTags]);

  useEffect(() => {
    fetchData();

    const handleRefresh = () => fetchData();
    window.addEventListener('app_data_changed', handleRefresh);
    return () => window.removeEventListener('app_data_changed', handleRefresh);
  }, []);

  useEffect(() => {
    const fetchPrice = async () => {
      if (!assetTicker || assetTicker.length < 3) return;
      
      setIsFetchingPrice(true);
      try {
        const ticker = assetTicker.toUpperCase();
        let newPrice = '';
        let newName = '';

        if (assetType === 'Ação') {
          if (!cachedStocks) {
            const res = await fetch('https://mfinance.com.br/api/v1/stocks');
            const data = await res.json();
            cachedStocks = data.stocks || [];
          }
          const stock = cachedStocks?.find((s: any) => s.symbol === ticker);
          if (stock && stock.lastPrice) {
            newPrice = stock.lastPrice.toString();
            newName = stock.name;
          }
        } else if (assetType === 'FII') {
          if (!cachedFiis) {
            const res = await fetch('https://mfinance.com.br/api/v1/fiis');
            const data = await res.json();
            cachedFiis = data.fiis || [];
          }
          const fii = cachedFiis?.find((f: any) => f.symbol === ticker);
          if (fii && fii.lastPrice) {
            newPrice = fii.lastPrice.toString();
            newName = fii.name;
          }
        } else if (assetType === 'Crypto') {
          const res = await fetch(`https://economia.awesomeapi.com.br/last/${ticker}-BRL`);
          const data = await res.json();
          const key = `${ticker}BRL`;
          if (data[key] && data[key].bid) {
            newPrice = parseFloat(data[key].bid).toFixed(2);
            newName = data[key].name.split('/')[0];
          }
        }

        if (newPrice) {
          setAssetCotacao(newPrice);
        }
        if (newName && !assetName) {
          setAssetName(newName);
        }
      } catch (error) {
        console.error('Error fetching price:', error);
      } finally {
        setIsFetchingPrice(false);
      }
    };

    const timeoutId = setTimeout(() => {
      fetchPrice();
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [assetTicker, assetType]);

  // -------- Importador de CSV de FATURA pessoal --------
  const parseCSV = (text: string): Array<Record<string, string>> => {
    const clean = text.replace(/^\uFEFF/, '').trim();
    const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const sep = lines[0].includes(';') ? ';' : ',';
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

  const handleFaturaImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !userId) return;
    setIsImportingFatura(true);
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
      const casaTag = customTags.find(t => t.name.toLowerCase() === 'casa');
      const defaultCategory = casaTag ? `${casaTag.name}|${casaTag.color}` : 'Outros|#9CA3AF';
      const res = await fetch('/api/expenses/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, rows, prefix: '[Fatura]', defaultCategory }),
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
      setIsImportingFatura(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

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

      if (txRes.data) {
        const tagsTx = txRes.data.find(t => t.description === '__FINANCIAL_TAGS__');
        if (tagsTx) {
          try {
            setCustomTags(JSON.parse(tagsTx.category));
          } catch (e) {
            console.error('Failed to parse tags', e);
          }
        } else {
          setCustomTags([
            { name: 'Empresa', color: '#E8A0BF' },
            { name: 'Sobrevivência', color: '#A3D9B1' },
            { name: 'Lazer', color: '#D9B873' },
            { name: 'Investimentos', color: '#60A5FA' },
            { name: 'Outros', color: '#9CA3AF' }
          ]);
        }

        const realTransactions = txRes.data.filter(t =>
          t.description !== '__FINANCIAL_TAGS__' &&
          !t.description.includes('[Asaas]') &&
          !t.description.includes('[Saque Asaas]') &&
          !t.description.includes('[CNPJ]') &&
          !t.description.includes('[Ticto]') &&
          !t.description.includes('[Saque Ticto]') &&
          !t.description.includes('[Stripe]') &&
          !t.description.includes('[Saque Stripe]') &&
          !t.description.includes('[Receita]')
        );
        setTransactions(realTransactions);
        
        // Auto-generate recurring transactions for current month
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const latestByDesc = new Map<string, Transaction>();
        
        realTransactions.forEach(t => {
          const existing = latestByDesc.get(t.description);
          if (!existing || new Date(t.date) > new Date(existing.date)) {
            latestByDesc.set(t.description, t);
          }
        });

        const newTransactionsToInsert: any[] = [];

        latestByDesc.forEach(tx => {
          if (tx.category.endsWith('|recurring')) {
            const [txYear, txMonth, txDay] = tx.date.split('-');
            const txDate = new Date(parseInt(txYear), parseInt(txMonth) - 1, parseInt(txDay));
            
            if (txDate.getFullYear() < currentYear || (txDate.getFullYear() === currentYear && txDate.getMonth() < currentMonth)) {
              const hasCurrentMonthTx = realTransactions.some(t => {
                const [tYear, tMonth, tDay] = t.date.split('-');
                const d = new Date(parseInt(tYear), parseInt(tMonth) - 1, parseInt(tDay));
                return t.description === tx.description && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
              });

              if (!hasCurrentMonthTx) {
                const newDate = new Date(currentYear, currentMonth, txDate.getDate());
                if (newDate.getMonth() !== currentMonth) {
                  newDate.setDate(0);
                }
                
                // Format to YYYY-MM-DD safely
                const yyyy = newDate.getFullYear();
                const mm = String(newDate.getMonth() + 1).padStart(2, '0');
                const dd = String(newDate.getDate()).padStart(2, '0');

                newTransactionsToInsert.push({
                  user_id: user.id,
                  description: tx.description,
                  category: tx.category,
                  amount: tx.amount,
                  type: tx.type,
                  date: `${yyyy}-${mm}-${dd}`
                });
              }
            }
          }
        });

        if (newTransactionsToInsert.length > 0) {
          // Re-check no DB imediatamente antes de inserir, pra blindar contra
          // race com outras chamadas de fetchData() concorrentes (ex: mount + app_data_changed)
          const descs = newTransactionsToInsert.map(t => t.description);
          const dates = newTransactionsToInsert.map(t => t.date);
          const { data: alreadyExist } = await supabase
            .from('financial_transactions')
            .select('description, date')
            .eq('user_id', user.id)
            .in('description', descs)
            .in('date', dates);

          const existingKeys = new Set(
            (alreadyExist || []).map((t: any) => `${t.description}|${t.date}`)
          );
          const safeToInsert = newTransactionsToInsert.filter(t =>
            !existingKeys.has(`${t.description}|${t.date}`)
          );

          if (safeToInsert.length > 0) {
            const { data, error } = await supabase
              .from('financial_transactions')
              .insert(safeToInsert)
              .select();

            if (!error && data) {
              setTransactions(prev => [...data, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            }
          }
        }
      }
      if (assetsRes.data) setAssets(assetsRes.data);
      if (treasuresRes.data) setTreasures(treasuresRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveTagsToDB = async (tags: {name: string, color: string}[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: selectError } = await supabase
        .from('financial_transactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('description', '__FINANCIAL_TAGS__');

      if (selectError) {
        console.error('Error selecting tags:', selectError);
        return;
      }

      if (data && data.length > 0) {
        // Update all existing tag rows to keep them in sync
        for (const row of data) {
          const { error: updateError } = await supabase
            .from('financial_transactions')
            .update({ category: JSON.stringify(tags) })
            .eq('id', row.id);
          if (updateError) console.error('Error updating tags:', updateError);
        }
      } else {
        const { error: insertError } = await supabase
          .from('financial_transactions')
          .insert({
            user_id: user.id,
            description: '__FINANCIAL_TAGS__',
            category: JSON.stringify(tags),
            amount: 0,
            type: 'expense',
            date: new Date().toISOString().split('T')[0]
          });
        if (insertError) console.error('Error inserting tags:', insertError);
      }
    } catch (e) {
      console.error('Error saving tags:', e);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    const newTag = { name: newTagName.trim(), color: newTagColor };
    const updatedTags = [...customTags, newTag];
    setCustomTags(updatedTags);
    await saveTagsToDB(updatedTags);
    setTxCategory(`${newTag.name}|${newTag.color}`);
    setIsCreatingTag(false);
  };

  const handleUpdateTag = async (oldName: string, newName: string, newColor: string) => {
    if (!newName.trim()) return;
    
    let updatedTags = customTags.map(t => t.name === oldName ? { name: newName.trim(), color: newColor } : t);
    if (!customTags.some(t => t.name === oldName)) {
      updatedTags.push({ name: newName.trim(), color: newColor });
    }
    setCustomTags(updatedTags);
    await saveTagsToDB(updatedTags);

    // Update all transactions that use the old tag
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const txsToUpdate = transactions.filter(t => {
      const cat = t.category.replace('|recurring', '');
      const [name] = cat.split('|');
      return name === oldName;
    });

    for (const tx of txsToUpdate) {
      const isRecurring = tx.category.endsWith('|recurring');
      const newCat = `${newName.trim()}|${newColor}${isRecurring ? '|recurring' : ''}`;
      await supabase
        .from('financial_transactions')
        .update({ category: newCat })
        .eq('id', tx.id);
    }
    
    setEditingTag(null);
    fetchData();
  };

  const handleDeleteTag = async (tagName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Tag',
      message: `Tem certeza que deseja excluir a tag "${tagName}"? As transações com esta tag serão movidas para "Outros".`,
      onConfirm: async () => {
        const updatedTags = customTags.filter(t => t.name !== tagName);
        setCustomTags(updatedTags);
        await saveTagsToDB(updatedTags);

        // Update all transactions that use the old tag to "Outros|#9CA3AF"
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const txsToUpdate = transactions.filter(t => {
          const cat = t.category.replace('|recurring', '');
          const [name] = cat.split('|');
          return name === tagName;
        });

        for (const tx of txsToUpdate) {
          const isRecurring = tx.category.endsWith('|recurring');
          const newCat = `Outros|#9CA3AF${isRecurring ? '|recurring' : ''}`;
          await supabase
            .from('financial_transactions')
            .update({ category: newCat })
            .eq('id', tx.id);
        }

        fetchData();
        setConfirmDialog(null);
      }
    });
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
      
      let finalCategory = txCategory;
      if (txIsRecurring && !finalCategory.endsWith('|recurring')) {
        finalCategory += '|recurring';
      } else if (!txIsRecurring && finalCategory.endsWith('|recurring')) {
        finalCategory = finalCategory.replace('|recurring', '');
      }

      const newTx = {
        user_id: user.id,
        description: txDesc,
        category: finalCategory,
        amount: txType === 'expense' ? -Math.abs(amount) : Math.abs(amount),
        type: txType,
        date: txDate
      };

      if (editingTxId) {
        const { data, error } = await supabase
          .from('financial_transactions')
          .update(newTx)
          .eq('id', editingTxId)
          .select()
          .single();
        if (error) throw error;
        setTransactions(prev => prev.map(t => t.id === editingTxId ? data : t).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } else {
        const { data, error } = await supabase
          .from('financial_transactions')
          .insert([newTx])
          .select()
          .single();
        if (error) throw error;
        setTransactions(prev => [data, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      }

      setIsTxModalOpen(false);
      setEditingTxId(null);
      setTxAmount('');
      setTxDesc('');
      setTxCategory('Outros|#9CA3AF');
      setTxIsRecurring(false);
      setTxDate(new Date().toISOString().split('T')[0]);
      setIsCreatingTag(false);
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Erro ao salvar transação.');
    }
  };

  const handleEditTx = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setTxType(tx.type);
    setTxAmount(Math.abs(tx.amount).toString());
    setTxDesc(tx.description);
    
    let cat = tx.category;
    if (cat.endsWith('|recurring')) {
      setTxIsRecurring(true);
      cat = cat.replace('|recurring', '');
    } else {
      setTxIsRecurring(false);
    }

    if (!cat.includes('|')) {
      const lower = cat.toLowerCase();
      if (lower === 'empresa') cat = `${cat}|#E8A0BF`;
      else if (lower === 'sobrevivência') cat = `${cat}|#A3D9B1`;
      else if (lower === 'lazer') cat = `${cat}|#D9B873`;
      else cat = `${cat}|#9CA3AF`;
    }
    setTxCategory(cat);
    
    setTxDate(tx.date);
    setIsTxModalOpen(true);
    setOpenTxMenuId(null);
    setIsCreatingTag(false);
  };

  const handleDeleteTx = async (id: string) => {
    const tx = transactions.find(t => t.id === id);
    const isRecurring = !!tx?.category.endsWith('|recurring');

    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Transação',
      message: isRecurring
        ? 'Esta transação é recorrente. Apagar vai DESATIVAR a recorrência: as ocorrências passadas continuam visíveis, mas o sistema para de gerar essa despesa nos próximos meses.'
        : 'Tem certeza que deseja excluir esta transação?',
      onConfirm: async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
          if (error) throw error;

          if (isRecurring && tx) {
            // Remove o sufixo |recurring de todas as outras ocorrências da mesma description.
            // Sem isso, o auto-gerador em fetchData() recria a transação no próximo carregamento.
            const { data: peers } = await supabase
              .from('financial_transactions')
              .select('id, category')
              .eq('user_id', user.id)
              .eq('description', tx.description)
              .like('category', '%|recurring');

            if (peers && peers.length > 0) {
              await Promise.all(
                peers.map((p: any) =>
                  supabase
                    .from('financial_transactions')
                    .update({ category: p.category.replace(/\|recurring$/, '') })
                    .eq('id', p.id)
                )
              );
            }

            setTransactions(prev => prev
              .filter(t => t.id !== id)
              .map(t =>
                t.description === tx.description && t.category.endsWith('|recurring')
                  ? { ...t, category: t.category.replace(/\|recurring$/, '') }
                  : t
              )
            );
          } else {
            setTransactions(prev => prev.filter(t => t.id !== id));
          }

          setOpenTxMenuId(null);
          setConfirmDialog(null);
        } catch (error) {
          console.error('Error deleting transaction:', error);
        }
      }
    });
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

      if (editingAssetId) {
        const { data, error } = await supabase
          .from('financial_assets')
          .update(newAsset)
          .eq('id', editingAssetId)
          .select()
          .single();
        if (error) throw error;
        setAssets(assets.map(a => a.id === editingAssetId ? data : a));
      } else {
        const { data, error } = await supabase.from('financial_assets').insert([newAsset]).select().single();
        if (error) throw error;
        setAssets([...assets, data]);
      }

      setIsAssetModalOpen(false);
      setEditingAssetId(null);
      setAssetTicker(''); setAssetName(''); setAssetQtd(''); setAssetPm(''); setAssetCotacao('');
    } catch (error) {
      console.error('Error saving asset:', error);
      alert('Erro ao salvar ativo. Verifique se a tabela financial_assets existe.');
    }
  };

  const handleEditAsset = (asset: Asset) => {
    setEditingAssetId(asset.id);
    setAssetTicker(asset.ticker);
    setAssetName(asset.name);
    setAssetType(asset.type);
    setAssetQtd(asset.qtd.toString());
    setAssetPm(asset.pm.toString());
    setAssetCotacao(asset.cotacao.toString());
    setIsAssetModalOpen(true);
    setOpenAssetMenuId(null);
  };

  const handleDeleteAsset = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Ativo',
      message: 'Tem certeza que deseja excluir este ativo?',
      onConfirm: async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { error } = await supabase.from('financial_assets').delete().eq('id', id);
          if (error) throw error;
          setAssets(assets.filter(a => a.id !== id));
          setOpenAssetMenuId(null);
          setConfirmDialog(null);
        } catch (error) {
          console.error('Error deleting asset:', error);
        }
      }
    });
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
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Tesouro',
      message: 'Tem certeza que deseja excluir este tesouro?',
      onConfirm: async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { error } = await supabase.from('financial_treasures').delete().eq('id', id);
          if (error) throw error;
          setTreasures(treasures.filter(t => t.id !== id));
          setConfirmDialog(null);
        } catch (error) {
          console.error('Error deleting treasure:', error);
        }
      }
    });
  };

  // --- Calculations ---
  const currentBalance = transactions.reduce((acc, curr) => acc + curr.amount, 0);
  
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  // Filtra apenas transações do TESOURO (sem prefixos de Vendas/CNPJ)
  const tesouroOnly = transactions.filter((t) => {
    const d = t.description || '';
    return !d.includes('[Asaas]') && !d.includes('[Saque Asaas]') && !d.includes('[Ticto]') && !d.includes('[Saque Ticto]') && !d.includes('[Stripe]') && !d.includes('[Saque Stripe]') && !d.includes('[Receita]') && !d.includes('[CNPJ]');
  });

  const currentMonthTxs = tesouroOnly.filter(t => {
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

  // Patrimônio mensal real: pra cada mês na janela escolhida (1M/3M/6M/1A),
  // calcula o saldo cumulativo de receitas - despesas até o último dia do mês,
  // somando o valor atual dos investimentos como linha de base (o histórico
  // de preço de ativo a gente não tem, então tratamos os ativos como
  // constantes — é o melhor que dá sem ferro de cotação histórica).
  const [snapshots, setSnapshots] = useState<{ date: string; total: number }[]>([]);

  const patrimonyHistory = useMemo(() => {
    const periodMap = { '1M': 30, '3M': 90, '6M': 180, '1A': 365 };
    const daysBack = periodMap[patrimonyPeriod];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);

    // Snapshots dentro do período, ordenados por data ascendente
    const filtered = snapshots
      .filter((s) => new Date(s.date) >= cutoff)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (filtered.length === 0) {
      // Sem histórico ainda — mostra ponto atual só
      const assetsTotal = assets.reduce((sum, a) => sum + Number(a.qtd || 0) * Number(a.cotacao || 0), 0);
      const cashTotal = transactions.reduce(
        (acc, t) => acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)),
        0,
      );
      const todayLabel = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
      return [{ month: todayLabel, total: cashTotal + assetsTotal }];
    }

    return filtered.map((s) => {
      const d = new Date(s.date);
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
      return { month: label, total: Number(s.total) };
    });
  }, [patrimonyPeriod, transactions, assets, snapshots]);

  // Carrega histórico de snapshots ao iniciar
  useEffect(() => {
    const loadSnapshots = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('patrimony_snapshots')
        .select('date, total')
        .eq('user_id', user.id)
        .order('date', { ascending: true });
      if (data) setSnapshots(data.map((d: any) => ({ date: d.date, total: Number(d.total) })));
    };
    loadSnapshots();
  }, []);

  // Salva snapshot do dia (upsert) sempre que assets/transactions mudarem
  const lastSnapshotRef = useRef<number>(0);
  useEffect(() => {
    if (assets.length === 0 && transactions.length === 0) return;
    const now = Date.now();
    // Evita salvar mais de uma vez por minuto (debounce simples)
    if (now - lastSnapshotRef.current < 60_000) return;
    lastSnapshotRef.current = now;

    const saveSnapshot = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const assetsTotal = assets.reduce((sum, a) => sum + Number(a.qtd || 0) * Number(a.cotacao || 0), 0);
      const cashTotal = transactions.reduce(
        (acc, t) => acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)),
        0,
      );
      const total = assetsTotal + cashTotal;
      const today = new Date().toISOString().split('T')[0];

      await supabase.from('patrimony_snapshots').upsert(
        { user_id: user.id, date: today, total, assets_total: assetsTotal, cash_total: cashTotal },
        { onConflict: 'user_id,date' },
      );
      // Atualiza estado local pro grafico refletir
      setSnapshots((prev) => {
        const filtered = prev.filter((s) => s.date !== today);
        return [...filtered, { date: today, total }].sort((a, b) => a.date.localeCompare(b.date));
      });
    };
    saveSnapshot();
  }, [assets, transactions]);

  const handleSync = async () => {
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
        setSyncMessage({ type: 'info', text: data.message || 'Nenhuma nova venda importada. As vendas podem já ter sido sincronizadas ou não há cobranças confirmadas.' });
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

  const renderSales = () => {
    const webhookUrl = userId ? `${window.location.origin}/api/webhook/asaas/${userId}` : 'Carregando...';

    const asaasTxs = transactions.filter(t => t.description.includes('[Asaas]'));
    const totalSales = asaasTxs.reduce((acc, curr) => acc + curr.amount, 0);
    const salesCount = asaasTxs.length;
    const averageTicket = salesCount > 0 ? totalSales / salesCount : 0;

    // Group by Product
    const productDataMap = new Map<string, number>();
    asaasTxs.forEach(tx => {
      // Try to clean up the description to group similar products (e.g., remove "Parcela X de Y. ")
      let product = 'Outros';
      const productMatch = tx.description.match(/\[Asaas\] (.*?)(?:\s*\(ID:|$)/);
      if (productMatch) {
        product = productMatch[1].trim();
        // Remove "Parcela X de Y. " prefix if it exists to group recurring payments better
        product = product.replace(/^Parcela \d+ de \d+\.\s*/i, '');
      }
      productDataMap.set(product, (productDataMap.get(product) || 0) + tx.amount);
    });
    
    let productData = Array.from(productDataMap.entries())
      .map(([name, value]) => {
        // Truncate very long product names
        const shortName = name.length > 40 ? name.substring(0, 40) + '...' : name;
        return { name: shortName, value };
      })
      .sort((a, b) => b.value - a.value);

    // Limit to top 5, group rest into "Outros"
    if (productData.length > 5) {
      const top5 = productData.slice(0, 5);
      const othersValue = productData.slice(5).reduce((sum, item) => sum + item.value, 0);
      
      // Check if "Outros" already exists in top 5
      const existingOutrosIndex = top5.findIndex(p => p.name === 'Outros');
      if (existingOutrosIndex >= 0) {
        top5[existingOutrosIndex].value += othersValue;
        productData = top5;
      } else {
        productData = [...top5, { name: 'Outros', value: othersValue }];
      }
    }

    // Group by Month
    const dateDataMap = new Map<string, number>();
    asaasTxs.forEach(tx => {
      const date = new Date(tx.date);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      dateDataMap.set(monthYear, (dateDataMap.get(monthYear) || 0) + tx.amount);
    });
    const dateData = Array.from(dateDataMap.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6'];

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Top Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-surface border border-border-subtle p-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-success/5 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500"></div>
            <div className="relative z-10">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-2 flex items-center gap-2">
                <DollarSign className="w-3 h-3 text-success" />
                Receita Total (Asaas)
              </div>
              <div className="text-3xl font-black text-success">R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
          <div className="bg-surface border border-border-subtle p-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-white/5 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500"></div>
            <div className="relative z-10">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-2 flex items-center gap-2">
                <Activity className="w-3 h-3 text-white" />
                Vendas Realizadas
              </div>
              <div className="text-3xl font-black text-white">{salesCount}</div>
            </div>
          </div>
          <div className="bg-surface border border-border-subtle p-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-accent/5 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500"></div>
            <div className="relative z-10">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-2 flex items-center gap-2">
                <Target className="w-3 h-3 text-accent" />
                Ticket Médio
              </div>
              <div className="text-3xl font-black text-accent">R$ {averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>

        {/* Charts */}
        {asaasTxs.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface border border-border-subtle p-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted mb-6">Receita por Produto</h3>
              <div className="h-64">
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
              </div>
            </div>

            <div className="bg-surface border border-border-subtle p-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted mb-6">Evolução da Receita</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dateData}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis dataKey="date" stroke="#666" fontSize={10} tickMargin={10} />
                    <YAxis stroke="#666" fontSize={10} tickFormatter={(value) => `R$${value}`} width={60} />
                    <Tooltip 
                      formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      contentStyle={{ backgroundColor: '#0A0A0A', borderColor: '#333', borderRadius: '0px' }}
                      labelStyle={{ color: '#888', fontSize: '10px', fontFamily: 'monospace', marginBottom: '4px' }}
                      itemStyle={{ color: '#10B981', fontSize: '12px', fontFamily: 'monospace' }}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Section: Latest Sales & Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-surface border border-border-subtle overflow-hidden h-full">
              <div className="p-4 border-b border-border-subtle bg-surface-2/50">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Últimas Vendas</h3>
              </div>
              {asaasTxs.length === 0 ? (
                <div className="p-8 text-center text-sm font-mono text-text-muted">
                  Nenhuma venda registrada ainda.
                </div>
              ) : (
                <div className="divide-y divide-border-subtle max-h-[500px] overflow-y-auto">
                  {asaasTxs.slice(0, 15).map(tx => {
                    // Clean up description
                    let cleanDesc = tx.description.replace('[Asaas] ', '').replace(/\(ID: .*\)/, '').trim();
                    cleanDesc = cleanDesc.replace(/^Parcela \d+ de \d+\.\s*/i, '');
                    
                    return (
                      <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-surface-2/30 transition-colors">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center border border-success/20 shrink-0">
                            <DollarSign className="w-4 h-4 text-success" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white truncate" title={cleanDesc}>
                              {cleanDesc}
                            </div>
                            <div className="text-[10px] font-mono text-text-muted">{new Date(tx.date).toLocaleDateString('pt-BR')}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <div className="text-sm font-mono font-bold text-success">
                            + R$ {Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] uppercase tracking-[0.1em] text-text-muted">Concluído</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface border border-border-subtle p-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted mb-6">Receita por Produto</h3>
              <div className="h-64">
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
              </div>
            </div>

            <div className="bg-surface border border-border-subtle p-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted mb-6">Evolução da Receita</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dateData}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis dataKey="date" stroke="#666" fontSize={10} tickMargin={10} />
                    <YAxis stroke="#666" fontSize={10} tickFormatter={(value) => `R$${value}`} width={60} />
                    <Tooltip 
                      formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      contentStyle={{ backgroundColor: '#0A0A0A', borderColor: '#333', borderRadius: '0px' }}
                      labelStyle={{ color: '#888', fontSize: '10px', fontFamily: 'monospace', marginBottom: '4px' }}
                      itemStyle={{ color: '#10B981', fontSize: '12px', fontFamily: 'monospace' }}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
              {(['1M', '3M', '6M', '1A'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setPatrimonyPeriod(period)}
                  className={`text-[9px] font-mono px-2 py-1 border transition-colors ${
                    patrimonyPeriod === period
                      ? 'border-accent text-accent bg-accent/10'
                      : 'border-border-subtle text-text-muted hover:border-text-muted'
                  }`}
                >
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

  const renderTransactions = () => {
    // TESOURO = visão financeira pessoal. Vendas (Asaas/Ticto/Receita) e despesas
    // CNPJ aparecem na aba VENDAS, então filtramos eles aqui pra não duplicar.
    const tesouroTransactions = transactions.filter((tx) => {
      const desc = tx.description || '';
      return (
        !desc.includes('[Asaas]') &&
        !desc.includes('[Saque Asaas]') &&
        !desc.includes('[Ticto]') &&
        !desc.includes('[Saque Ticto]') &&
        !desc.includes('[Stripe]') &&
        !desc.includes('[Saque Stripe]') &&
        !desc.includes('[Receita]') &&
        !desc.includes('[CNPJ]')
      );
    });

    const groupedTransactions = tesouroTransactions
      .reduce((acc, curr) => {
        // Parse date properly to avoid timezone issues
        const [year, month, day] = curr.date.split('-');
        const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        let monthYear = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        monthYear = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
        
        if (!acc[monthYear]) {
          acc[monthYear] = { incomes: [], expenses: [] };
        }
        
        if (curr.type === 'income') {
          acc[monthYear].incomes.push(curr);
        } else {
          acc[monthYear].expenses.push(curr);
        }
        
        return acc;
      }, {} as Record<string, { incomes: Transaction[], expenses: Transaction[] }>);

    const renderTxTable = (txs: Transaction[], title: string, type: 'income' | 'expense', monthYearKey?: string) => {
      const total = txs.reduce((sum, t) => sum + Math.abs(t.amount), 0);

      // Em SAÍDAS, agrupar tudo que tem prefixo [Fatura] em um dropdown único.
      const faturaTxs = type === 'expense'
        ? txs.filter(t => t.description.startsWith('[Fatura]'))
        : [];
      const regularTxs = type === 'expense'
        ? txs.filter(t => !t.description.startsWith('[Fatura]'))
        : txs;

      const renderRow = (t: Transaction, indent: 0 | 1 | 2 = 0, parentVendor?: string) => {
        const indentClass = indent === 1 ? 'pl-8' : indent === 2 ? 'pl-14' : '';
        let displayDesc = t.description;
        if (indent > 0) {
          displayDesc = displayDesc.replace(/^\[Fatura\]\s*/, '');
        }
        if (indent === 2 && parentVendor && displayDesc.startsWith(parentVendor)) {
          const rest = displayDesc.slice(parentVendor.length).trim();
          if (rest.startsWith('-')) {
            displayDesc = `Parcela ${rest.replace(/^-\s*/, '')}`;
          } else {
            displayDesc = '—';
          }
        }
        return (
          <div key={t.id} className={`grid grid-cols-12 gap-2 p-3 items-center hover:bg-surface transition-colors group text-xs ${indentClass}`}>
            <div className="col-span-3 text-text-muted font-mono truncate">
              {new Date(t.date + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </div>
            <div className="col-span-4 flex items-center gap-2 text-text-main truncate">
              <span className={`truncate ${displayDesc === '—' ? 'text-text-muted' : ''}`}>{displayDesc}</span>
              {t.category.endsWith('|recurring') && (
                <span className="text-[9px] bg-accent/20 text-accent px-1 rounded-sm font-bold" title="Recorrente">R</span>
              )}
            </div>
            <div className="col-span-2 font-mono truncate">
              R${Math.abs(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="col-span-2 truncate">
              {(() => {
                let catName = t.category;
                let catColor = '#9CA3AF';
                if (t.category.includes('|')) {
                  [catName, catColor] = t.category.split('|');
                } else {
                  const lower = t.category.toLowerCase();
                  if (lower === 'empresa') catColor = '#E8A0BF';
                  else if (lower === 'sobrevivência') catColor = '#A3D9B1';
                  else if (lower === 'lazer') catColor = '#D9B873';
                }
                return (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium truncate max-w-full"
                    style={{ backgroundColor: `${catColor}30`, color: catColor }}
                  >
                    {catName}
                  </span>
                );
              })()}
            </div>
            <div className="col-span-1 flex items-center justify-end relative">
              <button
                onClick={() => setOpenTxMenuId(openTxMenuId === t.id ? null : t.id)}
                className="text-text-muted hover:text-text-main p-1 rounded hover:bg-surface-3 transition-colors opacity-0 group-hover:opacity-100"
              >
                <MoreHorizontal className="w-3 h-3" />
              </button>

              {openTxMenuId === t.id && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpenTxMenuId(null)}></div>
                  <div className="absolute right-6 top-0 w-28 bg-surface-2 border border-border-subtle shadow-xl z-20 py-1 rounded">
                    <button onClick={() => { handleEditTx(t); setOpenTxMenuId(null); }} className="w-full text-left px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.1em] text-text-main hover:bg-surface-3 flex items-center gap-2">
                      <Edit2 className="w-3 h-3" /> Editar
                    </button>
                    <button onClick={() => { handleDeleteTx(t.id); setOpenTxMenuId(null); }} className="w-full text-left px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.1em] text-error hover:bg-error/10 flex items-center gap-2">
                      <Trash2 className="w-3 h-3" /> Excluir
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      };

      const renderFaturaGroup = () => {
        if (faturaTxs.length === 0 || !monthYearKey) return null;

        const faturaTotal = faturaTxs.reduce((s, t) => s + Math.abs(t.amount), 0);
        const isExpanded = expandedFaturaMonths.has(monthYearKey);

        const byVendor = new Map<string, Transaction[]>();
        faturaTxs.forEach(t => {
          const vendor = t.description
            .replace(/^\[Fatura\]\s*/, '')
            .replace(/\s+-\s+\d+$/, '')
            .trim() || 'Sem nome';
          if (!byVendor.has(vendor)) byVendor.set(vendor, []);
          byVendor.get(vendor)!.push(t);
        });
        const sortedVendors = Array.from(byVendor.entries())
          .map(([vendor, items]) => ({
            vendor,
            items,
            total: items.reduce((s, t) => s + Math.abs(t.amount), 0)
          }))
          .sort((a, b) => b.total - a.total);

        const earliestDate = faturaTxs.reduce<string | null>((min, t) =>
          !min || t.date < min ? t.date : min, null
        );

        const sampleCat = faturaTxs[0].category;
        let catName = 'CASA';
        let catColor = '#A3D9B1';
        if (sampleCat.includes('|')) {
          const parts = sampleCat.split('|');
          catName = parts[0];
          catColor = parts[1] || catColor;
        }

        return (
          <>
            <div
              onClick={() => setExpandedFaturaMonths(prev => {
                const next = new Set(prev);
                if (next.has(monthYearKey)) next.delete(monthYearKey);
                else next.add(monthYearKey);
                return next;
              })}
              className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-surface transition-colors group text-xs cursor-pointer bg-surface-3/20"
            >
              <div className="col-span-3 text-text-muted font-mono truncate">
                {earliestDate && new Date(earliestDate + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </div>
              <div className="col-span-4 flex items-center gap-2 text-text-main truncate">
                {isExpanded ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                <span className="truncate font-bold">Fatura ({faturaTxs.length} {faturaTxs.length === 1 ? 'item' : 'itens'})</span>
              </div>
              <div className="col-span-2 font-mono truncate font-bold">
                R${faturaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="col-span-2 truncate">
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium truncate max-w-full"
                  style={{ backgroundColor: `${catColor}30`, color: catColor }}
                >
                  {catName}
                </span>
              </div>
              <div className="col-span-1"></div>
            </div>

            {isExpanded && sortedVendors.map(({ vendor, items, total: vTotal }) => {
              const vendorKey = `${monthYearKey}::${vendor}`;
              const isVendorExpanded = expandedFaturaVendors.has(vendorKey);

              if (items.length === 1) {
                return renderRow(items[0], 1, vendor);
              }

              const vendorEarliestDate = items.reduce<string | null>((min, t) =>
                !min || t.date < min ? t.date : min, null
              );

              return (
                <React.Fragment key={vendor}>
                  <div
                    onClick={() => setExpandedFaturaVendors(prev => {
                      const next = new Set(prev);
                      if (next.has(vendorKey)) next.delete(vendorKey);
                      else next.add(vendorKey);
                      return next;
                    })}
                    className="grid grid-cols-12 gap-2 p-3 items-center hover:bg-surface transition-colors group text-xs cursor-pointer pl-8"
                  >
                    <div className="col-span-3 text-text-muted font-mono truncate">
                      {vendorEarliestDate && new Date(vendorEarliestDate + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </div>
                    <div className="col-span-4 flex items-center gap-2 text-text-main truncate">
                      {isVendorExpanded ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                      <span className="truncate">{vendor} ({items.length} itens)</span>
                    </div>
                    <div className="col-span-2 font-mono truncate">
                      R${vTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="col-span-2"></div>
                    <div className="col-span-1"></div>
                  </div>
                  {isVendorExpanded && items.map(t => renderRow(t, 2, vendor))}
                </React.Fragment>
              );
            })}
          </>
        );
      };

      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h4 className={`text-sm font-mono uppercase tracking-[0.1em] ${type === 'income' ? 'text-success' : 'text-error'}`}>
              {title}
            </h4>
            {type === 'expense' && (
              <label
                className={`bg-info text-bg px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-info/90 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isImportingFatura ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title="Importar CSV de fatura de cartão / extrato bancário (entra como CASA)"
              >
                <Activity className={`w-3 h-3 ${isImportingFatura ? 'animate-spin' : ''}`} />
                {isImportingFatura ? 'Importando...' : 'Importar Fatura (CSV)'}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFaturaImport}
                  disabled={isImportingFatura}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <div className="bg-surface-2 border border-border-subtle rounded-sm flex-1 flex flex-col">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 p-3 border-b border-border-subtle bg-surface-3/30 text-[10px] font-mono text-text-muted uppercase tracking-[0.05em]">
              <div className="col-span-3">Data</div>
              <div className="col-span-4">Origem</div>
              <div className="col-span-2">Valor</div>
              <div className="col-span-2">Categoria</div>
              <div className="col-span-1 text-right">Ações</div>
            </div>

            {/* Body */}
            <div className="divide-y divide-border-subtle flex-1">
              {txs.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-text-muted uppercase">Nenhuma transação</div>
              ) : (
                <>
                  {renderFaturaGroup()}
                  {regularTxs.map(t => renderRow(t, 0))}
                </>
              )}
            </div>

            {/* Footer / Total */}
            <div className="p-3 border-t border-border-subtle bg-surface-3/10 flex justify-between items-center">
              <span className="text-[10px] font-mono uppercase text-text-muted">Total {title}</span>
              <span className={`font-mono text-sm font-bold ${type === 'income' ? 'text-success' : 'text-error'}`}>
                R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Transações</h2>
            <p className="text-xs font-mono text-text-muted mt-1">Gerencie suas entradas e saídas</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setEditingTxId(null);
                setTxAmount('');
                setTxDesc('');
                setTxCategory('Outros|#9CA3AF');
                setTxIsRecurring(false);
                setTxDate(new Date().toISOString().split('T')[0]);
                setIsTxModalOpen(true);
                setIsCreatingTag(false);
              }} 
              className="btn-primary !bg-accent hover:!bg-accent/80 !text-black flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              NOVA TRANSAÇÃO
            </button>
          </div>
        </div>

        {Object.keys(groupedTransactions).length === 0 ? (
          <div className="p-12 text-center text-sm font-mono text-text-muted uppercase border border-border-subtle bg-surface-2">
            Nenhuma transação encontrada.
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(groupedTransactions).map(([monthYear, data]) => {
              const totalIncome = data.incomes.reduce((sum, t) => sum + Math.abs(t.amount), 0);
              const totalExpense = data.expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
              const netBalance = totalIncome - totalExpense;
              
              const isExpanded = expandedMonths[monthYear] !== false; // Default to true

              return (
                <div key={monthYear} className="space-y-6">
                  <div 
                    className="flex justify-between items-center border-b border-border-subtle pb-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setExpandedMonths(prev => ({ ...prev, [monthYear]: !isExpanded }))}
                  >
                    <h3 className="text-2xl font-bold tracking-tight text-text-main capitalize">{monthYear}</h3>
                    <ChevronDown className={`w-6 h-6 text-text-muted transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                  
                  {isExpanded && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {renderTxTable(data.incomes, 'Entradas', 'income', monthYear)}
                        {renderTxTable(data.expenses, 'Saídas', 'expense', monthYear)}
                      </div>
                      
                      {/* Resumo do Mês */}
                      <div className="bg-surface-2 border border-border-subtle p-4 rounded-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                        <span className="text-xs font-mono uppercase text-text-muted tracking-[0.1em]">
                          Resultado do Mês
                        </span>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-text-muted uppercase">Entradas:</span>
                            <span className="text-xs font-mono text-success">R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <span className="text-border-subtle">|</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-text-muted uppercase">Saídas:</span>
                            <span className="text-xs font-mono text-error">R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <span className="text-border-subtle">|</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-text-muted uppercase">Saldo:</span>
                            <span className={`text-lg font-mono font-bold ${netBalance >= 0 ? 'text-success' : 'text-error'}`}>
                              {netBalance >= 0 ? '+' : ''}R$ {netBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
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
    );
  };

  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null);

  // silent=true: sem alert, usado pelo auto-refresh
  const handleUpdatePrices = async (silent: boolean = false) => {
    setIsUpdatingPrices(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!silent) alert('Você está no Modo Teste. Faça login para atualizar cotações automaticamente.');
        setIsUpdatingPrices(false);
        return;
      }

      // Fetch all stocks and FIIs
      const [stocksRes, fiisRes] = await Promise.all([
        fetch('https://mfinance.com.br/api/v1/stocks').then(r => r.json()).catch(() => ({ stocks: [] })),
        fetch('https://mfinance.com.br/api/v1/fiis').then(r => r.json()).catch(() => ({ fiis: [] }))
      ]);

      const stocksData = stocksRes.stocks || [];
      const fiisData = fiisRes.fiis || [];

      let updatedCount = 0;

      for (const asset of assets) {
        let newPrice = asset.cotacao;
        const ticker = asset.ticker.toUpperCase();

        if (asset.type === 'Ação') {
          const stock = stocksData.find((s: any) => s.symbol === ticker);
          if (stock && stock.lastPrice) newPrice = stock.lastPrice;
        } else if (asset.type === 'FII') {
          const fii = fiisData.find((f: any) => f.symbol === ticker);
          if (fii && fii.lastPrice) newPrice = fii.lastPrice;
        } else if (asset.type === 'Crypto') {
          try {
            // Try awesomeapi for crypto (e.g., BTC-BRL)
            const cryptoRes = await fetch(`https://economia.awesomeapi.com.br/last/${ticker}-BRL`);
            const cryptoData = await cryptoRes.json();
            const key = `${ticker}BRL`;
            if (cryptoData[key] && cryptoData[key].bid) {
              newPrice = parseFloat(cryptoData[key].bid);
            }
          } catch (e) {
            console.error(`Failed to fetch crypto ${ticker}`, e);
          }
        }

        if (newPrice !== asset.cotacao) {
          const { error } = await supabase
            .from('financial_assets')
            .update({ cotacao: newPrice })
            .eq('id', asset.id);
          
          if (!error) {
            updatedCount++;
          }
        }
      }

      if (updatedCount > 0) {
        await fetchData(); // Refresh data
        if (!silent) alert(`${updatedCount} cotações atualizadas com sucesso!`);
      } else if (!silent) {
        alert('Nenhuma cotação precisou ser atualizada ou tickers não encontrados.');
      }
      setLastPriceUpdate(new Date());

    } catch (error) {
      console.error('Error updating prices:', error);
      if (!silent) alert('Erro ao atualizar cotações.');
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  // Auto-refresh de cotações: 1ª chamada quando assets carregam, depois a cada 5 min.
  // Roda em background sem alert.
  const autoUpdateRanRef = useRef(false);
  useEffect(() => {
    if (assets.length === 0) return;
    if (!autoUpdateRanRef.current) {
      autoUpdateRanRef.current = true;
      handleUpdatePrices(true);
    }
    const interval = setInterval(() => {
      handleUpdatePrices(true);
    }, 5 * 60 * 1000); // 5 min
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets.length]);

  const renderPatrimony = () => {
    const totalCurrentPatrimony = assets.reduce((acc, curr) => acc + (curr.qtd * curr.cotacao), 0);
    const totalInvestedPatrimony = assets.reduce((acc, curr) => acc + (curr.qtd * curr.pm), 0);
    
    const groupedAssets = assets.reduce((acc, asset) => {
      if (!acc[asset.type]) acc[asset.type] = [];
      acc[asset.type].push(asset);
      return acc;
    }, {} as Record<string, Asset[]>);

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">
              Carteira de Investimentos <span className="text-text-muted text-sm font-mono">({assets.length})</span>
            </h2>
            <p className="text-xs font-mono text-text-muted mt-1">Ativos, cotações e rentabilidade</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => handleUpdatePrices(false)}
              disabled={isUpdatingPrices}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              <Activity className={`w-4 h-4 ${isUpdatingPrices ? 'animate-spin' : ''}`} />
              {isUpdatingPrices ? 'ATUALIZANDO...' : 'ATUALIZAR COTAÇÕES'}
            </button>
            <button 
              onClick={() => {
                setEditingAssetId(null);
                setAssetTicker(''); setAssetName(''); setAssetQtd(''); setAssetPm(''); setAssetCotacao('');
                setIsAssetModalOpen(true);
              }} 
              className="btn-primary !bg-accent hover:!bg-accent/80 !text-black flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              ADICIONAR ATIVO
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {Object.entries(groupedAssets).map(([type, groupAssets]) => {
            const groupInvested = groupAssets.reduce((acc, curr) => acc + (curr.qtd * curr.pm), 0);
            const groupCurrent = groupAssets.reduce((acc, curr) => acc + (curr.qtd * curr.cotacao), 0);
            const groupVariation = groupInvested > 0 ? ((groupCurrent - groupInvested) / groupInvested) * 100 : 0;
            const groupPercent = totalCurrentPatrimony > 0 ? (groupCurrent / totalCurrentPatrimony) * 100 : 0;
            const isPositive = groupVariation >= 0;
            const isExpanded = expandedGroups[type];

            return (
              <div key={type} className="bg-surface-2 border border-border-subtle rounded-lg overflow-hidden">
                {/* Group Header */}
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-surface-3/30 transition-colors"
                  onClick={() => toggleGroup(type)}
                >
                  <div className="flex items-center gap-3 w-1/4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${groupAssets[0]?.color}`}>
                      <Wallet className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-lg uppercase tracking-[-0.5px]">{type}</span>
                  </div>

                  <div className="flex items-center justify-between flex-1 px-4">
                    <div className="text-center">
                      <div className="text-[10px] font-mono text-text-muted uppercase mb-1">Ativos</div>
                      <div className="font-bold">{groupAssets.length}</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-[10px] font-mono text-text-muted uppercase mb-1">Valor Total</div>
                      <div className="font-bold">R$ {groupCurrent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>

                    <div className="text-center">
                      <div className="text-[10px] font-mono text-text-muted uppercase mb-1">Valorização</div>
                      <div className={`font-bold ${isPositive ? 'text-success' : 'text-error'}`}>
                        {isPositive ? '+' : ''}R$ {(groupCurrent - groupInvested).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-[10px] font-mono text-text-muted uppercase mb-1">Variação</div>
                      <div className={`font-bold flex items-center justify-center gap-1 ${isPositive ? 'text-success' : 'text-error'}`}>
                        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {Math.abs(groupVariation).toFixed(2)}%
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-[10px] font-mono text-text-muted uppercase mb-1">% na Carteira</div>
                      <div className="font-bold text-text-muted">{groupPercent.toFixed(2)}%</div>
                    </div>
                  </div>

                  <div className="w-10 flex justify-end">
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-text-muted" /> : <ChevronDown className="w-5 h-5 text-text-muted" />}
                  </div>
                </div>

                {/* Group Content (Table) */}
                {isExpanded && (
                  <div className="border-t border-border-subtle bg-surface overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border-subtle bg-surface-3/20">
                          <th className="p-3 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] font-normal">Ativo</th>
                          <th className="p-3 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] font-normal text-right">Quant.</th>
                          <th className="p-3 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] font-normal text-right">Preço Médio</th>
                          <th className="p-3 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] font-normal text-right">Preço Atual</th>
                          <th className="p-3 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] font-normal text-right">Saldo Total</th>
                          <th className="p-3 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] font-normal text-right">Valorização</th>
                          <th className="p-3 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] font-normal text-right">Variação</th>
                          <th className="p-3 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] font-normal text-right">% Carteira</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {groupAssets.map(asset => {
                          const valorInvestido = asset.qtd * asset.pm;
                          const valorAtual = asset.qtd * asset.cotacao;
                          const saldo = valorAtual - valorInvestido;
                          const variacao = asset.pm > 0 ? ((asset.cotacao - asset.pm) / asset.pm) * 100 : 0;
                          const percentCarteira = totalCurrentPatrimony > 0 ? (valorAtual / totalCurrentPatrimony) * 100 : 0;
                          const isAssetPositive = variacao >= 0;

                          return (
                            <tr key={asset.id} className="hover:bg-surface-2 transition-colors group">
                              <td className="p-3">
                                <div className="flex items-center gap-3">
                                  <div className={`w-6 h-6 rounded flex items-center justify-center border text-[10px] font-bold ${asset.color}`}>
                                    {asset.ticker.substring(0, 2)}
                                  </div>
                                  <div>
                                    <div className="font-bold text-sm uppercase text-text-main">{asset.ticker}</div>
                                    <div className="text-[10px] font-mono text-text-muted">{asset.name}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-right font-mono text-sm text-text-muted">{asset.qtd}</td>
                              <td className="p-3 text-right font-mono text-sm text-text-muted">R$ {asset.pm.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="p-3 text-right font-mono text-sm text-text-main">R$ {asset.cotacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="p-3 text-right font-mono text-sm font-bold text-text-main">R$ {valorAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className={`p-3 text-right font-mono text-sm font-bold ${saldo >= 0 ? 'text-success' : 'text-error'}`}>
                                {saldo >= 0 ? '+' : ''}R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-right">
                                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${isAssetPositive ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                                  {isAssetPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                  {Math.abs(variacao).toFixed(2)}%
                                </div>
                              </td>
                              <td className="p-3 text-right font-mono text-sm text-text-muted">{percentCarteira.toFixed(2)}%</td>
                              <td className="p-3 text-right relative">
                                <button 
                                  onClick={() => setOpenAssetMenuId(openAssetMenuId === asset.id ? null : asset.id)} 
                                  className="text-text-muted hover:text-text-main p-1 rounded hover:bg-surface-3 transition-colors"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                                
                                {openAssetMenuId === asset.id && (
                                  <>
                                    <div 
                                      className="fixed inset-0 z-10" 
                                      onClick={() => setOpenAssetMenuId(null)}
                                    ></div>
                                    <div className="absolute right-8 top-8 w-32 bg-surface-2 border border-border-subtle shadow-xl z-20 py-1 rounded">
                                      <button 
                                        onClick={() => handleEditAsset(asset)}
                                        className="w-full text-left px-4 py-2 text-xs font-mono uppercase tracking-[0.1em] text-text-main hover:bg-surface-3 flex items-center gap-2 transition-colors"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                        Editar
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteAsset(asset.id)}
                                        className="w-full text-left px-4 py-2 text-xs font-mono uppercase tracking-[0.1em] text-error hover:bg-error/10 flex items-center gap-2 transition-colors"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                        Excluir
                                      </button>
                                    </div>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {assets.length === 0 && (
            <div className="p-12 text-center text-xs font-mono text-text-muted uppercase border border-border-subtle bg-surface-2">
              Nenhum ativo registrado.
            </div>
          )}
        </div>
      </div>
    );
  };

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

  // Modo embedded: só renderiza a aba de transações, sem hero nem sub-tabs
  if (embedded) {
    return (
      <div className="space-y-8 pb-12 relative">
        {renderTransactions()}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 relative">
      {/* Hero Section */}
      <section className="relative border-b border-border-subtle pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
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
        
        <div className="relative z-10 flex items-center gap-4">
          {syncMessage && (
            <div className={`text-xs px-3 py-1.5 rounded-sm font-medium ${
              syncMessage.type === 'success' ? 'bg-success/20 text-success' : 
              syncMessage.type === 'error' ? 'bg-danger/20 text-danger' : 
              'bg-accent/20 text-accent'
            }`}>
              {syncMessage.text}
            </div>
          )}
          <button 
            onClick={handleSync}
            disabled={isSyncingAsaas}
            className="bg-surface-2 border border-border-subtle text-text-main px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] hover:bg-surface-3 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Activity className={`w-4 h-4 ${isSyncingAsaas ? 'animate-spin' : ''}`} />
            {isSyncingAsaas ? 'Sincronizando...' : 'Sincronizar Asaas'}
          </button>
        </div>
      </section>

      {/* Sub-Navegação Interna */}
      <div className="flex border-b border-border-subtle overflow-x-auto hide-scrollbar">
        {(['overview', 'patrimony', 'treasures'] as SubTab[]).map((tab) => (
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
      
      {/* Confirm Dialog Modal */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-sm border border-border-subtle shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-lg font-black tracking-[-1px] text-white mb-2">{confirmDialog.title}</h3>
              <p className="text-sm font-mono text-text-muted mb-6">{confirmDialog.message}</p>
              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-[0.1em] text-text-muted hover:text-white hover:bg-surface-3 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDialog.onConfirm}
                  className="px-4 py-2 text-xs font-mono font-bold uppercase tracking-[0.1em] text-black bg-error hover:bg-error/80 transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Transação */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-surface-2 border border-border-subtle w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-border-subtle bg-surface-3/50">
              <h3 className="text-sm font-bold uppercase tracking-[0.1em]">{editingTxId ? 'Editar Transação' : 'Nova Transação'}</h3>
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

              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="txIsRecurring" 
                  checked={txIsRecurring} 
                  onChange={e => setTxIsRecurring(e.target.checked)} 
                  className="w-4 h-4 bg-surface border border-border-subtle text-accent focus:ring-accent rounded-sm"
                />
                <label htmlFor="txIsRecurring" className="text-[10px] font-mono text-text-main uppercase tracking-[0.1em] cursor-pointer">
                  Transação Recorrente (Mensal)
                </label>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2">Categoria (Tag)</label>
                {!isCreatingTag ? (
                  <div className="flex gap-2">
                    <select 
                      value={txCategory} 
                      onChange={e => {
                        if (e.target.value === 'NEW') {
                          setIsCreatingTag(true);
                          setNewTagName('');
                          setNewTagColor('#F97316');
                        } else {
                          setTxCategory(e.target.value);
                        }
                      }} 
                      className="flex-1 bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors uppercase"
                    >
                      {existingTags.map(tag => (
                        <option key={tag.name} value={`${tag.name}|${tag.color}`}>
                          {tag.name}
                        </option>
                      ))}
                      <option value="NEW">+ Criar nova tag...</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsManageTagsModalOpen(true)}
                      className="px-3 py-3 bg-surface border border-border-subtle text-text-muted hover:text-accent hover:border-accent transition-colors flex items-center justify-center"
                      title="Gerenciar Tags"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 items-center bg-surface border border-border-subtle p-2">
                    <input 
                      type="color" 
                      value={newTagColor} 
                      onChange={e => setNewTagColor(e.target.value)}
                      className="w-10 h-10 p-1 bg-transparent border-none cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={newTagName} 
                      onChange={e => setNewTagName(e.target.value)}
                      placeholder="NOME DA TAG"
                      className="flex-1 bg-transparent border-none text-sm font-mono text-text-main focus:outline-none uppercase"
                      autoFocus
                    />
                    <button 
                      type="button"
                      onClick={handleCreateTag}
                      className="p-2 text-success hover:bg-success/10 rounded transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsCreatingTag(false)}
                      className="p-2 text-text-muted hover:text-error hover:bg-error/10 rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <button type="submit" className={`w-full py-4 text-[11px] font-mono font-bold uppercase tracking-[0.1em] transition-colors ${txType === 'income' ? 'bg-success hover:bg-success/80 text-black' : 'bg-error hover:bg-error/80 text-black'}`}>
                {editingTxId ? 'SALVAR ALTERAÇÕES' : `REGISTRAR ${txType === 'income' ? 'RECEITA' : 'DESPESA'}`}
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
              <h3 className="text-sm font-bold uppercase tracking-[0.1em]">{editingAssetId ? 'Editar Ativo' : 'Adicionar Ativo'}</h3>
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
                <label className="block text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-2 flex items-center gap-2">
                  Cotação Atual (R$)
                  {isFetchingPrice && <Activity className="w-3 h-3 text-accent animate-spin" />}
                </label>
                <input type="number" step="0.01" required value={assetCotacao} onChange={e => setAssetCotacao(e.target.value)} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm font-mono text-text-main focus:outline-none focus:border-accent transition-colors" placeholder="0.00" />
              </div>
              <button type="submit" className="w-full py-4 text-[11px] font-mono font-bold uppercase tracking-[0.1em] transition-colors bg-accent hover:bg-accent/80 text-black mt-4">
                {editingAssetId ? 'SALVAR ALTERAÇÕES' : 'SALVAR ATIVO'}
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

      {/* Manage Tags Modal */}
      {isManageTagsModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-md border border-border-subtle shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between p-4 border-b border-border-subtle">
              <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-text-main">
                <Settings className="w-4 h-4 text-accent" />
                GERENCIAR TAGS
              </div>
              <button onClick={() => setIsManageTagsModalOpen(false)} className="text-text-muted hover:text-text-main transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
              {existingTags.length === 0 ? (
                <div className="text-center text-xs text-text-muted font-mono uppercase py-4">Nenhuma tag encontrada.</div>
              ) : (
                existingTags.map(tag => (
                  <div key={tag.name} className="flex items-center justify-between p-3 border border-border-subtle bg-surface-2">
                    {editingTag?.oldName === tag.name ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input 
                          type="color" 
                          value={editingTag.color} 
                          onChange={e => setEditingTag({ ...editingTag, color: e.target.value })}
                          className="w-8 h-8 p-0.5 bg-transparent border-none cursor-pointer"
                        />
                        <input 
                          type="text" 
                          value={editingTag.name} 
                          onChange={e => setEditingTag({ ...editingTag, name: e.target.value })}
                          className="flex-1 bg-surface border border-border-subtle px-2 py-1 text-xs font-mono text-text-main focus:outline-none uppercase"
                          autoFocus
                        />
                        <button 
                          onClick={() => handleUpdateTag(tag.name, editingTag.name, editingTag.color)}
                          className="p-1.5 text-success hover:bg-success/10 rounded transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setEditingTag(null)}
                          className="p-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }}></div>
                          <span className="text-sm font-mono text-text-main uppercase">{tag.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => setEditingTag({ oldName: tag.name, name: tag.name, color: tag.color })}
                            className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded transition-colors"
                            title="Editar Tag"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteTag(tag.name)}
                            className="p-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded transition-colors"
                            title="Excluir Tag"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
