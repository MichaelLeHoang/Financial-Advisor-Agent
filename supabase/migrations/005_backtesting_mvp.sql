-- Sprint 5 Backtesting MVP tables and policies.
-- Keeps user-owned backtest data protected with RLS and explicit grants.

create table if not exists public.assets (
    id uuid primary key default gen_random_uuid(),
    symbol text not null unique,
    name text,
    asset_type text not null default 'equity',
    exchange text,
    currency text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.backtest_runs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    strategy_id uuid references public.strategies(id) on delete set null,
    strategy_name text not null,
    strategy_type text not null,
    symbols jsonb not null default '[]'::jsonb,
    parameters jsonb not null default '{}'::jsonb,
    assumptions jsonb not null default '{}'::jsonb,
    metrics jsonb not null default '{}'::jsonb,
    equity_curve jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.backtest_trades (
    id uuid primary key default gen_random_uuid(),
    backtest_run_id uuid not null references public.backtest_runs(id) on delete cascade,
    symbol text not null,
    side text not null check (side in ('buy', 'sell')),
    quantity numeric not null,
    price numeric not null,
    fees numeric not null default 0,
    pnl numeric,
    reason text,
    executed_at timestamptz not null,
    created_at timestamptz not null default now()
);

alter table public.assets enable row level security;
alter table public.backtest_runs enable row level security;
alter table public.backtest_trades enable row level security;

drop policy if exists "Authenticated users can read assets" on public.assets;
create policy "Authenticated users can read assets"
on public.assets for select
to authenticated
using (true);

drop policy if exists "Service role can manage assets" on public.assets;
create policy "Service role can manage assets"
on public.assets for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Users can read their own backtest runs" on public.backtest_runs;
create policy "Users can read their own backtest runs"
on public.backtest_runs for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own backtest runs" on public.backtest_runs;
create policy "Users can insert their own backtest runs"
on public.backtest_runs for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own backtest runs" on public.backtest_runs;
create policy "Users can delete their own backtest runs"
on public.backtest_runs for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read their own backtest trades" on public.backtest_trades;
create policy "Users can read their own backtest trades"
on public.backtest_trades for select
using (
    exists (
        select 1 from public.backtest_runs r
        where r.id = backtest_run_id and r.user_id = auth.uid()
    )
);

drop policy if exists "Users can insert trades for their own backtest runs" on public.backtest_trades;
create policy "Users can insert trades for their own backtest runs"
on public.backtest_trades for insert
with check (
    exists (
        select 1 from public.backtest_runs r
        where r.id = backtest_run_id and r.user_id = auth.uid()
    )
);

drop policy if exists "Users can delete trades for their own backtest runs" on public.backtest_trades;
create policy "Users can delete trades for their own backtest runs"
on public.backtest_trades for delete
using (
    exists (
        select 1 from public.backtest_runs r
        where r.id = backtest_run_id and r.user_id = auth.uid()
    )
);

drop policy if exists "Service role can manage backtest runs" on public.backtest_runs;
create policy "Service role can manage backtest runs"
on public.backtest_runs for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage backtest trades" on public.backtest_trades;
create policy "Service role can manage backtest trades"
on public.backtest_trades for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create index if not exists idx_backtest_runs_user_created_at
on public.backtest_runs(user_id, created_at desc);

create index if not exists idx_backtest_runs_strategy_id
on public.backtest_runs(strategy_id);

create index if not exists idx_backtest_trades_run_id
on public.backtest_trades(backtest_run_id);

create index if not exists idx_assets_symbol
on public.assets(symbol);

grant select on public.assets to authenticated;
grant select, insert, delete on public.backtest_runs to authenticated;
grant select, insert, delete on public.backtest_trades to authenticated;
grant select, insert, update, delete on public.strategies to authenticated;

grant all on public.assets to service_role;
grant all on public.backtest_runs to service_role;
grant all on public.backtest_trades to service_role;
grant all on public.strategies to service_role;
