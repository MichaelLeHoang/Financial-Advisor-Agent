-- User-controlled daily market-news digests and idempotent delivery records.

create table if not exists public.news_digest_preferences (
    user_id uuid primary key references public.profiles(id) on delete cascade,
    is_enabled boolean not null default false,
    timezone text not null default 'UTC',
    local_time time not null default '08:00',
    max_symbols smallint not null default 20 check (max_symbols between 1 and 20),
    next_run_at timestamptz,
    last_sent_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.news_digest_deliveries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    digest_date date not null,
    status text not null default 'processing' check (status in ('processing', 'sent', 'failed')),
    source_symbols jsonb not null default '[]'::jsonb,
    article_count integer not null default 0 check (article_count >= 0),
    subject text,
    provider_message_id text,
    error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, digest_date)
);

create index if not exists idx_news_digest_preferences_due
on public.news_digest_preferences(next_run_at, user_id)
where is_enabled = true;

create index if not exists idx_news_digest_deliveries_user_created
on public.news_digest_deliveries(user_id, created_at desc);

alter table public.news_digest_preferences enable row level security;
alter table public.news_digest_deliveries enable row level security;

drop policy if exists "Users can manage their own digest preferences" on public.news_digest_preferences;
create policy "Users can manage their own digest preferences"
on public.news_digest_preferences for all
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own digest deliveries" on public.news_digest_deliveries;
create policy "Users can read their own digest deliveries"
on public.news_digest_deliveries for select
using ((select auth.uid()) = user_id);

drop policy if exists "Service role can manage digest preferences" on public.news_digest_preferences;
create policy "Service role can manage digest preferences"
on public.news_digest_preferences for all
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

drop policy if exists "Service role can manage digest deliveries" on public.news_digest_deliveries;
create policy "Service role can manage digest deliveries"
on public.news_digest_deliveries for all
using ((select auth.role()) = 'service_role')
with check ((select auth.role()) = 'service_role');

create or replace function public.claim_news_digest_delivery(p_user_id uuid, p_digest_date date)
returns setof public.news_digest_deliveries
language sql
security definer
set search_path = public
as $$
    insert into public.news_digest_deliveries (user_id, digest_date)
    values (p_user_id, p_digest_date)
    on conflict (user_id, digest_date) do nothing
    returning *;
$$;

revoke all on function public.claim_news_digest_delivery(uuid, date) from public, anon, authenticated;
grant execute on function public.claim_news_digest_delivery(uuid, date) to service_role;

grant select, insert, update, delete on public.news_digest_preferences to authenticated;
grant select on public.news_digest_deliveries to authenticated;
grant all on public.news_digest_preferences, public.news_digest_deliveries to service_role;
