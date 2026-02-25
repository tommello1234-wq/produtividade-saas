import React from 'react';

export default function Finances() {
  const transactions = [
    { id: 1, description: 'Salário', amount: 5000, type: 'income', date: '05/12/2023' },
    { id: 2, description: 'Aluguel', amount: -1500, type: 'expense', date: '10/12/2023' },
    { id: 3, description: 'Supermercado', amount: -450, type: 'expense', date: '12/12/2023' },
    { id: 4, description: 'Freelance', amount: 800, type: 'income', date: '15/12/2023' },
  ];

  return (
    <div className="space-y-12 pb-12">
      <section className="relative border-b border-border-subtle pb-12 mb-12">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-text-muted uppercase mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-info"></div>
            SYSTEM ONLINE // TREASURY
          </div>
          <h1 className="text-[64px] font-black leading-[0.9] tracking-[-2px] uppercase mb-2">
            FINANCIAL<br/><span className="text-surface-3">OVERVIEW</span>
          </h1>
          <p className="text-[13px] text-text-muted max-w-lg leading-[1.7] mb-7 font-mono border-l-2 border-info pl-3">
            Controle de recursos e saldo. Monitore entradas e saídas para manter a estabilidade do sistema.
          </p>
        </div>
      </section>

      <section>
        <div className="flex items-baseline gap-4 mb-9">
          <span className="text-[11px] font-bold text-info tracking-[0.1em] font-mono border border-info/30 px-2 py-0.5">01</span>
          <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">System Balance</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <div className="bg-surface-2 border border-border-subtle p-6">
            <div className="text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-4">CURRENT_BALANCE</div>
            <div className="text-3xl font-black tracking-[-1px] mb-2">R$ 3.850,00</div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-mono text-text-muted">STATUS:</span>
              <span className="text-[11px] font-mono text-info">OPTIMAL</span>
            </div>
          </div>
          
          <div className="bg-surface border border-border-subtle p-6">
            <div className="text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-4">TOTAL_INCOME</div>
            <div className="text-3xl font-black tracking-[-1px] text-success mb-2">R$ 5.800,00</div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-mono text-text-muted">TREND:</span>
              <span className="text-[11px] font-mono text-success">+12.5%</span>
            </div>
          </div>

          <div className="bg-surface border border-border-subtle p-6">
            <div className="text-[10px] font-mono text-text-dark uppercase tracking-[0.1em] mb-4">TOTAL_EXPENSES</div>
            <div className="text-3xl font-black tracking-[-1px] text-error mb-2">R$ 1.950,00</div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-mono text-text-muted">LIMIT:</span>
              <span className="text-[11px] font-mono text-text-muted">45% USED</span>
            </div>
          </div>
        </div>

        <div className="flex items-baseline gap-4 mb-6">
          <span className="text-[11px] font-bold text-info tracking-[0.1em] font-mono border border-info/30 px-2 py-0.5">02</span>
          <h2 className="text-xl font-extrabold tracking-[-0.3px] uppercase">Transaction Log</h2>
        </div>

        <div className="bg-surface-2 border border-border-subtle">
          <div className="flex border-b border-border-subtle bg-surface-3/50 p-3">
            <div className="w-1/2 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em]">Description</div>
            <div className="w-1/4 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em]">Date</div>
            <div className="w-1/4 text-[10px] font-mono text-text-muted uppercase tracking-[0.1em] text-right">Amount</div>
          </div>
          <div className="divide-y divide-border-subtle">
            {transactions.map(t => (
              <div key={t.id} className="flex p-4 items-center hover:bg-surface transition-colors">
                <div className="w-1/2 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${t.type === 'income' ? 'bg-success' : 'bg-error'}`}></div>
                  <span className="text-sm font-medium uppercase tracking-[0.04em] text-text-main">{t.description}</span>
                </div>
                <div className="w-1/4 text-xs font-mono text-text-muted">{t.date}</div>
                <div className={`w-1/4 text-right text-sm font-mono font-bold ${t.type === 'income' ? 'text-success' : 'text-error'}`}>
                  {t.type === 'income' ? '+' : '-'} R$ {Math.abs(t.amount).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
