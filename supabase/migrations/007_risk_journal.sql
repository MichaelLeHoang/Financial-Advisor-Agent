-- Sprint 7 portfolio risk snapshots and trade journal.
-- Keeps user-owned risk outputs and journal entries behind RLS.

create table if not exists public.risk_snapshots (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    portfolio_id uuid not null references public.portfolios(id) on delete cascade,
    metrics jsonb not null default '{}'::jsonb,
    allocations jsonb not null default '{}'::jsonb,
    correlation_matrix jsonb not null default '{}'::jsonb,
    ai_explanation text,
    created_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    symbol text not null,
    direction text not null check (direction in ('long', 'short')),
    entry_price numeric not null check (entry_price > 0),
    exit_price numeric check (exit_price > 0),
    quantity numeric not null check (quantity > 0),
    fees numeric not null default 0 check (fees >= 0),
    strategy_id uuid references public.strategies(id) on delete set null,
    reason_entry text,
    reason_exit text,
    emotion_tag text,
    mistake_tag text,
    notes text,
    pnl numeric,
    return_pct numeric,
    tags jsonb not null default '[]'::jsonb,
    opened_at timestamptz,
    closed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.risk_snapshots enable row level security;
alter table public.journal_entries enable row level security;

drop policy if exists "Users can manage their own risk snapshots" on public.risk_snapshots;
create policy "Users can manage their own risk snapshots"
on public.risk_snapshots for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own journal entries" on public.journal_entries;
create policy "Users can manage their own journal entries"
on public.journal_entries for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Service role can manage risk snapshots" on public.risk_snapshots;
create policy "Service role can manage risk snapshots"
on public.risk_snapshots for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage journal entries" on public.journal_entries;
create policy "Service role can manage journal entries"
on public.journal_entries for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create index if not exists idx_risk_snapshots_user_portfolio_created_at
on public.risk_snapshots(user_id, portfolio_id, created_at desc);

create index if not exists idx_journal_entries_user_created_at
on public.journal_entries(user_id, created_at desc);

create index if not exists idx_journal_entries_user_symbol
on public.journal_entries(user_id, symbol);

grant select, insert, update, delete on public.risk_snapshots to authenticated;
grant select, insert, update, delete on public.journal_entries to authenticated;

grant all on public.risk_snapshots to service_role;
grant all on public.journal_entries to service_role;
