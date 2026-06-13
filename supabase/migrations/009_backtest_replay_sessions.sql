-- Sprint 9 Backtest replay sessions for manual bar-by-bar backtesting.
-- Sessions persist playback progress, manual trades, and equity so users can resume.

create table if not exists public.backtest_replay_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    name text not null,
    symbol text not null,
    start_date date not null,
    end_date date not null,
    initial_balance numeric not null,
    status text not null default 'active' check (status in ('active', 'completed')),
    current_index integer not null default 0,
    total_bars integer not null default 0,
    cash numeric not null,
    position_qty numeric not null default 0,
    position_avg_price numeric not null default 0,
    trades jsonb not null default '[]'::jsonb,
    equity_curve jsonb not null default '[]'::jsonb,
    metrics jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.backtest_replay_sessions enable row level security;

drop policy if exists "Users can read their own replay sessions" on public.backtest_replay_sessions;
create policy "Users can read their own replay sessions"
on public.backtest_replay_sessions for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own replay sessions" on public.backtest_replay_sessions;
create policy "Users can insert their own replay sessions"
on public.backtest_replay_sessions for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own replay sessions" on public.backtest_replay_sessions;
create policy "Users can update their own replay sessions"
on public.backtest_replay_sessions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own replay sessions" on public.backtest_replay_sessions;
create policy "Users can delete their own replay sessions"
on public.backtest_replay_sessions for delete
using (auth.uid() = user_id);

drop policy if exists "Service role can manage replay sessions" on public.backtest_replay_sessions;
create policy "Service role can manage replay sessions"
on public.backtest_replay_sessions for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create index if not exists idx_backtest_replay_sessions_user_created_at
on public.backtest_replay_sessions(user_id, created_at desc);

grant select, insert, update, delete on public.backtest_replay_sessions to authenticated;
grant all on public.backtest_replay_sessions to service_role;
