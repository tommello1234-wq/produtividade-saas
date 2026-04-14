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
  const PORT = 3000;

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
