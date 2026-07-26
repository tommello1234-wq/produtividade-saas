import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { supabase } from '../lib/supabase';
import { Brain, Search, X, Filter, Zap } from 'lucide-react';

// ---------- Types ----------
type NodeType =
  | 'user'
  | 'group'
  | 'transaction'
  | 'asset'
  | 'treasure'
  | 'task'
  | 'habit'
  | 'academy';

interface GNode {
  id: string;
  label: string;
  type: NodeType;
  meta?: any;
  val?: number;
  color?: string;
}

interface GLink {
  source: string;
  target: string;
  kind?: string;
}

// ---------- Color palette per node type ----------
const TYPE_COLOR: Record<NodeType, string> = {
  user: '#FFB020',       // accent
  group: '#6B7280',      // gray
  transaction: '#22C55E',// green
  asset: '#06B6D4',      // cyan
  treasure: '#F59E0B',   // amber
  task: '#8B5CF6',       // violet
  habit: '#EF4444',      // red
  academy: '#EC4899',    // pink
};

const TYPE_LABEL: Record<NodeType, string> = {
  user: 'VOCÊ',
  group: 'CATEGORIA',
  transaction: 'TRANSAÇÃO',
  asset: 'ATIVO',
  treasure: 'META',
  task: 'TAREFA',
  habit: 'HÁBITO',
  academy: 'ACADEMY',
};

// ---------- Helpers ----------
const slug = (s: string) => s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

function collectAcademyNodes(data: any): Array<{ id: string; title: string; parentId: string | null }> {
  if (!data) return [];
  // academy_data could be array of nodes {id, parentId, title, ...}
  if (Array.isArray(data)) {
    return data
      .filter((n: any) => n && n.id && n.title)
      .map((n: any) => ({ id: String(n.id), title: String(n.title), parentId: n.parentId ? String(n.parentId) : null }));
  }
  return [];
}

export default function SegundoCerebro() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<{
    transactions: any[];
    assets: any[];
    treasures: any[];
    tasks: any[];
    habits: any[];
    academy: any[];
  }>({ transactions: [], assets: [], treasures: [], tasks: [], habits: [], academy: [] });

  const [activeTypes, setActiveTypes] = useState<Set<NodeType>>(
    new Set<NodeType>(['transaction', 'asset', 'treasure', 'task', 'habit', 'academy'])
  );
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GNode | null>(null);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      setDims({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setDims({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Fetch data
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const [transactions, assets, treasures, tasks, habits, academy] = await Promise.all([
          supabase.from('financial_transactions').select('*').eq('user_id', user.id).limit(50000),
          supabase.from('financial_assets').select('*').eq('user_id', user.id),
          supabase.from('financial_treasures').select('*').eq('user_id', user.id),
          supabase.from('work_tasks').select('*').eq('user_id', user.id),
          supabase.from('habits').select('*').eq('user_id', user.id),
          supabase.from('academy_data').select('data').eq('user_id', user.id).maybeSingle(),
        ]);

        setRawData({
          transactions: transactions.data || [],
          assets: assets.data || [],
          treasures: treasures.data || [],
          tasks: tasks.data || [],
          habits: habits.data || [],
          academy: collectAcademyNodes(academy.data?.data),
        });
      } catch (err) {
        console.error('Erro ao buscar dados do Segundo Cérebro:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Build graph
  const graph = useMemo(() => {
    const nodes: GNode[] = [];
    const links: GLink[] = [];
    const pushedIds = new Set<string>();
    const addNode = (n: GNode) => {
      if (pushedIds.has(n.id)) return;
      pushedIds.add(n.id);
      nodes.push(n);
    };

    // Root user node
    addNode({ id: 'user', label: 'VOCÊ', type: 'user', val: 40, color: TYPE_COLOR.user });

    // ---- Categoria groups (agregadores) ----
    const categoryToId = new Map<string, string>();
    const ensureCategoryNode = (rawCategory: string) => {
      const key = rawCategory?.trim() || 'SEM CATEGORIA';
      if (categoryToId.has(key)) return categoryToId.get(key)!;
      const id = `cat:${slug(key)}`;
      categoryToId.set(key, id);
      addNode({ id, label: key.toUpperCase(), type: 'group', val: 10, color: TYPE_COLOR.group, meta: { raw: key } });
      links.push({ source: 'user', target: id, kind: 'owns' });
      return id;
    };

    // ---- Transactions ----
    if (activeTypes.has('transaction')) {
      rawData.transactions.forEach((t: any) => {
        const id = `tx:${t.id}`;
        addNode({
          id,
          label: t.description || 'Transação',
          type: 'transaction',
          val: Math.min(12, 3 + Math.log1p(Math.abs(Number(t.amount) || 0))),
          color: Number(t.amount) >= 0 ? TYPE_COLOR.transaction : '#F87171',
          meta: t,
        });
        const catId = ensureCategoryNode(t.category || 'SEM CATEGORIA');
        links.push({ source: catId, target: id, kind: 'category' });
      });
    }

    // ---- Assets ----
    if (activeTypes.has('asset')) {
      rawData.assets.forEach((a: any) => {
        const id = `ast:${a.id}`;
        addNode({
          id,
          label: a.ticker || a.name || 'Ativo',
          type: 'asset',
          val: 6,
          color: a.color || TYPE_COLOR.asset,
          meta: a,
        });
        const catId = ensureCategoryNode(a.type || 'ATIVOS');
        links.push({ source: catId, target: id, kind: 'asset-type' });
      });
    }

    // ---- Treasures (Metas) ----
    if (activeTypes.has('treasure')) {
      rawData.treasures.forEach((g: any) => {
        const id = `gl:${g.id}`;
        addNode({
          id,
          label: g.title || 'Meta',
          type: 'treasure',
          val: 8,
          color: TYPE_COLOR.treasure,
          meta: g,
        });
        links.push({ source: 'user', target: id, kind: 'goal' });
      });
    }

    // ---- Tasks ----
    if (activeTypes.has('task')) {
      rawData.tasks.forEach((t: any) => {
        const id = `tk:${t.id}`;
        addNode({
          id,
          label: t.title || 'Tarefa',
          type: 'task',
          val: 5,
          color: TYPE_COLOR.task,
          meta: t,
        });
        links.push({ source: 'user', target: id, kind: 'task' });

        // tags → categoria
        const tags: string[] = Array.isArray(t.tags) ? t.tags : [];
        tags.forEach((tag) => {
          if (!tag) return;
          const catId = ensureCategoryNode(`#${tag}`);
          links.push({ source: catId, target: id, kind: 'tag' });
        });
      });
    }

    // ---- Habits ----
    if (activeTypes.has('habit')) {
      rawData.habits.forEach((h: any) => {
        const id = `hb:${h.id}`;
        addNode({
          id,
          label: h.title || 'Hábito',
          type: 'habit',
          val: 5,
          color: TYPE_COLOR.habit,
          meta: h,
        });
        links.push({ source: 'user', target: id, kind: 'habit' });
      });
    }

    // ---- Academy (hierarquia) ----
    if (activeTypes.has('academy')) {
      rawData.academy.forEach((n) => {
        const id = `ac:${n.id}`;
        addNode({
          id,
          label: n.title,
          type: 'academy',
          val: 6,
          color: TYPE_COLOR.academy,
          meta: n,
        });
      });
      rawData.academy.forEach((n) => {
        const id = `ac:${n.id}`;
        if (n.parentId) {
          links.push({ source: `ac:${n.parentId}`, target: id, kind: 'academy-parent' });
        } else {
          links.push({ source: 'user', target: id, kind: 'academy-root' });
        }
      });
    }

    // Search filter: dim nodes that don't match
    return { nodes, links };
  }, [rawData, activeTypes]);

  // Highlight search matches
  const matchSet = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return null;
    const ids = new Set<string>();
    graph.nodes.forEach((n) => {
      if (n.label.toLowerCase().includes(s)) ids.add(n.id);
    });
    return ids;
  }, [search, graph.nodes]);

  const toggleType = (t: NodeType) => {
    setActiveTypes((prev) => {
      const n = new Set(prev);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });
  };

  const onNodeClick = useCallback((n: any) => {
    setSelected(n);
    if (fgRef.current) {
      fgRef.current.centerAt(n.x, n.y, 500);
      fgRef.current.zoom(2.2, 500);
    }
  }, []);

  // Custom painter for labels + colors
  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.label as string;
      const fontSize = Math.max(10 / globalScale, 2.5);
      const r = (node.val ?? 5) * 0.8 + 2;

      const highlighted = matchSet ? matchSet.has(node.id) : true;
      const alpha = highlighted ? 1 : 0.15;

      // Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
      ctx.fillStyle = node.color || '#fff';
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = '#0b0b0d';
      ctx.stroke();

      // Label (only for important/selected/zoomed)
      const shouldShowLabel =
        node.type === 'user' ||
        node.type === 'group' ||
        globalScale > 1.3 ||
        (selected && selected.id === node.id) ||
        (matchSet && matchSet.has(node.id));

      if (shouldShowLabel) {
        ctx.font = `${node.type === 'user' ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = alpha;
        ctx.fillText(label.length > 36 ? label.slice(0, 34) + '…' : label, node.x, node.y + r + 2);
      }

      ctx.globalAlpha = 1;
    },
    [matchSet, selected]
  );

  const totalNodes = graph.nodes.length;
  const totalEdges = graph.links.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="text-[10px] font-mono text-text-muted tracking-[0.2em] mb-1 flex items-center gap-2">
          <Brain className="w-3 h-3" /> KNOWLEDGE GRAPH // NEURAL
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-none">
          SEGUNDO
          <br />
          <span className="text-accent">CÉREBRO</span>
        </h1>
        <p className="text-text-muted text-sm mt-3 max-w-xl">
          Todas as informações do seu sistema conectadas em um mapa vivo. Clique num nó pra ver detalhes,
          filtre por tipo e descubra conexões entre finanças, hábitos, tarefas e conteúdo.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border border-border-subtle p-4">
          <div className="text-[9px] font-mono text-text-muted tracking-[0.2em]">NÓS</div>
          <div className="text-2xl font-black">{totalNodes}</div>
        </div>
        <div className="border border-border-subtle p-4">
          <div className="text-[9px] font-mono text-text-muted tracking-[0.2em]">CONEXÕES</div>
          <div className="text-2xl font-black">{totalEdges}</div>
        </div>
        <div className="border border-border-subtle p-4">
          <div className="text-[9px] font-mono text-text-muted tracking-[0.2em]">TIPOS ATIVOS</div>
          <div className="text-2xl font-black">{activeTypes.size}</div>
        </div>
        <div className="border border-border-subtle p-4">
          <div className="text-[9px] font-mono text-text-muted tracking-[0.2em]">STATUS</div>
          <div className="text-2xl font-black text-success flex items-center gap-2">
            <Zap className="w-5 h-5" /> ATIVO
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 border border-border-subtle px-3 py-2 flex-1 min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nó..."
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-text-muted/60"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-text-muted hover:text-text-main">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-text-muted">
          <Filter className="w-3 h-3" /> FILTROS
        </div>
        {(Object.keys(TYPE_LABEL) as NodeType[])
          .filter((t) => t !== 'user' && t !== 'group')
          .map((t) => {
            const active = activeTypes.has(t);
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono tracking-[0.15em] border transition-colors ${
                  active ? 'border-accent text-text-main bg-accent/10' : 'border-border-subtle text-text-muted hover:text-text-main'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLOR[t] }} />
                {TYPE_LABEL[t]}
              </button>
            );
          })}
      </div>

      {/* Graph */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div
          ref={containerRef}
          className="relative lg:col-span-3 border border-border-subtle bg-surface/30 overflow-hidden"
          style={{ height: '70vh', minHeight: 500 }}
        >
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-text-muted font-mono text-xs animate-pulse">
              CARREGANDO NEURÔNIOS...
            </div>
          ) : totalNodes <= 1 ? (
            <div className="absolute inset-0 flex items-center justify-center text-text-muted font-mono text-xs text-center p-6">
              Nenhum dado encontrado ainda.
              <br />
              Crie transações, tarefas, hábitos ou conteúdo no Academy e volte aqui.
            </div>
          ) : (
            <ForceGraph2D
              ref={fgRef}
              graphData={graph as any}
              width={dims.w}
              height={dims.h}
              backgroundColor="rgba(0,0,0,0)"
              nodeRelSize={4}
              nodeCanvasObject={paintNode}
              nodeCanvasObjectMode={() => 'replace'}
              linkColor={() => 'rgba(255,255,255,0.15)'}
              linkWidth={0.5}
              linkDirectionalParticles={0}
              cooldownTicks={120}
              onNodeClick={onNodeClick}
              onBackgroundClick={() => setSelected(null)}
            />
          )}
        </div>

        {/* Inspector */}
        <aside className="border border-border-subtle p-4 min-h-[200px]">
          <div className="text-[10px] font-mono text-text-muted tracking-[0.2em] mb-3">INSPETOR</div>
          {!selected ? (
            <div className="text-text-muted text-sm">Clique em um nó para ver os detalhes.</div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-[9px] font-mono text-text-muted tracking-[0.2em]">TIPO</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLOR[selected.type] }} />
                  <span className="text-xs font-mono tracking-[0.15em]">{TYPE_LABEL[selected.type]}</span>
                </div>
              </div>
              <div>
                <div className="text-[9px] font-mono text-text-muted tracking-[0.2em]">TÍTULO</div>
                <div className="text-base font-semibold leading-snug">{selected.label}</div>
              </div>
              {selected.meta && (
                <div>
                  <div className="text-[9px] font-mono text-text-muted tracking-[0.2em] mb-1">METADADOS</div>
                  <pre className="text-[10px] font-mono bg-bg/60 border border-border-subtle p-2 max-h-64 overflow-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(selected.meta, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
