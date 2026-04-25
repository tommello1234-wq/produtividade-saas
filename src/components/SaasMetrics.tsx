import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  TrendingUp,
  Users,
  UserPlus,
  UserMinus,
  DollarSign,
  Calendar,
  Activity,
  Crown,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  AreaChart,
} from 'recharts';

interface Metrics {
  mrr: number;
  arr: number;
  totalContracted: number;
  totalRevenue: number;
  totalPending: number;
  recurringOpen: number;
  annualSales: number;
  monthlySales: number;
  annualCustomersCount: number;
  totalContractedThisMonth: number;
  totalRevenueThisMonth: number;
  asaasRevenue: number;
  tictoRevenue: number;
  tictoCount: number;
  activeUsers: number;
  newUsersThisMonth: number;
  churnedUsersThisMonth: number;
  churnRate: number;
  arpu: number;
  ltv: number;
  avgLifetimeMonths: number;
  monthlyMRR: { month: string; mrr: number }[];
  topCustomers: { customer: string; email: string; total: number; payments: number }[];
  recentActivity: { id: string; customer: string; value: number; date: string; description: string }[];
  totalSubsCount: number;
  totalPaymentsCount: number;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const fmtNum = (v: number) => v.toLocaleString('pt-BR');

const fmtDate = (s: string) => {
  const d = new Date(s);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

function KpiCard({
  label,
  value,
  hint,
  Icon,
  accent = 'text-accent',
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  Icon: any;
  accent?: string;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <div className="bg-surface border border-border-subtle p-5 flex flex-col gap-3 hover:border-border transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-text-muted">{label}</span>
        <Icon className={`w-4 h-4 ${accent}`} />
      </div>
      <div className={`text-3xl font-black tracking-tight ${accent}`}>{value}</div>
      {(hint || trend) && (
        <div className="flex items-center justify-between">
          {hint && <span className="text-[10px] font-mono text-text-muted">{hint}</span>}
          {trend && (
            <span className={`text-[10px] font-mono font-bold ${trend.positive ? 'text-success' : 'text-error'}`}>
              {trend.positive ? '▲' : '▼'} {Math.abs(trend.value).toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function SaasMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch('/api/asaas/saas-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: 'Gravyx', userId: user?.id }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setMetrics(data);
        setLastFetch(new Date());
      }
    } catch (e: any) {
      setError(e?.message || 'Falha ao buscar métricas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && !metrics) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-accent font-mono text-xs animate-pulse tracking-[0.2em]">
          CARREGANDO MÉTRICAS GRAVYX...
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="w-12 h-12 text-error opacity-60" />
        <div className="text-text-main font-mono text-sm max-w-md">{error}</div>
        <button
          onClick={load}
          className="px-4 py-2 bg-accent text-black text-[11px] font-mono tracking-[0.2em] uppercase font-bold hover:brightness-110"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!metrics) return null;

  // Compute MRR delta vs previous month
  const mrrSeries = metrics.monthlyMRR;
  const prevMRR = mrrSeries.length >= 2 ? mrrSeries[mrrSeries.length - 2].mrr : 0;
  const currMRR = mrrSeries.length >= 1 ? mrrSeries[mrrSeries.length - 1].mrr : 0;
  const mrrDelta = prevMRR > 0 ? ((currMRR - prevMRR) / prevMRR) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-border-subtle pb-4">
        <div>
          <div className="text-[10px] font-mono tracking-[0.2em] text-text-muted uppercase mb-1">// PRODUTO</div>
          <h1 className="text-3xl font-black tracking-tighter">
            <span className="text-accent">GRAVYX</span> <span className="text-text-muted">/ MÉTRICAS</span>
          </h1>
          {lastFetch && (
            <div className="text-[10px] font-mono text-text-muted mt-2">
              Atualizado em {lastFetch.toLocaleString('pt-BR')}
            </div>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-2 bg-accent text-black text-[11px] font-mono tracking-[0.2em] uppercase font-bold hover:brightness-110 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* KPI Row 1 — Faturado / Recebido / A Receber */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="TOTAL FATURADO"
          value={fmtBRL(metrics.totalContracted)}
          hint="Vendas garantidas (caixa + parcelas de cartão)"
          Icon={DollarSign}
          accent="text-accent"
        />
        <KpiCard
          label="TOTAL RECEBIDO"
          value={fmtBRL(metrics.totalRevenue)}
          hint={`Caixa real • ${metrics.totalPaymentsCount} pagamentos`}
          Icon={TrendingUp}
          accent="text-success"
        />
        <KpiCard
          label="A RECEBER (GARANTIDO)"
          value={fmtBRL(metrics.totalPending)}
          hint="Parcelas de cartão que ainda vão cair"
          Icon={Calendar}
          accent="text-warning"
        />
      </div>

      {/* Aviso sobre cobranças recorrentes em aberto (não garantidas) */}
      {metrics.recurringOpen > 0 && (
        <div className="bg-surface border border-border-subtle p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-text-muted">
              // COBRANÇAS RECORRENTES EM ABERTO
            </div>
            <div className="text-sm text-text-main mt-1">
              <span className="font-bold text-warning">{fmtBRL(metrics.recurringOpen)}</span>
              {' '}em boletos/PIX recorrentes ainda não pagos.{' '}
              <span className="text-text-muted">Não estão somados no Faturado porque não há garantia de pagamento.</span>
            </div>
          </div>
        </div>
      )}

      {/* Composição: Anuais vs Mensais (no recebido) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          label="VENDAS DE ANUAIS"
          value={fmtBRL(metrics.annualSales)}
          hint={`${metrics.annualCustomersCount} cliente(s) em planos anuais`}
          Icon={Crown}
          accent="text-warning"
        />
        <KpiCard
          label="VENDAS DE MENSAIS"
          value={fmtBRL(metrics.monthlySales)}
          hint="Receita vinda das mensalidades"
          Icon={Calendar}
          accent="text-info"
        />
      </div>

      {/* Breakdown por origem: Asaas vs Ticto */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          label="VIA ASAAS"
          value={fmtBRL(metrics.asaasRevenue)}
          hint="Recebido via Asaas (cartão, PIX, boleto)"
          Icon={DollarSign}
          accent="text-accent"
        />
        <KpiCard
          label="VIA TICTO"
          value={fmtBRL(metrics.tictoRevenue)}
          hint={`${metrics.tictoCount} venda(s) registrada(s) via Ticto`}
          Icon={Activity}
          accent="text-info"
        />
      </div>

      {/* KPI Row 1.5 — Mês corrente */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          label="FATURADO NO MÊS"
          value={fmtBRL(metrics.totalContractedThisMonth)}
          hint="Vendas/parcelas com vencimento neste mês"
          Icon={DollarSign}
          accent="text-accent"
        />
        <KpiCard
          label="RECEBIDO NO MÊS"
          value={fmtBRL(metrics.totalRevenueThisMonth)}
          hint="Dinheiro que entrou neste mês"
          Icon={TrendingUp}
          accent="text-success"
        />
      </div>

      {/* KPI Row 2 — financeiros recorrentes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="MRR"
          value={fmtBRL(metrics.mrr)}
          hint="Receita recorrente mensal"
          Icon={DollarSign}
          accent="text-accent"
          trend={prevMRR > 0 ? { value: mrrDelta, positive: mrrDelta >= 0 } : undefined}
        />
        <KpiCard
          label="ARR"
          value={fmtBRL(metrics.arr)}
          hint="Receita anual projetada"
          Icon={TrendingUp}
          accent="text-success"
        />
        <KpiCard
          label="ARPU"
          value={fmtBRL(metrics.arpu)}
          hint="Receita média por usuário"
          Icon={Users}
          accent="text-info"
        />
        <KpiCard
          label="LTV"
          value={fmtBRL(metrics.ltv)}
          hint={`× ${metrics.avgLifetimeMonths.toFixed(1)} meses de ciclo`}
          Icon={Crown}
          accent="text-warning"
        />
      </div>

      {/* KPI Row 2 — usuários */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="USUÁRIOS ATIVOS"
          value={fmtNum(metrics.activeUsers)}
          hint={`${metrics.totalSubsCount} assinaturas totais`}
          Icon={Users}
          accent="text-accent"
        />
        <KpiCard
          label="NOVOS NO MÊS"
          value={fmtNum(metrics.newUsersThisMonth)}
          hint="Adquiridos neste mês"
          Icon={UserPlus}
          accent="text-success"
        />
        <KpiCard
          label="CHURN MÊS"
          value={fmtNum(metrics.churnedUsersThisMonth)}
          hint="Cancelaram neste mês"
          Icon={UserMinus}
          accent="text-error"
        />
        <KpiCard
          label="CHURN RATE"
          value={`${metrics.churnRate.toFixed(2)}%`}
          hint="Taxa mensal de cancelamento"
          Icon={Activity}
          accent={metrics.churnRate < 5 ? 'text-success' : metrics.churnRate < 10 ? 'text-warning' : 'text-error'}
        />
      </div>

      {/* MRR Chart */}
      <div className="bg-surface border border-border-subtle p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] font-mono tracking-[0.2em] text-text-muted uppercase">// CRESCIMENTO</div>
            <h2 className="text-lg font-bold mt-1">MRR — Últimos 12 meses</h2>
          </div>
          <Calendar className="w-4 h-4 text-text-muted" />
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.monthlyMRR} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFB020" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#FFB020" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#2A2A2A" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="#6B6B6B" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
              <YAxis
                stroke="#6B6B6B"
                tick={{ fontSize: 10, fontFamily: 'monospace' }}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: '#1A1A1A',
                  border: '1px solid #333',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                }}
                formatter={(v: any) => [fmtBRL(v), 'MRR']}
              />
              <Area type="monotone" dataKey="mrr" stroke="#FFB020" strokeWidth={2.5} fill="url(#mrrGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Customers + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top customers */}
        <div className="bg-surface border border-border-subtle p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] font-mono tracking-[0.2em] text-text-muted uppercase">// RANKING</div>
              <h2 className="text-lg font-bold mt-1">Top Clientes</h2>
            </div>
            <Crown className="w-4 h-4 text-warning" />
          </div>
          <div className="space-y-2">
            {metrics.topCustomers.length === 0 && (
              <div className="text-text-muted text-sm font-mono">Nenhum cliente encontrado.</div>
            )}
            {metrics.topCustomers.map((c, idx) => (
              <div
                key={c.customer + idx}
                className="flex items-center justify-between p-3 bg-bg border border-border-subtle hover:border-accent/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 flex items-center justify-center font-mono text-[10px] font-bold shrink-0 ${
                      idx === 0
                        ? 'bg-warning text-black'
                        : idx === 1
                        ? 'bg-text-muted text-black'
                        : idx === 2
                        ? 'bg-accent/30 text-accent'
                        : 'bg-surface-2 text-text-muted'
                    }`}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{c.customer}</div>
                    {c.email && <div className="text-[10px] font-mono text-text-muted truncate">{c.email}</div>}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className="text-sm font-bold text-success">{fmtBRL(c.total)}</div>
                  <div className="text-[10px] font-mono text-text-muted">{c.payments} pagto(s)</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-surface border border-border-subtle p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] font-mono tracking-[0.2em] text-text-muted uppercase">// ATIVIDADE</div>
              <h2 className="text-lg font-bold mt-1">Últimos pagamentos</h2>
            </div>
            <Activity className="w-4 h-4 text-info" />
          </div>
          <div className="space-y-2">
            {metrics.recentActivity.length === 0 && (
              <div className="text-text-muted text-sm font-mono">Nenhuma movimentação encontrada.</div>
            )}
            {metrics.recentActivity.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-3 bg-bg border border-border-subtle hover:border-accent/40 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{a.customer}</div>
                  <div className="text-[10px] font-mono text-text-muted truncate">{a.description}</div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className="text-sm font-bold text-success">+ {fmtBRL(a.value)}</div>
                  <div className="text-[10px] font-mono text-text-muted">{fmtDate(a.date)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
