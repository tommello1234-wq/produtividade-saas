-- ============================================================
-- Mindmap public sharing — schema, RLS, and Realtime
-- Run this once in Supabase Dashboard → SQL Editor
-- ============================================================

-- Table: one row per shared mindmap (per source node within Academy).
create table if not exists public.mindmap_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_node_id text not null,
  title text,
  data jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, source_node_id)
);

create index if not exists mindmap_shares_owner_idx
  on public.mindmap_shares (owner_id);

-- RLS
alter table public.mindmap_shares enable row level security;

-- Anyone (including anon) can read a share. The id is the secret.
drop policy if exists "mindmap_shares_public_read" on public.mindmap_shares;
create policy "mindmap_shares_public_read"
  on public.mindmap_shares
  for select
  using (true);

-- Only the owner can insert/update/delete their shares.
drop policy if exists "mindmap_shares_owner_insert" on public.mindmap_shares;
create policy "mindmap_shares_owner_insert"
  on public.mindmap_shares
  for insert
  with check (auth.uid() = owner_id);

drop policy if exists "mindmap_shares_owner_update" on public.mindmap_shares;
create policy "mindmap_shares_owner_update"
  on public.mindmap_shares
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "mindmap_shares_owner_delete" on public.mindmap_shares;
create policy "mindmap_shares_owner_delete"
  on public.mindmap_shares
  for delete
  using (auth.uid() = owner_id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists mindmap_shares_set_updated_at on public.mindmap_shares;
create trigger mindmap_shares_set_updated_at
  before update on public.mindmap_shares
  for each row execute function public.set_updated_at();

-- Enable Realtime so viewers receive UPDATE events live.
-- (Idempotent: ignore error if already in publication.)
do $$
begin
  alter publication supabase_realtime add table public.mindmap_shares;
exception
  when duplicate_object then null;
  when others then null;
end
$$;
