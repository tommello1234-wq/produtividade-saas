import React, { useEffect, useMemo, useState } from 'react';
import { Link as LinkIcon, AlertTriangle, Loader2 } from 'lucide-react';
import { MindMapEditor } from './MindMapEditor';
import { fetchPublicShare, subscribeToShare, type MindmapShare } from '../lib/share';

type Props = {
  shareId: string;
};

/**
 * Public, unauthenticated read-only viewer for a shared mindmap.
 * Subscribes to Supabase Realtime UPDATEs so that owner edits
 * propagate live without a page refresh.
 */
export default function SharedMindMapViewer({ shareId }: Props) {
  const [share, setShare] = useState<MindmapShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await fetchPublicShare(shareId);
      if (cancelled) return;
      if (!result) {
        setNotFound(true);
      } else {
        setShare(result);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  // Realtime subscription — updates the local state on every UPDATE
  useEffect(() => {
    if (!share) return;
    const unsub = subscribeToShare(shareId, (updated) => {
      setShare(updated);
    });
    return () => unsub();
  }, [shareId, share?.id]); // re-subscribe only when the share id is first set

  // Memoize derived nodes/edges so MindMapEditor (read-only) only re-syncs
  // when the underlying data actually changes.
  const initialNodes = useMemo(() => share?.data?.nodes ?? [], [share?.data]);
  const initialEdges = useMemo(() => share?.data?.edges ?? [], [share?.data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex items-center gap-3 text-accent font-mono text-xs animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin" />
          CARREGANDO MAPA...
        </div>
      </div>
    );
  }

  if (notFound || !share) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface border border-border-subtle p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-error mx-auto mb-4" />
          <h1 className="text-sm font-mono tracking-[0.2em] text-text-main font-bold mb-2">
            MAPA NÃO ENCONTRADO
          </h1>
          <p className="text-text-muted text-xs leading-relaxed">
            O link pode ter expirado ou estar incorreto. Peça um novo link a
            quem compartilhou.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Top header (read-only badge + title) */}
      <header className="border-b border-border-subtle bg-surface/80 backdrop-blur px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[10px] font-mono tracking-[0.2em] text-accent border border-accent/40 px-2 py-1 font-bold shrink-0">
            VISUALIZAÇÃO
          </span>
          <h1 className="text-sm font-mono text-text-main truncate">
            {share.title || 'Mapa Mental'}
          </h1>
        </div>
        <div className="text-[10px] font-mono tracking-[0.2em] text-text-muted hidden sm:block">
          ATUALIZA EM TEMPO REAL · DUPLO-CLIQUE NOS CARDS
        </div>
      </header>

      {/* Map fills the rest */}
      <main className="flex-1 relative">
        <MindMapEditor
          key={share.id}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          onChange={() => { /* read-only: ignore */ }}
          readOnly
          renderNodeModal={renderReadOnlyNodeModal}
        />
      </main>
    </div>
  );
}

/**
 * Read-only modal for shared viewers. Mirrors the editor's modal but
 * disables all edit affordances. Shows label, description, URL, image.
 */
function renderReadOnlyNodeModal(node: any, onClose: () => void, _onSave: (data: any) => void) {
  const data = node?.data || {};
  const label: string = data.label || 'Sem título';
  const description: string = data.description || '';
  const url: string = data.url || '';
  const emoji: string = data.emoji || '';
  const image: string | undefined = data.image || data.coverImage;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border-subtle max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {image && (
          <div className="w-full aspect-video bg-bg overflow-hidden border-b border-border-subtle">
            <img src={image} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            {emoji && <span className="text-2xl leading-none mt-0.5">{emoji}</span>}
            <h2 className="text-lg font-bold text-text-main flex-1">
              {label}
            </h2>
          </div>

          {description && (
            <p className="text-sm text-text-muted leading-relaxed whitespace-pre-wrap">
              {description}
            </p>
          )}

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-mono text-accent hover:underline break-all"
            >
              <LinkIcon className="w-3 h-3 shrink-0" />
              {url}
            </a>
          )}

          {!description && !url && !image && (
            <p className="text-text-muted text-xs italic">
              Esse card não tem informações adicionais.
            </p>
          )}

          <div className="pt-2 border-t border-border-subtle flex justify-end">
            <button
              onClick={onClose}
              className="text-[10px] font-mono tracking-[0.2em] text-text-muted hover:text-text-main transition-colors"
            >
              FECHAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
