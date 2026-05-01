-- ============================================================
-- Adds entity_type ('pf' | 'pj') to financial_transactions and
-- backfills based on the legacy [Asaas]/[Ticto]/[CNPJ]/[ContaSimples]
-- prefix convention so we can stop relying on regex over description.
-- Run once in Supabase Dashboard → SQL Editor.
-- ============================================================

-- 1. Add column (nullable for backfill)
alter table public.financial_transactions
  add column if not exists entity_type text;

-- 2. Backfill: any transaction whose description starts with one of the
--    PJ-source markers is PJ; everything else is PF.
update public.financial_transactions
   set entity_type = 'pj'
 where entity_type is null
   and (
        description ~* '^\[(Asaas|Ticto|CNPJ|ContaSimples)\]'
   );

update public.financial_transactions
   set entity_type = 'pf'
 where entity_type is null;

-- 3. Lock down: now must always have a value, must be 'pf' or 'pj'.
alter table public.financial_transactions
  alter column entity_type set not null;

alter table public.financial_transactions
  add constraint financial_transactions_entity_type_check
  check (entity_type in ('pf', 'pj'));

-- 4. Default for new inserts (if caller forgets, treats as PF —
--    safer than guessing PJ).
alter table public.financial_transactions
  alter column entity_type set default 'pf';

-- 5. Index — most queries filter by user + entity.
create index if not exists financial_transactions_user_entity_idx
  on public.financial_transactions (user_id, entity_type, date desc);
