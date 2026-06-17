-- QuanAd 2.1 Equity Research Desk persistence.
-- Stores structured research runs, deterministic snapshots, agent reports, and event logs.

create table if not exists public.equity_research_runs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete cascade,
    ticker text not null,
    company_name text,
    exchange text,
    analysis_date date not null default current_date,
    status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
    recommendation text not null default 'insufficient_data' check (recommendation in ('buy', 'hold', 'sell', 'insufficient_data')),
    confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
    research_depth text not null default 'shallow' check (research_depth in ('shallow', 'medium', 'deep')),
    selected_analysts text[] not null default array['market', 'social', 'news', 'fundamentals'],
    quick_model text not null default 'default-fast',
    deep_model text not null default 'default-research',
    source_surface text not null default 'research',
    share_slug text unique,
    error_message text,
    disclaimer text not null default 'Not investment advice. For educational and informational use only.',
    data_snapshot_id uuid,
    final_summary text,
    main_upside text,
    main_risk text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz
);

create table if not exists public.equity_research_snapshots (
    id uuid primary key default gen_random_uuid(),
    run_id uuid not null references public.equity_research_runs(id) on delete cascade,
    ticker text not null,
    company_name text,
    exchange text,
    analysis_date date not null,
    price_data_window text not null default '6mo',
    latest_price numeric,
    previous_close numeric,
    daily_change numeric,
    volume numeric,
    market_cap numeric,
    fundamentals jsonb not null default '{}'::jsonb,
    technical_indicators jsonb not null default '{}'::jsonb,
    news_items jsonb not null default '[]'::jsonb,
    rag_context jsonb not null default '[]'::jsonb,
    sentiment_summary jsonb not null default '{}'::jsonb,
    risk_metrics jsonb not null default '{}'::jsonb,
    data_sources text[] not null default array[]::text[],
    created_at timestamptz not null default now()
);

create table if not exists public.equity_research_reports (
    id uuid primary key default gen_random_uuid(),
    run_id uuid not null references public.equity_research_runs(id) on delete cascade,
    agent_key text not null,
    agent_name text not null,
    team text not null,
    status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'skipped')),
    title text not null,
    markdown text not null,
    summary_points text[] not null default array[]::text[],
    evidence jsonb not null default '[]'::jsonb,
    confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
    risk_flags text[] not null default array[]::text[],
    started_at timestamptz,
    completed_at timestamptz,
    token_input integer,
    token_output integer,
    created_at timestamptz not null default now()
);

create table if not exists public.equity_research_events (
    id uuid primary key default gen_random_uuid(),
    run_id uuid not null references public.equity_research_runs(id) on delete cascade,
    event_timestamp timestamptz not null default now(),
    agent_key text,
    agent_name text,
    event_type text not null check (event_type in ('reasoning', 'tool', 'report', 'status', 'final', 'error')),
    label text not null,
    content text not null,
    tool_name text,
    tool_args jsonb,
    token_input integer,
    token_output integer
);

alter table public.equity_research_runs enable row level security;
alter table public.equity_research_snapshots enable row level security;
alter table public.equity_research_reports enable row level security;
alter table public.equity_research_events enable row level security;

create policy "Users can read own equity research runs"
on public.equity_research_runs for select
using (auth.uid() = user_id or share_slug is not null);

create policy "Users can create own equity research runs"
on public.equity_research_runs for insert
with check (auth.uid() = user_id);

create policy "Users can update own equity research runs"
on public.equity_research_runs for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own equity research runs"
on public.equity_research_runs for delete
using (auth.uid() = user_id);

create policy "Read snapshots through accessible runs"
on public.equity_research_snapshots for select
using (exists (
    select 1 from public.equity_research_runs r
    where r.id = run_id and (r.user_id = auth.uid() or r.share_slug is not null)
));

create policy "Read reports through accessible runs"
on public.equity_research_reports for select
using (exists (
    select 1 from public.equity_research_runs r
    where r.id = run_id and (r.user_id = auth.uid() or r.share_slug is not null)
));

create policy "Read events through accessible runs"
on public.equity_research_events for select
using (exists (
    select 1 from public.equity_research_runs r
    where r.id = run_id and r.user_id = auth.uid()
));

create policy "Service role can manage equity research runs"
on public.equity_research_runs for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "Service role can manage equity research snapshots"
on public.equity_research_snapshots for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "Service role can manage equity research reports"
on public.equity_research_reports for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "Service role can manage equity research events"
on public.equity_research_events for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create index if not exists idx_equity_research_runs_user_created_at
on public.equity_research_runs(user_id, created_at desc);

create index if not exists idx_equity_research_runs_share_slug
on public.equity_research_runs(share_slug) where share_slug is not null;

create index if not exists idx_equity_research_reports_run_agent
on public.equity_research_reports(run_id, agent_key);

create index if not exists idx_equity_research_events_run_time
on public.equity_research_events(run_id, event_timestamp);

grant select, insert, update, delete on public.equity_research_runs to authenticated;
grant select on public.equity_research_snapshots, public.equity_research_reports, public.equity_research_events to authenticated;
grant all on public.equity_research_runs, public.equity_research_snapshots, public.equity_research_reports, public.equity_research_events to service_role;
