-- Sprint 6 alerts and notification channels.
-- Stores user-owned alert definitions, alert events, and encrypted channel destinations.

create table if not exists public.notification_channels (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    channel_type text not null,
    name text not null,
    destination_encrypted text,
    destination_label text,
    config_encrypted jsonb not null default '{}'::jsonb,
    config jsonb not null default '{}'::jsonb,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.alerts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    name text not null,
    alert_type text not null,
    symbol text,
    condition jsonb not null default '{}'::jsonb,
    channels jsonb not null default '[]'::jsonb,
    is_active boolean not null default true,
    last_triggered_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.alert_events (
    id uuid primary key default gen_random_uuid(),
    alert_id uuid not null references public.alerts(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    alert_type text not null,
    symbol text,
    message text not null,
    value numeric,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

alter table public.notification_channels enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_events enable row level security;

drop policy if exists "Users can manage their own notification channels" on public.notification_channels;
create policy "Users can manage their own notification channels"
on public.notification_channels for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own alerts" on public.alerts;
create policy "Users can manage their own alerts"
on public.alerts for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read their own alert events" on public.alert_events;
create policy "Users can read their own alert events"
on public.alert_events for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own alert events" on public.alert_events;
create policy "Users can insert their own alert events"
on public.alert_events for insert
with check (auth.uid() = user_id);

drop policy if exists "Service role can manage notification channels" on public.notification_channels;
create policy "Service role can manage notification channels"
on public.notification_channels for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage alerts" on public.alerts;
create policy "Service role can manage alerts"
on public.alerts for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage alert events" on public.alert_events;
create policy "Service role can manage alert events"
on public.alert_events for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create index if not exists idx_notification_channels_user_created_at
on public.notification_channels(user_id, created_at desc);

create index if not exists idx_alerts_user_active
on public.alerts(user_id, is_active);

create index if not exists idx_alerts_active_symbol
on public.alerts(is_active, symbol)
where is_active = true;

create index if not exists idx_alert_events_user_created_at
on public.alert_events(user_id, created_at desc);

grant select, insert, update, delete on public.notification_channels to authenticated;
grant select, insert, update, delete on public.alerts to authenticated;
grant select, insert on public.alert_events to authenticated;

grant all on public.notification_channels to service_role;
grant all on public.alerts to service_role;
grant all on public.alert_events to service_role;
