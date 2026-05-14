-- Sprint 8 Quant tier advanced validation and export records.
-- User-owned research artifacts with RLS and explicit Data API grants.

create table if not exists public.quant_validation_runs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    strategy_name text not null,
    strategy_type text not null,
    symbols jsonb not null default '[]'::jsonb,
    method text not null,
    parameters jsonb not null default '{}'::jsonb,
    assumptions jsonb not null default '{}'::jsonb,
    results jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.strategy_exports (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    strategy_name text not null,
    strategy_type text not null,
    language text not null check (language in ('json', 'python', 'pine')),
    parameters jsonb not null default '{}'::jsonb,
    content text not null,
    created_at timestamptz not null default now()
);

alter table public.quant_validation_runs enable row level security;
alter table public.strategy_exports enable row level security;

drop policy if exists "Users can manage their own quant validation runs" on public.quant_validation_runs;
create policy "Users can manage their own quant validation runs"
on public.quant_validation_runs for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own strategy exports" on public.strategy_exports;
create policy "Users can manage their own strategy exports"
on public.strategy_exports for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Service role can manage quant validation runs" on public.quant_validation_runs;
create policy "Service role can manage quant validation runs"
on public.quant_validation_runs for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage strategy exports" on public.strategy_exports;
create policy "Service role can manage strategy exports"
on public.strategy_exports for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create index if not exists idx_quant_validation_runs_user_created_at
on public.quant_validation_runs(user_id, created_at desc);

create index if not exists idx_strategy_exports_user_created_at
on public.strategy_exports(user_id, created_at desc);

grant select, insert, update, delete on public.quant_validation_runs to authenticated;
grant select, insert, update, delete on public.strategy_exports to authenticated;

grant all on public.quant_validation_runs to service_role;
grant all on public.strategy_exports to service_role;
