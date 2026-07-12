-- Store completed recurring buys that sync into portfolio holdings.

create table if not exists public.portfolio_recurring_buys (
    id uuid primary key default gen_random_uuid(),
    portfolio_id uuid not null references public.portfolios(id) on delete cascade,
    linked_holding_id uuid references public.holdings(id) on delete set null,
    symbol text not null,
    account text,
    status text not null default 'completed',
    entered_amount numeric not null,
    entered_currency text not null default 'USD',
    filled_quantity numeric not null,
    fill_price numeric not null,
    fill_currency text not null default 'USD',
    exchange_rate numeric,
    executed_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint portfolio_recurring_buys_entered_currency_length check (char_length(entered_currency) = 3),
    constraint portfolio_recurring_buys_fill_currency_length check (char_length(fill_currency) = 3),
    constraint portfolio_recurring_buys_entered_amount_positive check (entered_amount > 0),
    constraint portfolio_recurring_buys_filled_quantity_positive check (filled_quantity > 0),
    constraint portfolio_recurring_buys_fill_price_positive check (fill_price > 0),
    constraint portfolio_recurring_buys_exchange_rate_positive check (exchange_rate is null or exchange_rate > 0)
);

alter table public.portfolio_recurring_buys enable row level security;

create policy "Users can manage recurring buys in their own portfolios"
on public.portfolio_recurring_buys for all
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

create index if not exists idx_portfolio_recurring_buys_portfolio_id
on public.portfolio_recurring_buys(portfolio_id);

create index if not exists idx_portfolio_recurring_buys_linked_holding_id
on public.portfolio_recurring_buys(linked_holding_id);
