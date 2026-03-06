import React from 'react';

export default function Perfil() {
  return (
    <div className="space-y-12 pb-12">
      <section className="relative border-b border-border-subtle pb-12 mb-12">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-text-muted uppercase mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
            USER SYSTEM // SETTINGS
          </div>
          <h1 className="text-[64px] font-black leading-[0.9] tracking-[-2px] uppercase mb-2">
            USER<br/><span className="text-surface-3">PROFILE</span>
          </h1>
        </div>
      </section>
      <div className="bg-surface-2 border border-border-subtle p-6 text-center font-mono text-text-muted text-sm">
        [ CONFIGURAÇÕES E LIFE SCORE EM CONSTRUÇÃO ]
      </div>
    </div>
  );
}
