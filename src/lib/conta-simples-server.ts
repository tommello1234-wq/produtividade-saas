/**
 * Conta Simples API client (server-side only).
 * Ports the Python extractor in /financeiro/extrair.py to TypeScript so
 * sync runs as a Vercel Function instead of a manual local script.
 *
 * Auth: OAuth2 client_credentials (Basic auth with API key + secret).
 * Endpoints used:
 *   - /oauth/v1/access-token              — get bearer token (1800s TTL)
 *   - /statements/v1/banking              — bank account statements
 *   - /statements/v1/credit-card          — corporate card statements
 * Pagination: cursor `nextPageStartKey`.
 */

const API_BASES = {
  production: 'https://api.contasimples.com',
  sandbox: 'https://api-sandbox.contasimples.com',
} as const;

export type CSEnv = keyof typeof API_BASES;

export type CSTransaction = {
  id: number;
  transactionType?: { id?: number; description?: string; subType?: string };
  brlAmount: number;
  totalTransactionAmount?: number;
  transactionDate: string; // ISO
  description?: string;
  sourceDestinationName?: string;
  category?: { id?: number | string | null; description?: string };
  costCenter?: { id?: number | string | null; name?: string; description?: string } | null;
  customCategory?: { id?: number | string | null; name?: string; description?: string } | null;
  finalCardNumber?: string | null;
  bearerName?: string | null;
  accountId?: number;
  status?: number;
  statusDescription?: string;
  // Allow extra fields without strict typing — Conta Simples adds more over time.
  [key: string]: any;
};

type PaginatedResponse = {
  transactions?: CSTransaction[];
  data?: CSTransaction[];
  items?: CSTransaction[];
  results?: CSTransaction[];
  nextPageStartKey?: string;
};

const USER_AGENT = 'produtividade-saas/1.0';

/**
 * Exchange API key + secret for a bearer access token (~30 min TTL).
 */
export async function getAccessToken(
  apiKey: string,
  apiSecret: string,
  env: CSEnv = 'production',
): Promise<string> {
  const base = API_BASES[env];
  const basic = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  const res = await fetch(`${base}/oauth/v1/access-token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Conta Simples auth failed (HTTP ${res.status}): ${text}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Conta Simples auth: empty access_token');
  return json.access_token;
}

/**
 * Generic GET against the API.
 */
async function apiGet<T = any>(
  base: string,
  path: string,
  token: string,
  params?: Record<string, string | number>,
): Promise<T> {
  const qs = params
    ? '?' +
      Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const res = await fetch(`${base}${path}${qs}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Conta Simples ${path} (HTTP ${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

/**
 * Walk all pages of a Conta Simples list endpoint via `nextPageStartKey`.
 * Stops on empty page, missing cursor, or hard limit (safety).
 */
async function paginate(
  base: string,
  path: string,
  token: string,
  baseParams: Record<string, string | number>,
  maxPages = 50,
): Promise<CSTransaction[]> {
  const all: CSTransaction[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string | number> = { ...baseParams };
    if (cursor) params.nextPageStartKey = cursor;
    const data = await apiGet<PaginatedResponse>(base, path, token, params);
    const items = data.transactions || data.data || data.items || data.results || [];
    all.push(...items);
    cursor = data.nextPageStartKey;
    if (!cursor || items.length === 0) break;
  }
  return all;
}

/**
 * List banking statements between two ISO dates (YYYY-MM-DD).
 */
export async function listBanking(
  token: string,
  opts: { env?: CSEnv; startDate?: string; endDate?: string; limit?: number } = {},
): Promise<CSTransaction[]> {
  const env = opts.env ?? 'production';
  const params: Record<string, string | number> = { limit: opts.limit ?? 50 };
  if (opts.startDate) params.startDate = opts.startDate;
  if (opts.endDate) params.endDate = opts.endDate;
  return paginate(API_BASES[env], '/statements/v1/banking', token, params);
}

/**
 * List credit-card statements between two ISO dates.
 */
export async function listCreditCard(
  token: string,
  opts: { env?: CSEnv; startDate?: string; endDate?: string; limit?: number } = {},
): Promise<CSTransaction[]> {
  const env = opts.env ?? 'production';
  const params: Record<string, string | number> = { limit: opts.limit ?? 100 };
  if (opts.startDate) params.startDate = opts.startDate;
  if (opts.endDate) params.endDate = opts.endDate;
  return paginate(API_BASES[env], '/statements/v1/credit-card', token, params);
}

/**
 * Map a Conta Simples transaction into the row shape expected by
 * `financial_transactions`. Always tagged entity_type='pj' since
 * Conta Simples is exclusively for legal entities (CNPJ).
 *
 * We keep `[ContaSimples]` as a description prefix so the existing
 * front-end filters still work, AND we set entity_type='pj' (the new
 * canonical column going forward).
 */
export function mapToFinancialTransaction(
  tx: CSTransaction,
  userId: string,
  source: 'banking' | 'credit-card',
): {
  user_id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
  entity_type: 'pj';
} | null {
  const amount = Number(tx.brlAmount ?? tx.totalTransactionAmount ?? 0);
  if (!Number.isFinite(amount) || amount === 0) return null;

  const type: 'income' | 'expense' = amount > 0 ? 'income' : 'expense';
  const date = (tx.transactionDate || new Date().toISOString()).split('T')[0];

  // Pick the most descriptive label available, in this order of preference.
  const label =
    (tx.description && tx.description.trim()) ||
    tx.sourceDestinationName ||
    tx.transactionType?.description ||
    (source === 'credit-card' ? 'Compra cartão' : 'Movimento bancário');

  // Category: cost center > category > customCategory > transactionType > fallback.
  const categoryName =
    tx.costCenter?.name ||
    tx.costCenter?.description ||
    tx.category?.description ||
    tx.customCategory?.name ||
    tx.customCategory?.description ||
    tx.transactionType?.description ||
    (source === 'credit-card' ? 'Cartão CNPJ' : 'Movimento bancário');

  // Default amber accent — front-end accepts "Name|#HexColor" format.
  const category = `${categoryName}|#FFB020`;

  const description = `[ContaSimples] ${label} (ID: ${tx.id})`;

  return {
    user_id: userId,
    type,
    amount: Math.abs(amount),
    category,
    description,
    date,
    entity_type: 'pj',
  };
}
