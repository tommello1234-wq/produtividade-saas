import { supabase } from './supabase';

export type MindmapShare = {
  id: string;
  owner_id: string;
  source_node_id: string;
  title: string | null;
  data: { nodes: any[]; edges: any[] };
  created_at: string;
  updated_at: string;
};

/**
 * Cria (ou retorna a existente) um compartilhamento público para o mindmap
 * de um determinado `sourceNodeId` dentro do academy do usuário logado.
 *
 * Usa unique(owner_id, source_node_id) para garantir 1 share por mapa.
 */
export async function createOrGetShare(params: {
  sourceNodeId: string;
  title: string;
  data: { nodes: any[]; edges: any[] };
}): Promise<MindmapShare> {
  const { sourceNodeId, title, data } = params;

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Você precisa estar logado para compartilhar.');

  // Tenta achar uma share existente para esse nó
  const { data: existing, error: selectError } = await supabase
    .from('mindmap_shares')
    .select('*')
    .eq('owner_id', user.id)
    .eq('source_node_id', sourceNodeId)
    .maybeSingle();

  if (selectError) throw selectError;

  if (existing) {
    // Atualiza os dados pra refletir o estado atual no momento da geração do link
    const { data: updated, error: updErr } = await supabase
      .from('mindmap_shares')
      .update({ title, data })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (updErr) throw updErr;
    return updated as MindmapShare;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('mindmap_shares')
    .insert({
      owner_id: user.id,
      source_node_id: sourceNodeId,
      title,
      data,
    })
    .select('*')
    .single();

  if (insertError) throw insertError;
  return inserted as MindmapShare;
}

/**
 * Atualiza o conteúdo de uma share existente (chamado em background sempre
 * que o dono edita o mapa, pra refletir live no link público).
 */
export async function updateShareData(
  shareId: string,
  data: { nodes: any[]; edges: any[] },
  title?: string,
): Promise<void> {
  const payload: Record<string, any> = { data };
  if (title !== undefined) payload.title = title;
  const { error } = await supabase
    .from('mindmap_shares')
    .update(payload)
    .eq('id', shareId);
  if (error) {
    // Não joga: edição local não pode falhar por causa do share
    console.warn('Falha ao sincronizar share:', error.message);
  }
}

/**
 * Busca uma share pública por id (sem auth — usa anon key + RLS público).
 */
export async function fetchPublicShare(shareId: string): Promise<MindmapShare | null> {
  const { data, error } = await supabase
    .from('mindmap_shares')
    .select('*')
    .eq('id', shareId)
    .maybeSingle();
  if (error) {
    console.error('Erro ao buscar share:', error);
    return null;
  }
  return (data as MindmapShare) || null;
}

/**
 * Assina UPDATEs em uma share específica via Supabase Realtime.
 * Retorna função de unsubscribe.
 */
export function subscribeToShare(
  shareId: string,
  onUpdate: (share: MindmapShare) => void,
): () => void {
  const channel = supabase
    .channel(`mindmap_share:${shareId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'mindmap_shares',
        filter: `id=eq.${shareId}`,
      },
      (payload: any) => {
        if (payload.new) onUpdate(payload.new as MindmapShare);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Monta a URL pública absoluta de uma share, baseada no host atual.
 */
export function buildShareUrl(shareId: string): string {
  if (typeof window === 'undefined') return `/?share=${shareId}`;
  const { origin } = window.location;
  return `${origin}/?share=${shareId}`;
}

/**
 * Lê o `?share=<id>` da URL, se houver.
 */
export function getShareIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const id = params.get('share');
  return id && id.length > 0 ? id : null;
}
