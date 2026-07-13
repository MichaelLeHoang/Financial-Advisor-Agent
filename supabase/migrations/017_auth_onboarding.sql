-- Persist entry onboarding without forcing existing accounts through setup again.

create table if not exists public.user_onboarding_preferences (
    user_id uuid primary key references public.profiles(id) on delete cascade,
    status text not null default 'pending'
        check (status in ('pending', 'complete', 'skipped')),
    workspace_preference text
        check (workspace_preference in ('investing', 'trading', 'both')),
    current_step text not null default 'choice'
        check (current_step in ('choice', 'preferences')),
    investment_horizon text
        check (investment_horizon in ('3-5-years', '5-10-years', '10-plus-years')),
    risk_tolerance text
        check (risk_tolerance in ('conservative', 'moderate', 'growth')),
    trading_holding_period text
        check (trading_holding_period in ('intraday', 'swing', 'position')),
    paper_trading_only boolean not null default true,
    completed_at timestamptz,
    skipped_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.entry_flow_events (
    id bigint generated always as identity primary key,
    user_id uuid not null references public.profiles(id) on delete cascade,
    event_type text not null
        check (event_type in (
            'onboarding_started',
            'onboarding_resumed',
            'onboarding_completed',
            'onboarding_skipped',
            'destination_restored'
        )),
    path text not null check (
        char_length(path) between 1 and 2048
        and left(path, 1) = '/'
        and left(path, 2) <> '//'
        and position(E'\\' in path) = 0
    ),
    metadata jsonb not null default '{}'::jsonb
        check (jsonb_typeof(metadata) = 'object'),
    created_at timestamptz not null default now()
);

create index if not exists idx_entry_flow_events_user_created_at
on public.entry_flow_events (user_id, created_at desc);

alter table public.user_onboarding_preferences enable row level security;
alter table public.entry_flow_events enable row level security;

drop policy if exists "Users can read their own onboarding preferences"
on public.user_onboarding_preferences;
create policy "Users can read their own onboarding preferences"
on public.user_onboarding_preferences for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own onboarding preferences"
on public.user_onboarding_preferences;
create policy "Users can insert their own onboarding preferences"
on public.user_onboarding_preferences for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own onboarding preferences"
on public.user_onboarding_preferences;
create policy "Users can update their own onboarding preferences"
on public.user_onboarding_preferences for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can record their own entry events"
on public.entry_flow_events;
create policy "Users can record their own entry events"
on public.entry_flow_events for insert
to authenticated
with check ((select auth.uid()) = user_id);

revoke all on table public.user_onboarding_preferences from anon, authenticated;
grant select, insert, update on table public.user_onboarding_preferences to authenticated;

revoke all on table public.entry_flow_events from anon, authenticated;
grant insert on table public.entry_flow_events to authenticated;
revoke all on sequence public.entry_flow_events_id_seq from anon, authenticated;
grant usage on sequence public.entry_flow_events_id_seq to authenticated;

-- Existing accounts have already entered the product, so preserve returning-user behavior.
insert into public.user_onboarding_preferences (
    user_id,
    status,
    workspace_preference,
    current_step,
    skipped_at
)
select
    id,
    'skipped',
    'both',
    'choice',
    now()
from public.profiles
on conflict (user_id) do nothing;

-- Extend the existing signup transaction so every new account starts with durable setup state.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, email, display_name, plan)
    values (
        new.id,
        coalesce(new.email, ''),
        coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'),
        'free'::public.plan_type
    )
    on conflict (id) do update
    set
        email = excluded.email,
        display_name = coalesce(excluded.display_name, public.profiles.display_name),
        updated_at = now();

    insert into public.subscriptions (user_id, plan, status)
    values (new.id, 'free'::public.plan_type, 'inactive')
    on conflict (user_id) do nothing;

    insert into public.user_onboarding_preferences (user_id, status, current_step)
    values (new.id, 'pending', 'choice')
    on conflict (user_id) do nothing;

    return new;
end;
$$;
