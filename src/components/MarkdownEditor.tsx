import React, { useRef, useState, useEffect } from 'react';
import { Bold, Italic, List, ListOrdered, Quote, Maximize2, Minimize2, Heading1, Heading2, Heading3, Type, Minus } from 'lucide-react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
}

// Converte markdown simples (legado) em HTML pro editor WYSIWYG.
// Se o conteúdo já for HTML (tem tags), retorna como está.
function toHtml(input: string): string {
  if (!input) return '';
  if (/<\/?(h1|h2|h3|p|ul|ol|li|strong|em|blockquote|br|div)[\s>]/i.test(input)) {
    return input; // já é HTML
  }
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+?)\*/g, '$1<em>$2</em>');

  const lines = input.split('\n');
  const out: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { closeList(); continue; }
    let m;
    if ((m = line.match(/^###\s+(.*)/))) { closeList(); out.push(`<h3>${inline(m[1])}</h3>`); }
    else if ((m = line.match(/^##\s+(.*)/))) { closeList(); out.push(`<h2>${inline(m[1])}</h2>`); }
    else if ((m = line.match(/^#\s+(.*)/))) { closeList(); out.push(`<h1>${inline(m[1])}</h1>`); }
    else if ((m = line.match(/^>\s+(.*)/))) { closeList(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); }
    else if ((m = line.match(/^[-*]\s+(.*)/))) {
      if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; }
      out.push(`<li>${inline(m[1])}</li>`);
    }
    else if ((m = line.match(/^\d+\.\s+(.*)/))) {
      if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; }
      out.push(`<li>${inline(m[1])}</li>`);
    }
    else { closeList(); out.push(`<p>${inline(line)}</p>`); }
  }
  closeList();
  return out.join('');
}

export default function MarkdownEditor({ value, onChange, placeholder, minHeight = 140 }: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fsEditorRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const initialHtml = useRef(toHtml(value));

  // Seta o HTML inicial uma vez (contentEditable nao deve ser totalmente controlado)
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== initialHtml.current) {
      editorRef.current.innerHTML = initialHtml.current;
    }
  }, []);
  useEffect(() => {
    if (isFullscreen && fsEditorRef.current) {
      fsEditorRef.current.innerHTML = (editorRef.current?.innerHTML) ?? initialHtml.current;
      fsEditorRef.current.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen]);

  const getActive = () => (isFullscreen ? fsEditorRef.current : editorRef.current);

  // Índice de títulos (outline) pra navegação lateral no fullscreen
  const [outline, setOutline] = useState<{ text: string; level: number }[]>([]);
  const refreshOutline = () => {
    const el = getActive();
    if (!el) { setOutline([]); return; }
    const heads = Array.from(el.querySelectorAll('h1,h2,h3'));
    setOutline(heads.map((h) => ({ text: h.textContent || '', level: Number(h.tagName[1]) })));
  };
  useEffect(() => {
    if (isFullscreen) setTimeout(refreshOutline, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen]);

  const scrollToHeading = (idx: number) => {
    const el = fsEditorRef.current;
    if (!el) return;
    const heads = Array.from(el.querySelectorAll('h1,h2,h3'));
    heads[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const emit = () => {
    const el = getActive();
    if (el) onChange(el.innerHTML);
    if (isFullscreen) refreshOutline();
  };

  const exec = (cmd: string, val?: string) => {
    const el = getActive();
    if (!el) return;
    el.focus();
    document.execCommand(cmd, false, val);
    // NÃO reescreve o innerHTML do editor ativo (preserva o histórico de undo nativo).
    // Só espelha pro editor inativo.
    const html = el.innerHTML;
    if (isFullscreen) {
      if (editorRef.current) editorRef.current.innerHTML = html;
    } else {
      if (fsEditorRef.current) fsEditorRef.current.innerHTML = html;
    }
    onChange(html);
    if (isFullscreen) refreshOutline();
  };

  // Cola como TEXTO LIMPO (sem estilos/fontes/fundo da origem)
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    emit();
  };

  // Ctrl+Z / Ctrl+Y (e Ctrl+Shift+Z) — usa undo/redo nativo do contentEditable
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      document.execCommand('undo');
      emit();
    } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
      e.preventDefault();
      document.execCommand('redo');
      emit();
    }
  };

  const block = (tag: string) => exec('formatBlock', tag);

  const Toolbar = () => (
    <div className="flex items-center gap-1 flex-wrap border-b border-border-subtle bg-surface-3/30 px-2 py-1.5 sticky top-0 z-10">
      <button type="button" onMouseDown={(e) => { e.preventDefault(); block('H1'); }} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title="Título 1"><Heading1 className="w-4 h-4" /></button>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); block('H2'); }} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title="Título 2"><Heading2 className="w-4 h-4" /></button>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); block('H3'); }} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title="Título 3"><Heading3 className="w-4 h-4" /></button>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); block('P'); }} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title="Texto normal"><Type className="w-4 h-4" /></button>
      <div className="w-px h-5 bg-border-subtle mx-1" />
      <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('bold'); }} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title="Negrito"><Bold className="w-4 h-4" /></button>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('italic'); }} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title="Itálico"><Italic className="w-4 h-4" /></button>
      <div className="w-px h-5 bg-border-subtle mx-1" />
      <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title="Lista"><List className="w-4 h-4" /></button>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList'); }} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title="Lista numerada"><ListOrdered className="w-4 h-4" /></button>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); block('BLOCKQUOTE'); }} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title="Citação"><Quote className="w-4 h-4" /></button>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('insertHorizontalRule'); }} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title="Divisória"><Minus className="w-4 h-4" /></button>
      <div className="flex-1" />
      <button type="button" onMouseDown={(e) => { e.preventDefault(); setIsFullscreen((f) => !f); }} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title={isFullscreen ? 'Reduzir' : 'Expandir'}>
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <>
      <div className="bg-surface-2 border border-border-subtle overflow-hidden">
        <Toolbar />
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          data-placeholder={placeholder}
          className="prose-editor wysiwyg-editor text-sm text-text-main px-4 py-3 focus:outline-none overflow-y-auto"
          style={{ minHeight }}
        />
      </div>

      {isFullscreen && (
        <div className="fixed inset-0 z-[70] bg-bg/95 backdrop-blur-sm flex flex-col p-6 animate-in fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-mono uppercase tracking-widest text-text-muted">Descrição</h3>
            <button type="button" onClick={() => setIsFullscreen(false)} className="text-text-muted hover:text-accent flex items-center gap-2 text-xs font-mono uppercase">
              <Minimize2 className="w-4 h-4" /> Reduzir
            </button>
          </div>
          <div className="flex flex-1 min-h-0 gap-4">
            {/* Sidebar de navegação (índice de títulos) */}
            <aside className="w-60 shrink-0 bg-surface-2 border border-border-subtle overflow-y-auto hidden md:block">
              <div className="px-4 py-3 border-b border-border-subtle text-[10px] font-mono uppercase tracking-widest text-text-muted">
                Índice
              </div>
              <nav className="py-2">
                {outline.length === 0 ? (
                  <div className="px-4 py-2 text-xs text-text-muted/60">Use títulos (H1/H2/H3) pra criar o índice.</div>
                ) : (
                  outline.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => scrollToHeading(i)}
                      className="w-full text-left px-4 py-1.5 text-sm text-text-muted hover:text-accent hover:bg-accent/5 transition-colors truncate"
                      style={{ paddingLeft: `${16 + (h.level - 1) * 14}px`, fontWeight: h.level === 1 ? 700 : 400 }}
                      title={h.text}
                    >
                      {h.text || '(sem título)'}
                    </button>
                  ))
                )}
              </nav>
            </aside>

            <div className="bg-surface-2 border border-border-subtle overflow-hidden flex flex-col flex-1 min-h-0">
              <Toolbar />
              <div
                ref={fsEditorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={emit}
                onKeyDown={handleKeyDown}
          onPaste={handlePaste}
                data-placeholder={placeholder}
                className="prose-editor wysiwyg-editor text-sm text-text-main px-8 py-6 focus:outline-none overflow-y-auto flex-1"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
