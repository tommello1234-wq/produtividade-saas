import express, { type Express } from "express";
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

/**
 * Builds the Express app with all API routes.
 * Reused by both the local dev server (server.ts standalone) and the
 * Vercel serverless wrapper (api/[...path].ts).
 *
 * Does NOT attach Vite middleware nor static-file serving — those are
 * concerns of the standalone runner only.
 */
export function createApiApp(): Express {
  const app = express();

  // Middleware to parse JSON bodies
  app.use(express.json({ limit: '20mb' }));

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

  // ----------------- TICTO WEBHOOK -----------------
  // Recebe eventos da Ticto (postback v2.0) e grava em financial_transactions
  // URL pra cadastrar no painel Ticto: https://SEU-DOMINIO/api/webhook/ticto/SEU_USER_ID
  app.post("/api/webhook/ticto/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const payload = req.body || {};
      const status = String(payload.status || '').toLowerCase();
      const order = payload.order || payload.transaction || payload;

      console.log(`Received Ticto webhook for user ${userId}: status=${status}`);
      // DIAGNOSTIC: persist the raw payload to webhook_debug so we can
      // inspect the real Ticto v2 shape without fighting log truncation.
      // Remove once the parser is confirmed.
      if (supabase) {
        try {
          await supabase.from('webhook_debug').insert([{ source: 'ticto', payload }]);
        } catch (e) {
          console.warn('webhook_debug insert failed:', (e as any)?.message);
        }
      }

      if (!supabase) {
        console.error('Supabase is not configured. Cannot save webhook data.');
        return res.status(500).json({ error: 'Database not configured' });
      }

      // Validação opcional via token (Ticto envia "token" no payload em v2)
      const expectedToken = process.env.TICTO_WEBHOOK_TOKEN;
      if (expectedToken && payload.token !== expectedToken) {
        console.warn('Ticto webhook: token mismatch');
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Identifica produto, valor, ID, data — robusto a variações do payload v2 da Ticto.
      // Estrutura observada: o produto pode vir em payload.product.name, payload.item.name,
      // payload.offer.name, payload.product_name, ou aninhado em items[0].name.
      const items = Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(order?.items)
          ? order.items
          : [];
      const firstItem = items[0] || {};

      const offerName =
        payload.offer?.name || order?.offer?.name || firstItem.offer?.name || firstItem.offer_name || '';
      const baseProductName =
        payload.product?.name ||
        payload.product_name ||
        order?.product?.name ||
        order?.product_name ||
        firstItem.product?.name ||
        firstItem.product_name ||
        firstItem.name ||
        payload.item?.name ||
        payload.item_name ||
        '';
      const productName = baseProductName
        ? offerName
          ? `${baseProductName} - ${offerName}`
          : baseProductName
        : 'Venda Ticto';

      const orderHash =
        order?.hash ||
        order?.order_hash ||
        payload.order_hash ||
        payload.transaction_hash ||
        payload.hash ||
        order?.transaction_hash ||
        `${Date.now()}`;

      // Procura o valor em vários campos. Ticto v2 manda em centavos (>1000).
      const rawAmount =
        order?.paid_amount ??
        payload.paid_amount ??
        order?.amount ??
        payload.amount ??
        order?.value ??
        payload.value ??
        order?.transaction_value ??
        payload.transaction_value ??
        order?.gross_value ??
        payload.gross_value ??
        firstItem.amount ??
        firstItem.value ??
        firstItem.price ??
        0;
      const amountNum = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount) || 0;
      // Heurística: se for inteiro >= 1000 assume centavos; se já tem decimal assume reais.
      const amount = Number.isInteger(amountNum) && amountNum >= 1000 ? amountNum / 100 : amountNum;

      const date = (
        order?.date ||
        order?.paid_at ||
        order?.created_at ||
        payload.paid_at ||
        payload.created_at ||
        payload.date ||
        new Date().toISOString()
      )
        .toString()
        .split('T')[0];

      // Status que GERAM uma venda válida (entrada de dinheiro)
      const incomeStatuses = ['authorized', 'close', 'pix_paid', 'bank_slip_paid'];
      // Status que REVERTEM uma venda (chargeback / refund)
      const reverseStatuses = ['refunded', 'chargeback', 'claimed'];
      // Status pendentes (não geram entrada ainda)
      const pendingStatuses = ['pix_created', 'bank_slip_created', 'waiting_payment', 'trial'];

      if (incomeStatuses.includes(status)) {
        const newTx = {
          user_id: userId,
          description: `[Ticto] ${productName} (ID: ${orderHash})`,
          category: 'Vendas|#10B981',
          amount: Math.abs(amount),
          type: 'income',
          date,
        };
        const { error } = await supabase.from('financial_transactions').insert([newTx]);
        if (error) {
          console.error('Error inserting Ticto transaction:', error);
          if (error.message?.includes('row-level security')) {
            console.error('RLS Error: server needs SUPABASE_SERVICE_ROLE_KEY.');
          }
          return res.status(500).json({ error: 'Failed to insert transaction', details: error.message });
        }
        console.log('Recorded Ticto sale for user', userId);
      } else if (reverseStatuses.includes(status)) {
        const newTx = {
          user_id: userId,
          description: `[Ticto] ESTORNO: ${productName} (ID: ${orderHash})`,
          category: 'Estorno|#EF4444',
          amount: Math.abs(amount),
          type: 'expense',
          date,
        };
        const { error } = await supabase.from('financial_transactions').insert([newTx]);
        if (error) {
          console.error('Error inserting Ticto reversal:', error);
        } else {
          console.log('Recorded Ticto reversal for user', userId);
        }
      } else if (pendingStatuses.includes(status)) {
        // Pendente: não grava como income, só loga (opcional: armazenar em outra tabela depois)
        console.log(`Ticto pending status (${status}) for ${productName} — not recorded as income`);
      } else {
        console.log(`Ticto status not handled: ${status}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('Ticto webhook error:', error);
      res.status(500).json({ error: 'Internal server error', details: error?.message });
    }
  });

  // ----------------- TICTO CSV IMPORT -----------------
  // Recebe um array de linhas do CSV exportado pelo painel da Ticto
  // Body: { userId: string, rows: Array<{ data, status, produto, valor, hash, ... }> }
  app.post("/api/ticto/import-csv", async (req, res) => {
    try {
      const { userId, rows } = req.body || {};
      if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
      if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows precisa ser um array' });
      if (!supabase) return res.status(500).json({ error: 'Banco não configurado' });

      // Buscar IDs já existentes pra evitar duplicação
      const { data: existing } = await supabase
        .from('financial_transactions')
        .select('description')
        .eq('user_id', userId)
        .like('description', '%[Ticto]%');

      const existingIds = new Set(
        (existing || [])
          .map((tx: any) => {
            const m = tx.description.match(/\(ID: ([^)]+)\)/);
            return m ? m[1] : null;
          })
          .filter(Boolean)
      );

      const incomeStatusKeys = ['aprovado', 'aprovada', 'approved', 'authorized', 'autorizado', 'autorizada', 'paid', 'pago', 'paga', 'concluido', 'concluida', 'close'];
      const reverseStatusKeys = ['estornado', 'estornada', 'reembolsado', 'reembolsada', 'refunded', 'chargeback', 'cancelado', 'cancelada'];

      // Helper: pega o primeiro valor não-vazio entre várias chaves possíveis (tolerante a acento/encoding)
      const pick = (row: any, ...keys: string[]) => {
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== '') return row[k];
        }
        return '';
      };

      const newTxs: any[] = [];
      let skipped = 0;

      for (const row of rows) {
        // Status — tolerante a acentos/encoding
        const status = String(
          pick(row, 'Status', 'status', 'Situação', 'Situacao', 'situacao')
        ).toLowerCase().trim();

        // Produto + Oferta combinados na descrição
        const productName = pick(
          row,
          'Nome do Produto',
          'product',
          'produto',
          'Produto',
          'product_name'
        ) || 'Venda Ticto';
        const offerName = pick(row, 'Nome da Oferta', 'offer', 'Oferta');
        const fullProductName = offerName ? `${productName} - ${offerName}` : productName;

        // ID único pra dedup: Código da Transação + Código da Oferta (mesma transação pode ter várias linhas/itens)
        const transactionCode = pick(
          row,
          'Código da Transação',
          'Codigo da Transacao',
          'transaction_code',
          'transaction_hash'
        );
        const offerCode = pick(row, 'Código da Oferta', 'Codigo da Oferta', 'offer_code');
        const orderCode = pick(row, 'Código do Pedido', 'Codigo do Pedido', 'order_code');
        const hash = transactionCode
          ? `${transactionCode}${offerCode ? '_' + offerCode : ''}`
          : (orderCode || `${Date.now()}_${Math.random().toString(36).slice(2)}`);

        // Valor — Ticto tem "Valor do Item" (item) e "Valor Pago" (cliente pagou, com taxa). Usa Valor do Item.
        const valorRaw = pick(
          row,
          'Valor do Item',
          'Valor Pago',
          'Valor do Pedido',
          'value',
          'valor',
          'Valor',
          'amount'
        );
        const amount = typeof valorRaw === 'number'
          ? valorRaw
          : Number(String(valorRaw).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')) || 0;

        // Data — prefere Data do Pedido (timestamp da venda)
        const dateRaw = pick(
          row,
          'Data do Pedido',
          'Data da Transação',
          'Data da Transacao',
          'Data da Venda',
          'date',
          'data',
          'Data',
          'created_at'
        ) || new Date().toISOString();
        let date = String(dateRaw);
        if (date.includes('/')) {
          // "DD/MM/YYYY HH:MM:SS" ou "DD/MM/YYYY"
          const [d, m, y] = date.split(' ')[0].split('/');
          if (d && m && y) date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        } else {
          date = date.split('T')[0];
        }

        if (existingIds.has(String(hash))) {
          skipped++;
          continue;
        }

        const isIncome = incomeStatusKeys.some((k) => status.includes(k));
        const isReverse = reverseStatusKeys.some((k) => status.includes(k));

        if (amount <= 0) {
          skipped++;
          continue;
        }

        if (isReverse) {
          newTxs.push({
            user_id: userId,
            description: `[Ticto] ESTORNO: ${fullProductName} (ID: ${hash})`,
            category: 'Estorno|#EF4444',
            amount: Math.abs(amount),
            type: 'expense',
            date,
          });
        } else if (isIncome || (!status && amount > 0)) {
          // Status vazio + valor > 0 = presume venda válida
          newTxs.push({
            user_id: userId,
            description: `[Ticto] ${fullProductName} (ID: ${hash})`,
            category: 'Vendas|#10B981',
            amount: Math.abs(amount),
            type: 'income',
            date,
          });
        } else {
          // Status pendente/recusado/outro — pula
          skipped++;
        }
      }

      if (newTxs.length === 0) {
        return res.json({ success: true, count: 0, skipped, message: 'Nenhuma nova venda pra importar.' });
      }

      const { error } = await supabase.from('financial_transactions').insert(newTxs);
      if (error) {
        console.error('Ticto CSV import error:', error);
        if (error.message?.includes('row-level security')) {
          return res.status(500).json({ error: 'Erro de RLS: configure SUPABASE_SERVICE_ROLE_KEY no servidor.' });
        }
        return res.status(500).json({ error: 'Falha ao inserir', details: error.message });
      }

      res.json({ success: true, count: newTxs.length, skipped });
    } catch (error: any) {
      console.error('Ticto CSV import exception:', error);
      res.status(500).json({ error: error?.message || 'Erro interno' });
    }
  });

  // ----------------- EXPENSES (CNPJ) CSV IMPORT -----------------
  // Aceita CSV de fatura de cartão / extrato bancário e insere como despesas.
  // Smart grouping: se o mesmo "vendor" aparecer várias vezes, vira um grupo
  // pai "META ADS" com subitens "META ADS - 01", "META ADS - 02"...
  app.post("/api/expenses/import-csv", async (req, res) => {
    try {
      const { userId, rows, defaultCategory, prefix } = req.body || {};
      if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
      if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows precisa ser um array' });
      if (!supabase) return res.status(500).json({ error: 'Banco não configurado' });

      const category = defaultCategory || 'Outros|#9CA3AF';
      const tag = typeof prefix === 'string' && prefix.trim() ? prefix.trim() : '[CNPJ]';

      const pick = (row: any, ...keys: string[]) => {
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') return row[k];
        }
        return '';
      };

      // Normaliza nome do vendor (remove códigos de transação, asteriscos, números soltos)
      const normalizeVendor = (raw: string): string => {
        if (!raw) return 'Sem descrição';
        let s = String(raw).trim();
        // Remove sufixos comuns: *XXXXXXX, /XXXXXXX, números longos
        s = s.replace(/\*[A-Z0-9]{4,}.*$/i, '').trim();      // FACEBK*MFGN... → FACEBK
        s = s.replace(/\s+\d{6,}.*$/, '').trim();             // VENDOR 12345678... → VENDOR
        s = s.replace(/\s+\/\s*.*$/, '').trim();              // VENDOR / extra → VENDOR
        s = s.replace(/\s{2,}/g, ' ');                         // multi spaces
        // Mapeamento de aliases conhecidos
        const lower = s.toLowerCase();
        const aliases: Record<string, string> = {
          'facebk': 'Meta Ads',
          'facebook': 'Meta Ads',
          'fb': 'Meta Ads',
          'meta': 'Meta Ads',
          'google ads': 'Google Ads',
          'google': 'Google',
          'goog': 'Google',
          'apple.com/bill': 'Apple',
          'apple': 'Apple',
          'anthropic': 'Claude',
          'claude': 'Claude',
          'openai': 'OpenAI',
          'figma': 'Figma',
          'replicate': 'Replicate',
          'lovable': 'Lovable',
          'vercel': 'Vercel',
          'supabase': 'Supabase',
          'github': 'GitHub',
          'cursor': 'Cursor',
          'asaas': 'Asaas',
          'ticto': 'Ticto',
        };
        for (const key of Object.keys(aliases)) {
          if (lower.includes(key)) return aliases[key];
        }
        // Title case do nome restante
        return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      };

      // Parser de valor (R$ 47,00 / -47.00 / 47,5)
      const parseAmount = (raw: any): number => {
        if (typeof raw === 'number') return raw;
        if (!raw) return 0;
        const cleaned = String(raw).replace(/[^\d,.\-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.');
        return Number(cleaned) || 0;
      };

      // Parser de data (DD/MM/YYYY ou ISO)
      const parseDate = (raw: any): string => {
        if (!raw) return new Date().toISOString().split('T')[0];
        let s = String(raw).trim();
        if (s.includes('/')) {
          const [d, m, y] = s.split(' ')[0].split('/');
          if (d && m && y) return `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        return s.split('T')[0];
      };

      // Extrai o "vendor real" da descrição lidando com padrões de refund/IOF do Nubank:
      //   "Crédito de \"Figma\""        → vendor=Figma  (refund)
      //   "Estorno de \"X\""             → vendor=X     (refund)
      //   "IOF de volta de Figma"        → vendor=IOF Figma  (refund de IOF)
      //   "IOF de \"Figma\""             → vendor=IOF Figma  (charge de IOF)
      // Assim, uma compra e seu refund acabam com o MESMO vendor + valor → netting funciona.
      const extractVendor = (raw: string): { vendor: string; isRefundDesc: boolean } => {
        let s = String(raw || '').trim();
        let isRefundDesc = false;
        let isIof = false;
        let m;
        if ((m = s.match(/^(?:cr[eé]dito|estorno)\s+de\s+"?(.+?)"?$/i))) {
          s = m[1]; isRefundDesc = true;
        } else if ((m = s.match(/^iof\s+de\s+volta\s+de\s+(.+)$/i))) {
          s = m[1].replace(/^"|"$/g, ''); isRefundDesc = true; isIof = true;
        } else if ((m = s.match(/^iof\s+de\s+"?(.+?)"?$/i))) {
          s = m[1]; isIof = true;
        }
        let vendor = normalizeVendor(s);
        // IOF de X vira "IOF X" pra não bagunçar com a cobrança normal de X
        if (isIof) vendor = `IOF ${vendor}`;
        return { vendor, isRefundDesc };
      };

      // Parse cada linha mantendo o SINAL do valor
      type Parsed = { vendor: string; amount: number; signedAmount: number; date: string; rawDesc: string; isRefundDesc: boolean };
      const allRows: Parsed[] = rows
        .map((row: any) => {
          const rawDesc = String(
            pick(row, 'description', 'descrição', 'descricao', 'Description', 'Descrição',
                 'title', 'Title', 'histórico', 'historico', 'Histórico',
                 'estabelecimento', 'Estabelecimento', 'merchant', 'Merchant',
                 'detalhes', 'Detalhes')
          ).trim();
          const amountRaw = pick(row, 'amount', 'valor', 'Valor', 'Amount', 'value', 'Value');
          const signed = parseAmount(amountRaw);
          const { vendor, isRefundDesc } = extractVendor(rawDesc);
          return {
            vendor,
            amount: Math.abs(signed),
            signedAmount: signed,
            date: parseDate(pick(row, 'date', 'data', 'Date', 'Data', 'dt', 'created_at')),
            rawDesc,
            isRefundDesc,
          };
        })
        // Pula entradas inválidas
        .filter((p: Parsed) => p.amount > 0 && p.vendor !== 'Sem descrição')
        // Pula "Pagamento recebido" (é o pagamento da fatura anterior, não despesa)
        .filter((p: Parsed) => !/^pagamento\s+recebido/i.test(p.rawDesc.trim()));

      // Detecta charges com refund correspondente (mesmo vendor + mesmo valor abs).
      // Marca AMBOS pra skip.
      const skipSet = new Set<number>();
      const positives = allRows.map((r: Parsed, i: number) => ({ r, i })).filter((x) => x.r.signedAmount > 0);
      const negatives = allRows.map((r: Parsed, i: number) => ({ r, i })).filter((x) => x.r.signedAmount < 0);

      negatives.forEach((neg) => {
        // Procura primeiro charge positivo com mesmo vendor + valor que ainda não foi pareado
        const match = positives.find(
          (pos) =>
            !skipSet.has(pos.i) &&
            pos.r.vendor === neg.r.vendor &&
            Math.abs(pos.r.amount - neg.r.amount) < 0.01
        );
        if (match) {
          skipSet.add(match.i);
          skipSet.add(neg.i);
        } else {
          // Refund órfão (sem charge correspondente) → ignora também
          skipSet.add(neg.i);
        }
      });

      // O que sobra são SOMENTE despesas líquidas (charges sem refund)
      const parsed: Parsed[] = allRows.filter((_: Parsed, i: number) => !skipSet.has(i));

      // Busca despesas existentes pra dedup (por hash composto vendor+amount+date)
      const { data: existing } = await supabase
        .from('financial_transactions')
        .select('description, amount, date')
        .eq('user_id', userId)
        .like('description', `%${tag}%`);

      const existingHashes = new Set(
        (existing || []).map((tx: any) => {
          const desc = tx.description.replace(`${tag} `, '').split(' - ')[0];
          return `${desc}_${Math.abs(Number(tx.amount)).toFixed(2)}_${tx.date}`;
        })
      );

      // Agrupa por vendor pra detectar quando precisa subitens
      const byVendor = new Map<string, Parsed[]>();
      parsed.forEach((p: Parsed) => {
        if (!byVendor.has(p.vendor)) byVendor.set(p.vendor, []);
        byVendor.get(p.vendor)!.push(p);
      });

      const newTxs: any[] = [];
      let skipped = 0;

      byVendor.forEach((entries: Parsed[], vendor: string) => {
        if (entries.length === 1) {
          // Item único → "[CNPJ] VENDOR" sem sufixo
          const e = entries[0];
          const hash = `${vendor}_${e.amount.toFixed(2)}_${e.date}`;
          if (existingHashes.has(hash)) { skipped++; return; }
          newTxs.push({
            user_id: userId,
            description: `${tag} ${vendor}`,
            category,
            amount: e.amount,
            type: 'expense',
            date: e.date,
          });
        } else {
          // Múltiplos → "[CNPJ] VENDOR - 01", "VENDOR - 02"... (vira grupo na UI)
          // Ordena por data crescente pra numeração fazer sentido
          const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          sorted.forEach((e: Parsed, idx: number) => {
            const hash = `${vendor}_${e.amount.toFixed(2)}_${e.date}`;
            if (existingHashes.has(hash)) { skipped++; return; }
            const num = String(idx + 1).padStart(2, '0');
            newTxs.push({
              user_id: userId,
              description: `${tag} ${vendor} - ${num}`,
              category,
              amount: e.amount,
              type: 'expense',
              date: e.date,
            });
          });
        }
      });

      if (newTxs.length === 0) {
        return res.json({ success: true, count: 0, skipped, message: 'Nenhuma nova despesa pra importar.' });
      }

      const { error } = await supabase.from('financial_transactions').insert(newTxs);
      if (error) {
        console.error('Expenses CSV import error:', error);
        if (error.message?.includes('row-level security')) {
          return res.status(500).json({ error: 'Erro de RLS: configure SUPABASE_SERVICE_ROLE_KEY no servidor.' });
        }
        return res.status(500).json({ error: 'Falha ao inserir', details: error.message });
      }

      // Conta vendors únicos importados (pra mostrar na mensagem)
      const uniqueVendors = new Set(newTxs.map((t: any) => t.description.split(' - ')[0])).size;

      res.json({ success: true, count: newTxs.length, vendors: uniqueVendors, skipped });
    } catch (error: any) {
      console.error('Expenses CSV import exception:', error);
      res.status(500).json({ error: error?.message || 'Erro interno' });
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

  // ----------------- CONTA SIMPLES SYNC -----------------
  // Pulls banking + credit-card statements via OAuth2, dedups by id, and
  // upserts into financial_transactions tagged entity_type='pj'.
  // Body: { userId: string, days?: number (default 90) }
  app.post("/api/conta-simples/sync", async (req, res) => {
    try {
      const { userId, days = 90 } = req.body || {};
      if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
      if (!supabase) return res.status(500).json({ error: 'Banco não configurado' });

      const apiKey = process.env.CS_API_KEY;
      const apiSecret = process.env.CS_API_SECRET;
      const env = (process.env.CS_ENV as 'production' | 'sandbox') || 'production';
      if (!apiKey || !apiSecret) {
        return res.status(400).json({ error: 'CS_API_KEY ou CS_API_SECRET não configurados.' });
      }

      const { getAccessToken, listBanking, listCreditCard, mapToFinancialTransaction } =
        await import('./src/lib/conta-simples-server.js');

      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - Number(days));
      const fmt = (d: Date) => d.toISOString().split('T')[0];

      console.log(`[ContaSimples] sync ${fmt(startDate)} → ${fmt(today)} env=${env}`);

      const token = await getAccessToken(apiKey, apiSecret, env);

      const [banking, cards] = await Promise.all([
        listBanking(token, { env, startDate: fmt(startDate), endDate: fmt(today) }).catch((e) => {
          console.warn('[ContaSimples] banking falhou:', e.message);
          return [];
        }),
        listCreditCard(token, { env, startDate: fmt(startDate), endDate: fmt(today) }).catch((e) => {
          console.warn('[ContaSimples] credit-card falhou:', e.message);
          return [];
        }),
      ]);

      console.log(`[ContaSimples] banking=${banking.length} cards=${cards.length}`);

      // Dedup: pega os IDs já gravados pra esse user via prefix [ContaSimples]
      const { data: existingTxs } = await supabase
        .from('financial_transactions')
        .select('description')
        .eq('user_id', userId)
        .like('description', '%[ContaSimples]%');

      const existingIds = new Set(
        (existingTxs || [])
          .map((t: any) => {
            const m = t.description.match(/\(ID: (\d+)\)/);
            return m ? m[1] : null;
          })
          .filter(Boolean),
      );

      const allTxs = [
        ...banking.map((tx) => ({ tx, source: 'banking' as const })),
        ...cards.map((tx) => ({ tx, source: 'credit-card' as const })),
      ];

      const newRows: any[] = [];
      let skipped = 0;
      for (const { tx, source } of allTxs) {
        if (existingIds.has(String(tx.id))) {
          skipped++;
          continue;
        }
        const mapped = mapToFinancialTransaction(tx, userId, source);
        if (mapped) newRows.push(mapped);
      }

      if (newRows.length === 0) {
        return res.json({
          success: true,
          count: 0,
          skipped,
          message: skipped > 0 ? `Nada novo. ${skipped} já estavam no banco.` : 'Nenhuma transação no período.',
        });
      }

      const { error } = await supabase.from('financial_transactions').insert(newRows);
      if (error) {
        console.error('[ContaSimples] insert error:', error);
        return res.status(500).json({ error: 'Falha ao gravar', details: error.message });
      }

      res.json({ success: true, count: newRows.length, skipped });
    } catch (error: any) {
      console.error('[ContaSimples] sync error:', error);
      res.status(500).json({ error: error?.message || 'Falha ao sincronizar Conta Simples.' });
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

      // ----------------- TICTO (do Supabase, gravadas via webhook/CSV) -----------------
      // Lê transações Ticto do user_id passado no body que tenham a keyword na descrição
      const { userId: requestUserId } = req.body || {};
      let tictoRevenue = 0;
      let tictoRevenueThisMonth = 0;
      let tictoTopCustomers: any[] = [];
      let tictoRecentActivity: any[] = [];
      let tictoCount = 0;

      if (requestUserId && supabase) {
        try {
          const { data: tictoTxs } = await supabase
            .from('financial_transactions')
            .select('description, amount, type, date')
            .eq('user_id', requestUserId)
            .like('description', '%[Ticto]%');

          const filteredTicto = (tictoTxs || []).filter(
            (tx: any) => tx.description.toLowerCase().includes(kwLower)
          );
          // Vendas (income) somam, estornos (expense) subtraem
          filteredTicto.forEach((tx: any) => {
            const sign = tx.type === 'expense' ? -1 : 1;
            tictoRevenue += Number(tx.amount || 0) * sign;
          });
          // Mês corrente
          filteredTicto
            .filter((tx: any) => new Date(tx.date) >= monthStart)
            .forEach((tx: any) => {
              const sign = tx.type === 'expense' ? -1 : 1;
              tictoRevenueThisMonth += Number(tx.amount || 0) * sign;
            });
          tictoCount = filteredTicto.length;

          // Atividade recente: últimas 5 vendas Ticto
          tictoRecentActivity = filteredTicto
            .filter((tx: any) => tx.type === 'income')
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5)
            .map((tx: any) => {
              // Extrai nome do produto da descrição "[Ticto] PRODUTO (ID: xxx)"
              const m = tx.description.match(/\[Ticto\]\s*(.+?)\s*\(ID:/);
              const product = m ? m[1] : tx.description;
              return {
                id: `ticto_${tx.date}_${Math.random().toString(36).slice(2, 7)}`,
                customer: product,
                value: Number(tx.amount || 0),
                date: tx.date,
                description: `[Ticto] ${product}`,
              };
            });
        } catch (e: any) {
          console.error('Erro ao buscar dados Ticto do Supabase:', e);
        }
      }

      // Combinar Asaas + Ticto nos cards de FATURADO/RECEBIDO
      const combinedTotalRevenue = totalRevenue + tictoRevenue;
      const combinedTotalContracted = totalContracted + tictoRevenue; // Ticto só conta vendas confirmadas
      const combinedTotalRevenueThisMonth = totalRevenueThisMonth + tictoRevenueThisMonth;
      const combinedTotalContractedThisMonth = totalContractedThisMonth + tictoRevenueThisMonth;

      // Mesclar atividade recente Asaas + Ticto, ordenar por data, top 10
      const mergedActivity = [...recentActivity, ...tictoRecentActivity]
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

      res.json({
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(arr * 100) / 100,
        // Totais combinados (Asaas + Ticto)
        totalContracted: Math.round(combinedTotalContracted * 100) / 100,
        totalRevenue: Math.round(combinedTotalRevenue * 100) / 100,
        totalPending: Math.round(totalPending * 100) / 100, // só Asaas (Ticto não tem pending tracking)
        recurringOpen: Math.round(recurringOpen * 100) / 100,
        annualSales: Math.round(annualSales * 100) / 100,
        monthlySales: Math.round(monthlySales * 100) / 100,
        annualCustomersCount,
        totalContractedThisMonth: Math.round(combinedTotalContractedThisMonth * 100) / 100,
        totalRevenueThisMonth: Math.round(combinedTotalRevenueThisMonth * 100) / 100,
        // Breakdown por origem
        asaasRevenue: Math.round(totalRevenue * 100) / 100,
        tictoRevenue: Math.round(tictoRevenue * 100) / 100,
        tictoCount,
        // SaaS metrics (só do Asaas — Ticto não tem state de subscription)
        activeUsers,
        newUsersThisMonth,
        churnedUsersThisMonth,
        churnRate: Math.round(churnRate * 100) / 100,
        arpu: Math.round(arpu * 100) / 100,
        ltv: Math.round(ltv * 100) / 100,
        avgLifetimeMonths: Math.round(avgLifetimeMonths * 10) / 10,
        monthlyMRR,
        topCustomers,
        recentActivity: mergedActivity,
        totalSubsCount: subs.length,
        totalPaymentsCount: filteredPayments.length + tictoCount,
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

  return app;
}

/**
 * Starts the API + Vite (or static) server locally on PORT 8080.
 * Used for `npm run dev` and any non-serverless host. NOT used on Vercel —
 * Vercel imports `createApiApp` from api/[...path].ts and ignores this.
 */
async function startStandaloneServer() {
  const app = createApiApp();
  const PORT = Number(process.env.PORT) || 8080;

  // Vite middleware for development (HMR, transform on demand).
  // In production-standalone, serves the static build from `dist/`.
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
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

// Auto-start the standalone server only when not running on Vercel.
// On Vercel, this file is imported by api/[...path].ts which uses createApiApp.
if (!process.env.VERCEL) {
  startStandaloneServer();
}
