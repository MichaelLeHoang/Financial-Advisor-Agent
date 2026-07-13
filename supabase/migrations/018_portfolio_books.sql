-- Shared investment/trading position books with append-only classification events.

alter table public.holdings
    add column if not exists book_type text not null default 'unclassified',
    add column if not exists classification_source text not null default 'import',
    add column if not exists classified_at timestamptz,
    add column if not exists classified_by uuid references public.profiles(id) on delete set null;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'holdings_book_type_check') then
        alter table public.holdings
            add constraint holdings_book_type_check
            check (book_type in ('investment', 'trading', 'unclassified'));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'holdings_classification_source_check') then
        alter table public.holdings
            add constraint holdings_classification_source_check
            check (classification_source in ('user', 'import', 'agent_suggestion', 'strategy'));
    end if;
end $$;

create table if not exists public.portfolio_book_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    portfolio_id uuid not null references public.portfolios(id) on delete cascade,
    holding_id uuid references public.holdings(id) on delete set null,
    symbol text not null,
    previous_book_type text not null,
    new_book_type text not null,
    classification_source text not null,
    actor_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    constraint portfolio_book_events_previous_book_check
        check (previous_book_type in ('investment', 'trading', 'unclassified')),
    constraint portfolio_book_events_new_book_check
        check (new_book_type in ('investment', 'trading', 'unclassified')),
    constraint portfolio_book_events_source_check
        check (classification_source in ('user', 'import', 'agent_suggestion', 'strategy'))
);

alter table public.portfolio_book_events enable row level security;

revoke all on public.portfolio_book_events from anon, authenticated;
grant select on public.portfolio_book_events to authenticated;

drop policy if exists "Users can read their own portfolio book events" on public.portfolio_book_events;
create policy "Users can read their own portfolio book events"
on public.portfolio_book_events for select
using ((select auth.uid()) = user_id);

create or replace function public.record_portfolio_book_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    owner_id uuid;
    authenticated_actor uuid := auth.uid();
begin
    select p.user_id into owner_id
    from public.portfolios p
    where p.id = new.portfolio_id;

    if owner_id is null then
        raise exception 'Portfolio owner not found';
    end if;

    if new.book_type is distinct from old.book_type then
        if authenticated_actor is not null then
            new.classified_by := authenticated_actor;
            new.classification_source := 'user';
        end if;

        if new.classified_by is distinct from owner_id then
            raise exception 'Holding classifier must own the portfolio';
        end if;

        if new.classification_source = 'agent_suggestion' then
            raise exception 'Agent suggestions require owner confirmation before classification';
        end if;

        new.classified_at := now();
        new.updated_at := now();

        insert into public.portfolio_book_events (
            user_id,
            portfolio_id,
            holding_id,
            symbol,
            previous_book_type,
            new_book_type,
            classification_source,
            actor_id,
            created_at
        ) values (
            owner_id,
            new.portfolio_id,
            new.id,
            new.symbol,
            old.book_type,
            new.book_type,
            new.classification_source,
            new.classified_by,
            new.classified_at
        );
    elsif new.classification_source is distinct from old.classification_source
        or new.classified_at is distinct from old.classified_at
        or new.classified_by is distinct from old.classified_by then
        raise exception 'Classification metadata requires a book change';
    end if;

    return new;
end;
$$;

drop trigger if exists holdings_record_book_change on public.holdings;
create trigger holdings_record_book_change
before update of book_type, classification_source, classified_at, classified_by
on public.holdings
for each row execute function public.record_portfolio_book_change();

revoke all on function public.record_portfolio_book_change() from public;

create index if not exists idx_holdings_portfolio_book
    on public.holdings(portfolio_id, book_type);
create index if not exists idx_holdings_classified_by
    on public.holdings(classified_by) where classified_by is not null;
create index if not exists idx_portfolio_book_events_user_created
    on public.portfolio_book_events(user_id, created_at desc);
create index if not exists idx_portfolio_book_events_portfolio_created
    on public.portfolio_book_events(portfolio_id, created_at desc);
create index if not exists idx_portfolio_book_events_holding
    on public.portfolio_book_events(holding_id) where holding_id is not null;
