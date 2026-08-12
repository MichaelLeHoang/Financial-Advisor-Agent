-- Owner-scoped investment policies used by deterministic portfolio validation.

create table if not exists public.investment_policies (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references public.profiles(id) on delete cascade,
    name text not null default 'Core investment policy',
    status text not null default 'active',
    goals_json jsonb not null default '{}'::jsonb,
    time_horizon text not null default 'long_term',
    target_allocation_json jsonb not null default '{}'::jsonb,
    max_position_weight numeric not null default 10,
    max_sector_weight numeric not null default 35,
    max_drawdown numeric not null default 18,
    minimum_cash_weight numeric not null default 8,
    permitted_assets_json jsonb not null default '["equity", "etf", "cash"]'::jsonb,
    rebalancing_policy_json jsonb not null default '{"cadence": "quarterly"}'::jsonb,
    tax_preferences_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint investment_policies_status_check check (status in ('draft', 'active', 'archived')),
    constraint investment_policies_max_position_check check (max_position_weight > 0 and max_position_weight <= 100),
    constraint investment_policies_max_sector_check check (max_sector_weight > 0 and max_sector_weight <= 100),
    constraint investment_policies_max_drawdown_check check (max_drawdown > 0 and max_drawdown <= 100),
    constraint investment_policies_minimum_cash_check check (minimum_cash_weight >= 0 and minimum_cash_weight <= 100),
    constraint investment_policies_goals_object_check check (jsonb_typeof(goals_json) = 'object'),
    constraint investment_policies_allocation_object_check check (jsonb_typeof(target_allocation_json) = 'object'),
    constraint investment_policies_assets_array_check check (jsonb_typeof(permitted_assets_json) = 'array'),
    constraint investment_policies_rebalancing_object_check check (jsonb_typeof(rebalancing_policy_json) = 'object'),
    constraint investment_policies_tax_object_check check (jsonb_typeof(tax_preferences_json) = 'object')
);

alter table public.investment_policies enable row level security;

revoke all on public.investment_policies from anon, authenticated;
grant select, insert, update on public.investment_policies to authenticated;

create policy "Users can read their own investment policy"
on public.investment_policies for select
using ((select auth.uid()) = user_id);

create policy "Users can create their own investment policy"
on public.investment_policies for insert
with check ((select auth.uid()) = user_id);

create policy "Users can update their own investment policy"
on public.investment_policies for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists idx_investment_policies_user_status
    on public.investment_policies(user_id, status);
