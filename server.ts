import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
// Use service role key if available, otherwise fallback to anon key (which will be subject to RLS)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }) 
  : null;

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 8080;

  // Middleware to parse JSON bodies
  app.use(express.json());

  // Webhook endpoint for Asaas
  app.post("/api/webhook/asaas/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const event = req.body.event;
      const payment = req.body.payment;

      console.log(`Received Asaas webhook for user ${userId}:`, event);

      // Only process confirmed/received payments
      if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
        if (!supabase) {
          console.error('Supabase is not configured. Cannot save webhook data.');
          return res.status(500).json({ error: 'Database not configured' });
        }

        const amount = payment.value || payment.netValue || 0;
        const description = payment.description || 'Venda Asaas';
        const date = payment.paymentDate || payment.clientPaymentDate || new Date().toISOString().split('T')[0];

        const newTx = {
          user_id: userId,
          description: `[Asaas] ${description} (ID: ${payment.id})`,
          category: 'Vendas|#10B981', // Green color for sales
          amount: Math.abs(amount),
          type: 'income',
          date: date
        };

        const { error } = await supabase
          .from('financial_transactions')
          .insert([newTx]);

        if (error) {
          console.error('Error inserting Asaas transaction:', error);
          if (error.message && error.message.includes('row-level security')) {
            console.error('RLS Error: The server needs SUPABASE_SERVICE_ROLE_KEY to insert data via webhook.');
          }
          return res.status(500).json({ error: 'Failed to insert transaction', details: error.message });
        }

        console.log('Successfully recorded Asaas sale for user', userId);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Sync endpoint for historical Asaas data
  app.post("/api/asaas/sync", async (req, res) => {
    try {
      const { apiKey, userId } = req.body;
      const asaasKey = process.env.ASAAS_API_KEY || apiKey;
      
      console.log('Sync request received. UserId:', userId);
      console.log('ASAAS_API_KEY configured in env:', !!process.env.ASAAS_API_KEY);
      console.log('apiKey provided in body:', !!apiKey);
      
      if (!asaasKey) return res.status(400).json({ error: 'Chave de API do Asaas não encontrada. Verifique se você configurou o Secret ASAAS_API_KEY corretamente.' });
      if (!userId) return res.status(400).json({ error: 'Usuário não identificado. Faça login novamente.' });
      if (!supabase) return res.status(500).json({ error: 'Banco de dados não configurado.' });

      const fetchPayments = async (status: string) => {
        let allData: any[] = [];
        let offset = 0;
        const limit = 100;
        let hasMore = true;

        while (hasMore) {
          const response = await fetch(`https://api.asaas.com/v3/payments?status=${status}&limit=${limit}&offset=${offset}`, {
            headers: { 'access_token': asaasKey, 'Content-Type': 'application/json' }
          });
          
          if (!response.ok) {
            const errText = await response.text();
            console.error(`Asaas API Error (${status}):`, response.status, errText);
            throw new Error(`Erro na API do Asaas (${response.status}): Verifique se a chave de API é válida e de produção.`);
          }
          
          const data = await response.json();
          
          if (data.data && data.data.length > 0) {
            allData = [...allData, ...data.data];
            offset += limit;
            hasMore = data.hasMore;
          } else {
            hasMore = false;
          }
        }
        return allData;
      };

      const [received, confirmed, receivedInCash] = await Promise.all([
        fetchPayments('RECEIVED'),
        fetchPayments('CONFIRMED'),
        fetchPayments('RECEIVED_IN_CASH')
      ]);
      const payments = [...received, ...confirmed, ...receivedInCash];

      if (payments.length === 0) {
        return res.json({ success: true, count: 0, message: 'Nenhuma cobrança recebida ou confirmada foi encontrada no Asaas.' });
      }

      const { data: existingTxs } = await supabase
        .from('financial_transactions')
        .select('description')
        .eq('user_id', userId)
        .like('description', '%[Asaas]%');

      const existingIds = new Set(existingTxs?.map(tx => {
        const match = tx.description.match(/\(ID: (pay_[^)]+)\)/);
        return match ? match[1] : null;
      }).filter(Boolean));

      const newTxs = [];
      for (const p of payments) {
        if (existingIds.has(p.id)) continue;

        const amount = p.value || p.netValue || 0;
        const description = p.description || 'Venda Asaas';
        const date = p.paymentDate || p.clientPaymentDate || p.dateCreated || new Date().toISOString().split('T')[0];

        newTxs.push({
          user_id: userId,
          description: `[Asaas] ${description} (ID: ${p.id})`,
          category: 'Vendas|#10B981',
          amount: Math.abs(amount),
          type: 'income',
          date: date.split('T')[0]
        });
      }

      if (newTxs.length > 0) {
        const { error } = await supabase.from('financial_transactions').insert(newTxs);
        if (error) {
          if (error.message.includes('row-level security')) {
            throw new Error('Erro de permissão no banco de dados (RLS). O servidor precisa da SUPABASE_SERVICE_ROLE_KEY configurada nos Secrets para inserir dados em nome do usuário.');
          }
          throw error;
        }
      }

      res.json({ success: true, count: newTxs.length });
    } catch (error: any) {
      console.error('Sync error:', error);
      res.status(500).json({ error: error.message || 'Falha ao sincronizar. Verifique a chave de API.' });
    }
  });

  // SaaS metrics endpoint — fetches subscriptions + payments filtered by keyword
  app.post("/api/asaas/saas-metrics", async (req, res) => {
    try {
      const { keyword = 'Gravyx' } = req.body || {};
      const asaasKey = process.env.ASAAS_API_KEY;
      if (!asaasKey) return res.status(400).json({ error: 'ASAAS_API_KEY não configurada no servidor.' });

      const kwLower = keyword.toLowerCase();
      const ASAAS = 'https://api.asaas.com/v3';
      const headers = { 'access_token': asaasKey, 'Content-Type': 'application/json' };

      // Generic paginated GET
      const fetchAll = async (url: string) => {
        let all: any[] = [];
        let offset = 0;
        const limit = 100;
        while (true) {
          const sep = url.includes('?') ? '&' : '?';
          const r = await fetch(`${url}${sep}limit=${limit}&offset=${offset}`, { headers });
          if (!r.ok) throw new Error(`Asaas ${r.status}: ${await r.text()}`);
          const j = await r.json();
          const arr = j.data || [];
          all.push(...arr);
          if (arr.length < limit || j.hasMore === false) break;
          offset += limit;
        }
        return all;
      };

      // Fetch subscriptions and payments in parallel
      const [allSubs, allPayments] = await Promise.all([
        fetchAll(`${ASAAS}/subscriptions`),
        fetchAll(`${ASAAS}/payments?status=RECEIVED`),
      ]);

      // Also fetch CONFIRMED + RECEIVED_IN_CASH + PENDING + OVERDUE payments
      const [confirmed, inCash, pending, overdue] = await Promise.all([
        fetchAll(`${ASAAS}/payments?status=CONFIRMED`),
        fetchAll(`${ASAAS}/payments?status=RECEIVED_IN_CASH`),
        fetchAll(`${ASAAS}/payments?status=PENDING`),
        fetchAll(`${ASAAS}/payments?status=OVERDUE`),
      ]);
      const payments = [...allPayments, ...confirmed, ...inCash, ...pending, ...overdue];

      // Filter by keyword in description
      const matches = (txt: any) => typeof txt === 'string' && txt.toLowerCase().includes(kwLower);
      const subs = allSubs.filter((s: any) => matches(s.description));
      const filteredPayments = payments.filter((p: any) => matches(p.description));

      // Resolve customer details for top customers
      const customerIds = Array.from(new Set([
        ...subs.map((s: any) => s.customer),
        ...filteredPayments.map((p: any) => p.customer),
      ])).filter(Boolean);

      const customersMap: Record<string, any> = {};
      // Batch fetch (Asaas doesn't have batch — fetch each, but limit concurrency)
      const limitConc = 5;
      for (let i = 0; i < customerIds.length; i += limitConc) {
        const batch = customerIds.slice(i, i + limitConc);
        await Promise.all(batch.map(async (cid: string) => {
          try {
            const r = await fetch(`${ASAAS}/customers/${cid}`, { headers });
            if (r.ok) {
              const c = await r.json();
              customersMap[cid] = c;
            }
          } catch {}
        }));
      }

      // === Compute metrics ===
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Active subscriptions
      const activeSubs = subs.filter((s: any) => s.status === 'ACTIVE');
      const inactiveSubs = subs.filter((s: any) => s.status !== 'ACTIVE');

      // Normalize subscription value to monthly (handle weekly/yearly cycles)
      const monthlyValue = (s: any) => {
        const v = Number(s.value || 0);
        const cycle = (s.cycle || '').toUpperCase();
        switch (cycle) {
          case 'WEEKLY': return v * 4.345;
          case 'BIWEEKLY': return v * 2.17;
          case 'MONTHLY': return v;
          case 'BIMONTHLY': return v / 2;
          case 'QUARTERLY': return v / 3;
          case 'SEMIANNUALLY': return v / 6;
          case 'YEARLY': return v / 12;
          default: return v; // assume monthly
        }
      };

      const mrr = activeSubs.reduce((acc: number, s: any) => acc + monthlyValue(s), 0);
      const arr = mrr * 12;

      const activeUsers = new Set(activeSubs.map((s: any) => s.customer)).size;

      const newSubsThisMonth = subs.filter((s: any) => {
        const d = new Date(s.dateCreated);
        return d >= monthStart;
      });
      const newUsersThisMonth = new Set(newSubsThisMonth.map((s: any) => s.customer)).size;

      const churnedSubsThisMonth = inactiveSubs.filter((s: any) => {
        const d = new Date(s.deletedDate || s.endDate || s.dateCreated);
        return d >= monthStart;
      });
      const churnedUsersThisMonth = new Set(churnedSubsThisMonth.map((s: any) => s.customer)).size;

      // Active at start of month = active now + churned this month - new this month (approx)
      const activeAtStart = activeUsers + churnedUsersThisMonth - newUsersThisMonth;
      const churnRate = activeAtStart > 0 ? (churnedUsersThisMonth / activeAtStart) * 100 : 0;

      // Avg lifetime in months: per customer, (last payment date - first payment date) / 30
      const customerLifetime: Record<string, number> = {};
      const customerRevenue: Record<string, number> = {};
      const customerPaymentDates: Record<string, Date[]> = {};
      filteredPayments.forEach((p: any) => {
        const cid = p.customer;
        if (!cid) return;
        const dStr = p.paymentDate || p.clientPaymentDate || p.dateCreated;
        const d = new Date(dStr);
        if (!customerPaymentDates[cid]) customerPaymentDates[cid] = [];
        customerPaymentDates[cid].push(d);
        customerRevenue[cid] = (customerRevenue[cid] || 0) + Number(p.value || p.netValue || 0);
      });
      Object.keys(customerPaymentDates).forEach((cid) => {
        const dates = customerPaymentDates[cid].sort((a, b) => a.getTime() - b.getTime());
        const first = dates[0];
        const last = dates[dates.length - 1];
        const months = Math.max(1, (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24 * 30));
        customerLifetime[cid] = months;
      });
      const lifetimes = Object.values(customerLifetime);
      const avgLifetimeMonths = lifetimes.length > 0
        ? lifetimes.reduce((a, b) => a + b, 0) / lifetimes.length
        : 0;

      // ARPU = MRR / active users
      const arpu = activeUsers > 0 ? mrr / activeUsers : 0;
      // LTV = ARPU * avg lifetime months
      const ltv = arpu * Math.max(1, avgLifetimeMonths);

      // MRR growth chart: count active subscriptions per month for last 12 months
      const monthlyMRR: { month: string; mrr: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const refEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const monthSubs = subs.filter((s: any) => {
          const created = new Date(s.dateCreated);
          if (created > refEnd) return false;
          if (s.status === 'ACTIVE') return true;
          const ended = new Date(s.deletedDate || s.endDate || 0);
          return ended > refEnd;
        });
        const monthMRR = monthSubs.reduce((acc: number, s: any) => acc + monthlyValue(s), 0);
        const label = ref.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        monthlyMRR.push({ month: label, mrr: Math.round(monthMRR) });
      }

      // Top customers by total revenue
      const topCustomers = Object.entries(customerRevenue)
        .map(([cid, total]) => ({
          customer: customersMap[cid]?.name || customersMap[cid]?.email || cid,
          email: customersMap[cid]?.email || '',
          total: Math.round(total * 100) / 100,
          payments: customerPaymentDates[cid]?.length || 0,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      // Recent activity (last 10 payments)
      const recentActivity = filteredPayments
        .map((p: any) => ({
          id: p.id,
          customer: customersMap[p.customer]?.name || customersMap[p.customer]?.email || p.customer,
          value: Number(p.value || p.netValue || 0),
          date: p.paymentDate || p.clientPaymentDate || p.dateCreated,
          description: p.description,
        }))
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

      // Helpers
      const isReceived = (p: any) =>
        ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status);
      // Pendente "garantido": parcela de cartão (installment) que ainda vai cair
      // — cliente já pagou no cartão, é só o Asaas liberar mês a mês
      const isGuaranteedPending = (p: any) =>
        !!p.installment && ['PENDING', 'OVERDUE'].includes(p.status);
      // Sale guaranteed = received + installment-card future parcelas
      const isGuaranteedSale = (p: any) => isReceived(p) || isGuaranteedPending(p);
      const sumValues = (arr: any[]) =>
        arr.reduce((acc: number, p: any) => acc + Number(p.value || p.netValue || 0), 0);

      // TOTAL FATURADO = vendas garantidas (caixa real + parcelas de cartão futuras)
      // Cobranças recorrentes futuras (subscription PENDING/OVERDUE) NÃO entram — podem nem ser pagas
      const guaranteedPayments = filteredPayments.filter(isGuaranteedSale);
      const totalContracted = sumValues(guaranteedPayments);
      // TOTAL RECEBIDO = só o que caiu na conta
      const receivedPayments = filteredPayments.filter(isReceived);
      const totalRevenue = sumValues(receivedPayments);
      // A RECEBER = parcelas de cartão garantidas que ainda vão cair
      const totalPending = totalContracted - totalRevenue;
      // (separado) Cobranças recorrentes em aberto — apenas informativo
      const recurringOpen = sumValues(
        filteredPayments.filter((p: any) => !p.installment && ['PENDING', 'OVERDUE'].includes(p.status))
      );

      // Composição: vindas de parcelamentos anuais (installment) vs mensalidades (subscription)
      const annualSales = sumValues(receivedPayments.filter((p: any) => !!p.installment));
      const monthlySales = sumValues(receivedPayments.filter((p: any) => !p.installment));
      const annualCustomersCount = new Set(
        receivedPayments.filter((p: any) => !!p.installment).map((p: any) => p.customer)
      ).size;

      // Faturado / Recebido neste mês
      const inThisMonth = (p: any) =>
        new Date(p.paymentDate || p.clientPaymentDate || p.dueDate || p.dateCreated) >= monthStart;
      const totalContractedThisMonth = sumValues(guaranteedPayments.filter(inThisMonth));
      const totalRevenueThisMonth = sumValues(receivedPayments.filter(inThisMonth));

      res.json({
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(arr * 100) / 100,
        totalContracted: Math.round(totalContracted * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalPending: Math.round(totalPending * 100) / 100,
        recurringOpen: Math.round(recurringOpen * 100) / 100,
        annualSales: Math.round(annualSales * 100) / 100,
        monthlySales: Math.round(monthlySales * 100) / 100,
        annualCustomersCount,
        totalContractedThisMonth: Math.round(totalContractedThisMonth * 100) / 100,
        totalRevenueThisMonth: Math.round(totalRevenueThisMonth * 100) / 100,
        activeUsers,
        newUsersThisMonth,
        churnedUsersThisMonth,
        churnRate: Math.round(churnRate * 100) / 100,
        arpu: Math.round(arpu * 100) / 100,
        ltv: Math.round(ltv * 100) / 100,
        avgLifetimeMonths: Math.round(avgLifetimeMonths * 10) / 10,
        monthlyMRR,
        topCustomers,
        recentActivity,
        totalSubsCount: subs.length,
        totalPaymentsCount: filteredPayments.length,
      });
    } catch (e: any) {
      console.error('SaaS metrics error:', e);
      res.status(500).json({ error: e.message || 'Erro ao calcular métricas SaaS.' });
    }
  });

  // Debug endpoint disabled (was used during dev to inspect Asaas data)
  app.get("/api/asaas/debug", (_req, res) => {
    res.status(404).json({ error: 'Endpoint disabled.' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
