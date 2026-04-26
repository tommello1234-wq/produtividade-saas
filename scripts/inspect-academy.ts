// Inspect academy_data: lista nodes top-level e mostra contagem de mindmapData de cada um.
// Uso: npx tsx scripts/inspect-academy.ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const targetEmail = 'tommello1234@gmail.com';

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: usersData } = await supabase.auth.admin.listUsers();
  const user = usersData.users.find((u) => u.email === targetEmail);
  if (!user) { console.error('User not found'); process.exit(1); }

  const { data: row, error } = await supabase
    .from('academy_data')
    .select('data, updated_at')
    .eq('user_id', user.id)
    .single();

  if (error) { console.error('Erro:', error.message); process.exit(1); }
  if (!row?.data) { console.error('Sem data no banco'); process.exit(1); }

  console.log(`updated_at: ${row.updated_at}`);
  const academyData = row.data as any;
  const nodes: any[] = academyData.nodes || [];
  console.log(`Total de AcademyNodes: ${nodes.length}`);
  console.log('');

  for (const n of nodes) {
    const mm = n.mindmapData;
    const mmInfo = mm
      ? `mindmap=[${mm.nodes?.length || 0} nodes, ${mm.edges?.length || 0} edges]`
      : 'sem mindmap';
    console.log(`- "${n.title}" (id=${n.id}, parentId=${n.parentId}) viewType=${n.viewType || '-'} ${mmInfo}`);

    // Se tem mindmap, mostra labels dos nodes
    if (mm?.nodes?.length) {
      const labels = mm.nodes.map((mn: any) => mn.data?.label || '?').slice(0, 30);
      console.log(`    labels: ${labels.join(', ')}`);
    }
  }
}

main().catch((e) => { console.error('Falha:', e); process.exit(1); });
