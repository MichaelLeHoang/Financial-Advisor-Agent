-- SaaS foundation tables and Row Level Security policies.
-- Run this migration in Supabase SQL editor or through the Supabase CLI.

create extension if not exists "pgcrypto";

create type public.plan_type as enum ('free', 'pro', 'trader', 'quant', 'execution_addon');

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    display_name text,
    plan public.plan_type not null default 'free',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    stripe_customer_id text,
    stripe_subscription_id text,
    plan public.plan_type not null default 'free',
    status text not null default 'inactive',
    current_period_end timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.portfolios (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    name text not null,
    base_currency text not null default 'USD',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.holdings (
    id uuid primary key default gen_random_uuid(),
    portfolio_id uuid not null references public.portfolios(id) on delete cascade,
    symbol text not null,
    asset_type text not null default 'equity',
    quantity numeric not null default 0,
    average_cost numeric not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.watchlists (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.watchlist_assets (
    id uuid primary key default gen_random_uuid(),
    watchlist_id uuid not null references public.watchlists(id) on delete cascade,
    symbol text not null,
    asset_type text not null default 'equity',
    created_at timestamptz not null default now(),
    unique (watchlist_id, symbol, asset_type)
);

create table if not exists public.strategies (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    name text not null,
    strategy_type text not null,
    parameters jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    feature_key text not null,
    quantity int not null default 1,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete set null,
    action text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.portfolios enable row level security;
alter table public.holdings enable row level security;
alter table public.watchlists enable row level security;
alter table public.watchlist_assets enable row level security;
alter table public.strategies enable row level security;
alter table public.usage_events enable row level security;
alter table public.audit_logs enable row level security;

create policy "Users can read their own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can read their own subscriptions"
on public.subscriptions for select
using (auth.uid() = user_id);

create policy "Users can read their own portfolios"
on public.portfolios for select
using (auth.uid() = user_id);

create policy "Users can insert their own portfolios"
on public.portfolios for insert
with check (auth.uid() = user_id);

create policy "Users can update their own portfolios"
on public.portfolios for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own portfolios"
on public.portfolios for delete
using (auth.uid() = user_id);

create policy "Users can manage holdings in their own portfolios"
on public.holdings for all
using (
    exists (
        select 1 from public.portfolios p
        where p.id = portfolio_id and p.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1 from public.portfolios p
        where p.id = portfolio_id and p.user_id = auth.uid()
    )
);

create policy "Users can read their own watchlists"
on public.watchlists for select
using (auth.uid() = user_id);

create policy "Users can insert their own watchlists"
on public.watchlists for insert
with check (auth.uid() = user_id);

create policy "Users can update their own watchlists"
on public.watchlists for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own watchlists"
on public.watchlists for delete
using (auth.uid() = user_id);

create policy "Users can manage assets in their own watchlists"
on public.watchlist_assets for all
using (
    exists (
        select 1 from public.watchlists w
        where w.id = watchlist_id and w.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1 from public.watchlists w
        where w.id = watchlist_id and w.user_id = auth.uid()
    )
);

create policy "Users can manage their own strategies"
on public.strategies for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read their own usage events"
on public.usage_events for select
using (auth.uid() = user_id);

create policy "Users can read their own audit logs"
on public.audit_logs for select
using (auth.uid() = user_id);

create index if not exists idx_portfolios_user_id on public.portfolios(user_id);
create index if not exists idx_watchlists_user_id on public.watchlists(user_id);
create index if not exists idx_usage_events_user_id_created_at on public.usage_events(user_id, created_at desc);
create index if not exists idx_audit_logs_user_id_created_at on public.audit_logs(user_id, created_at desc);
