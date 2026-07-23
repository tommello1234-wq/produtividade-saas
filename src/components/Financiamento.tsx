import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, DollarSign, TrendingDown, Calendar, Percent } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LoanContract {
  id: string;
  name: string;
  contract_number: string | null;
  financed_amount: number;
  term_months: number;
  nominal_rate: number | null;
  effective_rate: number | null;
  start_date: string | null;
  current_balance: number | null;
  remaining_months: number | null;
  current_installment: number | null;
  down_payment: number | null;
  fees_total: number | null;
}

interface LoanPayment {
  id: string;
  loan_id: string;
  payment_date: string;
  amount: number;
  installment_number: number | null;
}

export default function Financiamento() {
  const [loans, setLoans] = useState<LoanContract[]>([]);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});

  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const [form, setForm] = useState({
    name: '', contract_number: '', financed_amount: '', term_months: '',
    nominal_rate: '', effective_rate: '', start_date: '',
    current_balance: '', remaining_months: '', current_installment: '',
    down_payment: '', fees_total: '',
  });

  const [paymentForm, setPaymentForm] = useState({ payment_date: new Date().toISOString().split('T')[0], amount: '', installment_number: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [{ data: loanData }, { data: payData }] = await Promise.all([
      supabase.from('loan_contracts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('loan_payments').select('*').eq('user_id', user.id).order('payment_date', { ascending: false }),
    ]);
    setLoans(loanData || []);
    setPayments(payData || []);
    if (loanData && loanData.length > 0 && !selectedLoanId) setSelectedLoanId(loanData[0].id);
    setLoading(false);
  };

  const resetForm = () => setForm({ name: '', contract_number: '', financed_amount: '', term_months: '', nominal_rate: '', effective_rate: '', start_date: '', current_balance: '', remaining_months: '', current_installment: '', down_payment: '', fees_total: '' });

  const openNewLoan = () => { resetForm(); setEditingLoanId(null); setIsLoanModalOpen(true); };
  const openEditLoan = (loan: LoanContract) => {
    setForm({
      name: loan.name,
      contract_number: loan.contract_number || '',
      financed_amount: String(loan.financed_amount),
      term_months: String(loan.term_months),
      nominal_rate: loan.nominal_rate != null ? String(loan.nominal_rate) : '',
      effective_rate: loan.effective_rate != null ? String(loan.effective_rate) : '',
      start_date: loan.start_date || '',
      current_balance: loan.current_balance != null ? String(loan.current_balance) : '',
      remaining_months: loan.remaining_months != null ? String(loan.remaining_months) : '',
      current_installment: loan.current_installment != null ? String(loan.current_installment) : '',
      down_payment: loan.down_payment != null ? String(loan.down_payment) : '',
      fees_total: loan.fees_total != null ? String(loan.fees_total) : '',
    });
    setEditingLoanId(loan.id);
    setIsLoanModalOpen(true);
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = {
      user_id: user.id,
      name: form.name,
      contract_number: form.contract_number || null,
      financed_amount: Number(form.financed_amount),
      term_months: Number(form.term_months),
      nominal_rate: form.nominal_rate ? Number(form.nominal_rate) : null,
      effective_rate: form.effective_rate ? Number(form.effective_rate) : null,
      start_date: form.start_date || null,
      current_balance: form.current_balance ? Number(form.current_balance) : null,
      remaining_months: form.remaining_months ? Number(form.remaining_months) : null,
      current_installment: form.current_installment ? Number(form.current_installment) : null,
      down_payment: form.down_payment ? Number(form.down_payment) : null,
      fees_total: form.fees_total ? Number(form.fees_total) : null,
    };
    if (editingLoanId) {
      await supabase.from('loan_contracts').update(payload).eq('id', editingLoanId);
    } else {
      const { data } = await supabase.from('loan_contracts').insert([payload]).select().single();
      if (data) setSelectedLoanId(data.id);
    }
    setIsLoanModalOpen(false);
    fetchData();
  };

  const handleDeleteLoan = async (id: string) => {
    if (!window.confirm('Excluir este financiamento e todos os pagamentos registrados?')) return;
    await supabase.from('loan_contracts').delete().eq('id', id);
    if (selectedLoanId === id) setSelectedLoanId(null);
    fetchData();
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !selectedLoanId) return;
    await supabase.from('loan_payments').insert([{
      user_id: user.id,
      loan_id: selectedLoanId,
      payment_date: paymentForm.payment_date,
      amount: Number(paymentForm.amount),
      installment_number: paymentForm.installment_number ? Number(paymentForm.installment_number) : null,
    }]);
    setPaymentForm({ payment_date: new Date().toISOString().split('T')[0], amount: '', installment_number: '' });
    setIsPaymentModalOpen(false);
    fetchData();
  };

  const handleDeletePayment = async (id: string) => {
    await supabase.from('loan_payments').delete().eq('id', id);
    fetchData();
  };

  if (loading) {
    return <div className="p-12 text-center font-mono text-text-muted text-xs">CARREGANDO...</div>;
  }

  const selectedLoan = loans.find(l => l.id === selectedLoanId);
  const loanPayments = payments.filter(p => p.loan_id === selectedLoanId).sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  const totalPaid = loanPayments.reduce((s, p) => s + Number(p.amount), 0);

  // Projeção: parcela atual x meses restantes + já pago
  const projectedRemaining = selectedLoan?.current_installment && selectedLoan?.remaining_months
    ? Number(selectedLoan.current_installment) * Number(selectedLoan.remaining_months)
    : null;
  const projectedTotal = projectedRemaining != null ? totalPaid + projectedRemaining : null;
  const overCost = projectedTotal != null && selectedLoan ? projectedTotal - Number(selectedLoan.financed_amount) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Financiamento</h2>
          <p className="text-xs font-mono text-text-muted mt-1">Acompanhe o saldo devedor e o custo total real</p>
        </div>
        <div className="flex items-center gap-3">
          {loans.length > 0 && (
            <select
              value={selectedLoanId || ''}
              onChange={(e) => setSelectedLoanId(e.target.value)}
              className="bg-surface-2 border border-border-subtle px-3 py-2 text-xs font-mono text-text-main focus:outline-none focus:border-accent"
            >
              {loans.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          <button onClick={openNewLoan} className="bg-accent text-bg px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] hover:bg-accent/90 transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo Financiamento
          </button>
        </div>
      </div>

      {loans.length === 0 ? (
        <div className="p-12 text-center text-sm font-mono text-text-muted uppercase border border-border-subtle bg-surface">
          Nenhum financiamento cadastrado. Clique em "Novo Financiamento" pra começar.
        </div>
      ) : selectedLoan ? (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-surface border border-border-subtle p-6">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-2 flex items-center gap-2">
                <DollarSign className="w-3 h-3 text-accent" /> Valor Financiado
              </div>
              <div className="text-2xl font-black tracking-[-1px] text-white">
                R$ {Number(selectedLoan.financed_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-surface border border-border-subtle p-6">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-2 flex items-center gap-2">
                <TrendingDown className="w-3 h-3 text-danger" /> Saldo Devedor
              </div>
              <div className="text-2xl font-black tracking-[-1px] text-danger">
                {selectedLoan.current_balance != null ? `R$ ${Number(selectedLoan.current_balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
              </div>
            </div>
            <div className="bg-surface border border-border-subtle p-6">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-2 flex items-center gap-2">
                <DollarSign className="w-3 h-3 text-success" /> Já Pago
              </div>
              <div className="text-2xl font-black tracking-[-1px] text-success">
                R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] font-mono text-text-muted mt-1">{loanPayments.length} pagamentos registrados</div>
            </div>
            <div className="bg-surface border border-border-subtle p-6">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] mb-2 flex items-center gap-2">
                <Calendar className="w-3 h-3 text-info" /> Prazo Restante
              </div>
              <div className="text-2xl font-black tracking-[-1px] text-white">
                {selectedLoan.remaining_months != null ? `${selectedLoan.remaining_months} meses` : '—'}
              </div>
              <div className="text-[10px] font-mono text-text-muted mt-1">de {selectedLoan.term_months} meses contratados</div>
            </div>
          </div>

          {/* Projeção de custo total */}
          {projectedTotal != null && (
            <div className="bg-surface border border-accent/30 p-6">
              <div className="text-xs font-bold uppercase tracking-[0.1em] text-accent mb-4">Projeção de Custo Total</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="text-[10px] font-mono text-text-muted uppercase mb-1">Você vai pagar no total</div>
                  <div className="text-3xl font-black tracking-[-1px] text-white">
                    R$ {projectedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] font-mono text-text-muted mt-1">(já pago + parcela atual × meses restantes)</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-text-muted uppercase mb-1">Custo do juros (acima do financiado)</div>
                  <div className={`text-3xl font-black tracking-[-1px] ${overCost && overCost > 0 ? 'text-danger' : 'text-success'}`}>
                    R$ {overCost?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] font-mono text-text-muted mt-1">
                    {overCost && selectedLoan.financed_amount ? `+${((overCost / Number(selectedLoan.financed_amount)) * 100).toFixed(1)}% sobre o valor financiado` : ''}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-text-muted uppercase mb-1">Taxa efetiva</div>
                  <div className="text-3xl font-black tracking-[-1px] text-white flex items-center gap-1">
                    {selectedLoan.effective_rate != null ? `${selectedLoan.effective_rate}%` : '—'}
                    <Percent className="w-4 h-4 text-text-muted" />
                  </div>
                  <div className="text-[10px] font-mono text-text-muted mt-1">ao ano</div>
                </div>
              </div>
            </div>
          )}

          {/* Custo total de aquisição do imóvel (entrada + taxas + financiamento) */}
          {(selectedLoan.down_payment != null || selectedLoan.fees_total != null) && (
            <div className="bg-surface border border-border-subtle p-6">
              <div className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted mb-4">Custo Total de Aquisição do Imóvel</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-surface-2 border border-border-subtle p-4">
                  <div className="text-[10px] font-mono text-text-muted uppercase mb-1">Entrada</div>
                  <div className="text-lg font-black text-white">R$ {(selectedLoan.down_payment || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="bg-surface-2 border border-border-subtle p-4">
                  <div className="text-[10px] font-mono text-text-muted uppercase mb-1">Taxas (ITBI, cartório...)</div>
                  <div className="text-lg font-black text-white">R$ {(selectedLoan.fees_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="bg-surface-2 border border-border-subtle p-4">
                  <div className="text-[10px] font-mono text-text-muted uppercase mb-1">Financiamento (projetado)</div>
                  <div className="text-lg font-black text-white">{projectedTotal != null ? `R$ ${projectedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</div>
                </div>
                <div className="bg-accent/10 border border-accent/30 p-4">
                  <div className="text-[10px] font-mono text-accent uppercase mb-1">Custo Total do Imóvel</div>
                  <div className="text-lg font-black text-accent">
                    {projectedTotal != null
                      ? `R$ ${(projectedTotal + (selectedLoan.down_payment || 0) + (selectedLoan.fees_total || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </div>
                </div>
              </div>
              <div className="text-[10px] font-mono text-text-muted">Entrada + Taxas + Total projetado do financiamento (já pago + parcela atual × meses restantes)</div>
            </div>
          )}

          {/* Detalhes do contrato + editar */}
          <div className="bg-surface border border-border-subtle p-6 flex items-center justify-between">
            <div className="text-xs font-mono text-text-muted">
              {selectedLoan.contract_number && <span>Contrato: <span className="text-text-main">{selectedLoan.contract_number}</span> · </span>}
              {selectedLoan.start_date && <span>Início: <span className="text-text-main">{selectedLoan.start_date.split('-').reverse().join('/')}</span> · </span>}
              {selectedLoan.nominal_rate != null && <span>Taxa nominal: <span className="text-text-main">{selectedLoan.nominal_rate}%</span></span>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => openEditLoan(selectedLoan)} className="p-2 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title="Editar">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDeleteLoan(selectedLoan.id)} className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-sm" title="Excluir">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Histórico de pagamentos */}
          <div className="bg-surface border border-border-subtle overflow-hidden">
            <div className="p-4 border-b border-border-subtle bg-surface-2/50 flex justify-between items-center">
              <h4 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Histórico de Pagamentos</h4>
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="bg-accent text-bg px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-accent/90 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Registrar Pagamento
              </button>
            </div>
            {loanPayments.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-text-muted">Nenhum pagamento registrado ainda.</div>
            ) : (() => {
              const byYear = new Map<string, LoanPayment[]>();
              loanPayments.forEach((p) => {
                const year = p.payment_date.slice(0, 4);
                if (!byYear.has(year)) byYear.set(year, []);
                byYear.get(year)!.push(p);
              });
              const years = Array.from(byYear.keys()).sort((a, b) => b.localeCompare(a));
              return (
                <div className="divide-y divide-border-subtle">
                  {years.map((year) => {
                    const yearPayments = byYear.get(year)!;
                    const yearTotal = yearPayments.reduce((s, p) => s + Number(p.amount), 0);
                    const isOpen = !!expandedYears[year] || (Object.keys(expandedYears).length === 0 && year === years[0]);
                    return (
                      <div key={year}>
                        <button
                          onClick={() => setExpandedYears((prev) => ({ ...prev, [year]: !isOpen }))}
                          className="w-full p-4 flex items-center justify-between hover:bg-surface-2/30 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-text-muted text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                            <span className="text-sm font-bold text-white">{year}</span>
                            <span className="text-[10px] font-mono text-text-muted">({yearPayments.length} pagamentos)</span>
                          </div>
                          <span className="text-sm font-mono font-bold text-success">R$ {yearTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </button>
                        {isOpen && (
                          <div className="divide-y divide-border-subtle/60 bg-surface-2/10">
                            {yearPayments.map((p) => (
                              <div key={p.id} className="pl-10 p-4 flex items-center justify-between hover:bg-surface-2/30 transition-colors group">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center border border-success/20">
                                    <DollarSign className="w-4 h-4 text-success" />
                                  </div>
                                  <div>
                                    <div className="text-sm font-bold text-white">
                                      {p.installment_number ? `Parcela ${p.installment_number}` : 'Pagamento'}
                                    </div>
                                    <div className="text-[10px] font-mono text-text-muted">{p.payment_date.split('-').reverse().join('/')}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-mono font-bold text-success">R$ {Number(p.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                  <button onClick={() => handleDeletePayment(p.id)} className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            {loanPayments.length > 0 && (
              <div className="p-3 border-t border-border-subtle bg-surface-2/30 flex justify-between items-center">
                <span className="text-[10px] font-mono uppercase text-text-muted tracking-[0.1em]">Total Pago</span>
                <span className="text-sm font-mono font-bold text-success">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* Modal: novo/editar financiamento */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4" onClick={() => setIsLoanModalOpen(false)}>
          <div className="bg-surface-2 border border-border-subtle w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border-subtle">
              <h2 className="text-lg font-extrabold uppercase">{editingLoanId ? 'Editar Financiamento' : 'Novo Financiamento'}</h2>
              <button onClick={() => setIsLoanModalOpen(false)} className="text-text-muted hover:text-error"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveLoan} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Nome *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Financiamento Imóvel" className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm text-text-main focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Nº do Contrato</label>
                <input value={form.contract_number} onChange={(e) => setForm({ ...form, contract_number: e.target.value })} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm text-text-main focus:outline-none focus:border-accent" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Valor Financiado (R$) *</label>
                  <input required type="number" step="0.01" value={form.financed_amount} onChange={(e) => setForm({ ...form, financed_amount: e.target.value })} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm text-text-main focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Prazo Contratado (meses) *</label>
                  <input required type="number" value={form.term_months} onChange={(e) => setForm({ ...form, term_months: e.target.value })} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm text-text-main focus:outline-none focus:border-accent" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Taxa Nominal (%)</label>
                  <input type="number" step="0.01" value={form.nominal_rate} onChange={(e) => setForm({ ...form, nominal_rate: e.target.value })} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm text-text-main focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Taxa Efetiva (%)</label>
                  <input type="number" step="0.01" value={form.effective_rate} onChange={(e) => setForm({ ...form, effective_rate: e.target.value })} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm text-text-main focus:outline-none focus:border-accent" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Data de Início</label>
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm text-text-main focus:outline-none focus:border-accent" />
              </div>
              <div className="border-t border-border-subtle pt-4">
                <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-3">Situação Atual (do app do banco)</div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Saldo Devedor (R$)</label>
                    <input type="number" step="0.01" value={form.current_balance} onChange={(e) => setForm({ ...form, current_balance: e.target.value })} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm text-text-main focus:outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Prazo Restante (meses)</label>
                    <input type="number" value={form.remaining_months} onChange={(e) => setForm({ ...form, remaining_months: e.target.value })} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm text-text-main focus:outline-none focus:border-accent" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Valor da Parcela Atual (R$)</label>
                  <input type="number" step="0.01" value={form.current_installment} onChange={(e) => setForm({ ...form, current_installment: e.target.value })} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm text-text-main focus:outline-none focus:border-accent" />
                </div>
              </div>
              <div className="border-t border-border-subtle pt-4">
                <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-3">Custos de Aquisição (fora do financiamento)</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Entrada (R$)</label>
                    <input type="number" step="0.01" value={form.down_payment} onChange={(e) => setForm({ ...form, down_payment: e.target.value })} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm text-text-main focus:outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Taxas Totais (R$)</label>
                    <input type="number" step="0.01" value={form.fees_total} onChange={(e) => setForm({ ...form, fees_total: e.target.value })} placeholder="ITBI, cartório, registro..." className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm text-text-main focus:outline-none focus:border-accent placeholder:text-text-muted/40" />
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full bg-accent text-bg py-3 text-xs font-bold uppercase tracking-[0.1em] hover:bg-accent/90 transition-colors mt-2">
                {editingLoanId ? 'Salvar Alterações' : 'Criar Financiamento'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: registrar pagamento */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4" onClick={() => setIsPaymentModalOpen(false)}>
          <div className="bg-surface-2 border border-border-subtle w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border-subtle">
              <h2 className="text-lg font-extrabold uppercase">Registrar Pagamento</h2>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-text-muted hover:text-error"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Data</label>
                <input required type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm text-text-main focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Valor (R$)</label>
                <input required type="number" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm text-text-main focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">Nº da Parcela (opcional)</label>
                <input type="number" value={paymentForm.installment_number} onChange={(e) => setPaymentForm({ ...paymentForm, installment_number: e.target.value })} className="w-full bg-surface border border-border-subtle px-4 py-3 text-sm text-text-main focus:outline-none focus:border-accent" />
              </div>
              <button type="submit" className="w-full bg-accent text-bg py-3 text-xs font-bold uppercase tracking-[0.1em] hover:bg-accent/90 transition-colors">
                Registrar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
