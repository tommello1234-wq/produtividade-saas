import React, { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bold, Italic, List, ListOrdered, Quote, Maximize2, Minimize2, Eye, Pencil, Heading1, Heading2, Heading3 } from 'lucide-react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export default function MarkdownEditor({ value, onChange, placeholder, minHeight = 120 }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Abre em modo preview quando já existe conteúdo (mostra formatado direto)
  const [showPreview, setShowPreview] = useState(() => !!value.trim());

  const getRef = () => (isFullscreen ? fsTextareaRef.current : textareaRef.current);

  // Aplica formatação no texto selecionado (envolve com prefix/suffix) ou insere no início da linha
  const wrap = (prefix: string, suffix: string = prefix) => {
    const ta = getRef();
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const newText = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
    onChange(newText);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = start + prefix.length;
      ta.selectionEnd = end + prefix.length;
    }, 0);
  };

  // Insere prefixo no começo da(s) linha(s) selecionada(s) — pra títulos, listas, quote
  const linePrefix = (prefix: string) => {
    const ta = getRef();
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    // acha início da linha
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const before = value.slice(0, lineStart);
    const block = value.slice(lineStart, end);
    const after = value.slice(end);
    const newBlock = block
      .split('\n')
      .map((l) => (l.startsWith(prefix) ? l : prefix + l))
      .join('\n');
    onChange(before + newBlock + after);
    setTimeout(() => ta.focus(), 0);
  };

  const Toolbar = () => (
    <div className="flex items-center gap-1 flex-wrap border-b border-border-subtle bg-surface-3/30 px-2 py-1.5">
      <button type="button" onClick={() => linePrefix('# ')} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title="Título 1"><Heading1 className="w-4 h-4" /></button>
      <button type="button" onClick={() => linePrefix('## ')} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title="Título 2"><Heading2 className="w-4 h-4" /></button>
      <button type="button" onClick={() => linePrefix('### ')} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title="Título 3"><Heading3 className="w-4 h-4" /></button>
      <div className="w-px h-5 bg-border-subtle mx-1" />
      <button type="button" onClick={() => wrap('**')} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title="Negrito"><Bold className="w-4 h-4" /></button>
      <button type="button" onClick={() => wrap('*')} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title="Itálico"><Italic className="w-4 h-4" /></button>
      <div className="w-px h-5 bg-border-subtle mx-1" />
      <button type="button" onClick={() => linePrefix('- ')} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title="Lista"><List className="w-4 h-4" /></button>
      <button type="button" onClick={() => linePrefix('1. ')} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title="Lista numerada"><ListOrdered className="w-4 h-4" /></button>
      <button type="button" onClick={() => linePrefix('> ')} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title="Citação"><Quote className="w-4 h-4" /></button>
      <div className="flex-1" />
      <button type="button" onClick={() => setShowPreview((p) => !p)} className={`p-1.5 rounded-sm ${showPreview ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-accent hover:bg-accent/10'}`} title={showPreview ? 'Editar' : 'Pré-visualizar'}>
        {showPreview ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
      <button type="button" onClick={() => setIsFullscreen((f) => !f)} className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-sm" title={isFullscreen ? 'Reduzir' : 'Expandir'}>
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
    </div>
  );

  const previewClass = 'prose-editor text-sm text-text-main px-4 py-3 overflow-y-auto';

  const editor = (fullscreen: boolean) => (
    <div className={`bg-surface-2 border border-border-subtle ${fullscreen ? 'flex flex-col flex-1 min-h-0' : ''}`}>
      <Toolbar />
      {showPreview ? (
        <div className={previewClass} style={{ minHeight: fullscreen ? undefined : minHeight, flex: fullscreen ? 1 : undefined }}>
          {value.trim() ? (
            <ReactMarkdown>{value}</ReactMarkdown>
          ) : (
            <span className="text-text-muted/50">Nada pra pré-visualizar.</span>
          )}
        </div>
      ) : (
        <textarea
          ref={fullscreen ? fsTextareaRef : textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent px-4 py-3 text-sm text-text-main focus:outline-none resize-y font-mono leading-relaxed"
          style={{ minHeight: fullscreen ? undefined : minHeight, flex: fullscreen ? 1 : undefined, height: fullscreen ? '100%' : undefined }}
        />
      )}
    </div>
  );

  return (
    <>
      {editor(false)}
      {isFullscreen && (
        <div className="fixed inset-0 z-[70] bg-bg/95 backdrop-blur-sm flex flex-col p-6 animate-in fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-mono uppercase tracking-widest text-text-muted">Descrição</h3>
            <button type="button" onClick={() => setIsFullscreen(false)} className="text-text-muted hover:text-accent flex items-center gap-2 text-xs font-mono uppercase">
              <Minimize2 className="w-4 h-4" /> Reduzir
            </button>
          </div>
          {editor(true)}
        </div>
      )}
    </>
  );
}
