-- Chat history ownership model.
-- Anonymous chat is intentionally not persisted here; public/guest history stays client-session-local.

create table if not exists public.chat_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    session_id text not null,
    title text not null default 'New analysis',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, session_id)
);

create table if not exists public.chat_messages (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    session_id text not null,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    created_at timestamptz not null default now(),
    foreign key (user_id, session_id)
        references public.chat_sessions(user_id, session_id)
        on delete cascade
);

create index if not exists idx_chat_sessions_user_updated
on public.chat_sessions(user_id, updated_at desc);

create index if not exists idx_chat_messages_user_session_created
on public.chat_messages(user_id, session_id, created_at asc);

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "Users can read their own chat sessions" on public.chat_sessions;
create policy "Users can read their own chat sessions"
on public.chat_sessions for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own chat sessions" on public.chat_sessions;
create policy "Users can insert their own chat sessions"
on public.chat_sessions for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own chat sessions" on public.chat_sessions;
create policy "Users can update their own chat sessions"
on public.chat_sessions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own chat sessions" on public.chat_sessions;
create policy "Users can delete their own chat sessions"
on public.chat_sessions for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read their own chat messages" on public.chat_messages;
create policy "Users can read their own chat messages"
on public.chat_messages for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own chat messages" on public.chat_messages;
create policy "Users can insert their own chat messages"
on public.chat_messages for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own chat messages" on public.chat_messages;
create policy "Users can delete their own chat messages"
on public.chat_messages for delete
using (auth.uid() = user_id);

drop policy if exists "Service role can manage chat sessions" on public.chat_sessions;
create policy "Service role can manage chat sessions"
on public.chat_sessions for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage chat messages" on public.chat_messages;
create policy "Service role can manage chat messages"
on public.chat_messages for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

grant select, insert, update, delete on public.chat_sessions to authenticated;
grant select, insert, delete on public.chat_messages to authenticated;
grant all on public.chat_sessions to service_role;
grant all on public.chat_messages to service_role;
