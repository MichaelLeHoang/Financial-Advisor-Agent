-- Owner-scoped thesis and decision records for Investment holdings.

create table if not exists public.investment_theses (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    portfolio_id uuid not null references public.portfolios(id) on delete cascade,
    holding_id uuid not null unique references public.holdings(id) on delete cascade,
    symbol text not null,
    statement text not null,
    supporting_evidence_json jsonb not null default '[]'::jsonb,
    risk_evidence_json jsonb not null default '[]'::jsonb,
    invalidation_conditions_json jsonb not null default '[]'::jsonb,
    status text not null default 'active',
    next_review_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint investment_theses_status_check check (status in ('active', 'needs_review', 'invalidated')),
    constraint investment_theses_supporting_array_check check (jsonb_typeof(supporting_evidence_json) = 'array'),
    constraint investment_theses_risk_array_check check (jsonb_typeof(risk_evidence_json) = 'array'),
    constraint investment_theses_conditions_array_check check (jsonb_typeof(invalidation_conditions_json) = 'array')
);

create table if not exists public.investment_decisions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    portfolio_id uuid not null references public.portfolios(id) on delete cascade,
    holding_id uuid not null references public.holdings(id) on delete cascade,
    symbol text not null,
    action text not null,
    rationale text not null,
    policy_exception text,
    created_at timestamptz not null default now(),
    constraint investment_decisions_action_check check (action in ('hold', 'trim'))
);

alter table public.investment_theses enable row level security;
alter table public.investment_decisions enable row level security;

revoke all on public.investment_theses, public.investment_decisions from anon, authenticated;
grant select, insert, update on public.investment_theses to authenticated;
grant select, insert on public.investment_decisions to authenticated;

create policy "Users can read their own investment theses" on public.investment_theses
for select using ((select auth.uid()) = user_id);
create policy "Users can create their own investment theses" on public.investment_theses
for insert with check (
    (select auth.uid()) = user_id
    and exists (
        select 1 from public.portfolios p
        join public.holdings h on h.portfolio_id = p.id
        where p.id = portfolio_id and p.user_id = (select auth.uid()) and h.id = holding_id
    )
);
create policy "Users can update their own investment theses" on public.investment_theses
for update using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and exists (
        select 1 from public.portfolios p
        join public.holdings h on h.portfolio_id = p.id
        where p.id = portfolio_id and p.user_id = (select auth.uid()) and h.id = holding_id
    )
);

create policy "Users can read their own investment decisions" on public.investment_decisions
for select using ((select auth.uid()) = user_id);
create policy "Users can create their own investment decisions" on public.investment_decisions
for insert with check (
    (select auth.uid()) = user_id
    and exists (
        select 1 from public.portfolios p
        join public.holdings h on h.portfolio_id = p.id
        where p.id = portfolio_id and p.user_id = (select auth.uid()) and h.id = holding_id
    )
);

create index if not exists idx_investment_theses_user_portfolio on public.investment_theses(user_id, portfolio_id);
create index if not exists idx_investment_decisions_user_portfolio_created on public.investment_decisions(user_id, portfolio_id, created_at desc);
