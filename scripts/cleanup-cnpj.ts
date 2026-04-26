// One-shot: apaga todas as transações com prefixo [CNPJ] do usuário dado.
// Uso: npx tsx scripts/cleanup-cnpj.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const targetEmail = 'tommello1234@gmail.com';

if (!url || !serviceKey) {
  console.error('Faltam VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1. Resolve user_id pelo email
  const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers();
  if (usersErr) throw usersErr;
  const user = usersData.users.find((u) => u.email === targetEmail);
  if (!user) {
    console.error(`Usuário com email ${targetEmail} não encontrado.`);
    process.exit(1);
  }
  console.log(`User encontrado: ${user.id} (${user.email})`);

  // 2. Conta antes
  const { count: before, error: cErr1 } = await supabase
    .from('financial_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .like('description', '[CNPJ]%');
  if (cErr1) throw cErr1;
  console.log(`Antes: ${before} registros [CNPJ]`);

  if (!before || before === 0) {
    console.log('Nada a apagar.');
    return;
  }

  // 3. Delete
  const { error: delErr, count: deleted } = await supabase
    .from('financial_transactions')
    .delete({ count: 'exact' })
    .eq('user_id', user.id)
    .like('description', '[CNPJ]%');
  if (delErr) throw delErr;
  console.log(`Apagadas: ${deleted}`);

  // 4. Conta depois
  const { count: after } = await supabase
    .from('financial_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .like('description', '[CNPJ]%');
  console.log(`Depois: ${after} registros [CNPJ]`);
}

main().catch((e) => {
  console.error('Falha:', e);
  process.exit(1);
});
