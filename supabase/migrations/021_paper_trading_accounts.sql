-- Durable owner-scoped paper brokerage accounts and deterministic order accounting.

create table if not exists public.paper_accounts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete cascade,
    guest_owner_id text,
    name text not null,
    base_currency text not null default 'USD',
    initial_cash numeric(20, 4) not null,
    cash numeric(20, 4) not null,
    cash_reserved numeric(20, 4) not null default 0,
    status text not null default 'active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint paper_accounts_one_owner check ((user_id is not null) <> (guest_owner_id is not null)),
    constraint paper_accounts_initial_cash_positive check (initial_cash > 0),
    constraint paper_accounts_cash_nonnegative check (cash >= 0),
    constraint paper_accounts_reserved_cash_valid check (cash_reserved >= 0 and cash_reserved <= cash),
    constraint paper_accounts_currency_length check (char_length(base_currency) = 3),
    constraint paper_accounts_status check (status in ('active', 'archived'))
);

create table if not exists public.paper_orders (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references public.paper_accounts(id) on delete cascade,
    symbol text not null,
    side text not null,
    quantity numeric(20, 8) not null,
    order_type text not null,
    time_in_force text not null default 'day',
    limit_price numeric(20, 8),
    stop_price numeric(20, 8),
    protective_stop numeric(20, 8),
    target_price numeric(20, 8),
    risk_budget numeric(20, 4),
    thesis text,
    status text not null default 'open',
    reserved_cash numeric(20, 4) not null default 0,
    average_fill_price numeric(20, 8),
    fees numeric(20, 4) not null default 0,
    submitted_at timestamptz not null default now(),
    filled_at timestamptz,
    canceled_at timestamptz,
    constraint paper_orders_side check (side in ('buy', 'sell')),
    constraint paper_orders_quantity_positive check (quantity > 0),
    constraint paper_orders_type check (order_type in ('market', 'limit', 'stop')),
    constraint paper_orders_tif check (time_in_force in ('day', 'gtc')),
    constraint paper_orders_status check (status in ('open', 'filled', 'canceled', 'rejected')),
    constraint paper_orders_price_shape check (
        (order_type = 'market')
        or (order_type = 'limit' and limit_price > 0)
        or (order_type = 'stop' and stop_price > 0)
    )
);

create table if not exists public.paper_positions (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references public.paper_accounts(id) on delete cascade,
    symbol text not null,
    quantity numeric(20, 8) not null default 0,
    average_entry numeric(20, 8) not null default 0,
    last_price numeric(20, 8) not null default 0,
    realized_pnl numeric(20, 4) not null default 0,
    updated_at timestamptz not null default now(),
    constraint paper_positions_account_symbol_unique unique (account_id, symbol),
    constraint paper_positions_quantity_nonnegative check (quantity >= 0),
    constraint paper_positions_prices_nonnegative check (average_entry >= 0 and last_price >= 0)
);

create table if not exists public.paper_fills (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references public.paper_accounts(id) on delete cascade,
    order_id uuid not null references public.paper_orders(id) on delete cascade,
    symbol text not null,
    side text not null,
    quantity numeric(20, 8) not null,
    price numeric(20, 8) not null,
    fees numeric(20, 4) not null default 0,
    executed_at timestamptz not null default now(),
    constraint paper_fills_side check (side in ('buy', 'sell')),
    constraint paper_fills_quantity_positive check (quantity > 0),
    constraint paper_fills_price_positive check (price > 0)
);

create table if not exists public.paper_cash_ledger (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references public.paper_accounts(id) on delete cascade,
    order_id uuid references public.paper_orders(id) on delete set null,
    fill_id uuid references public.paper_fills(id) on delete set null,
    entry_type text not null,
    amount numeric(20, 4) not null,
    balance_after numeric(20, 4) not null,
    description text not null,
    created_at timestamptz not null default now(),
    constraint paper_cash_ledger_type check (entry_type in ('deposit', 'buy', 'sell')),
    constraint paper_cash_ledger_balance_nonnegative check (balance_after >= 0)
);

create index if not exists idx_paper_accounts_user_updated on public.paper_accounts(user_id, updated_at desc) where user_id is not null;
create index if not exists idx_paper_accounts_guest_updated on public.paper_accounts(guest_owner_id, updated_at desc) where guest_owner_id is not null;
create index if not exists idx_paper_orders_account_submitted on public.paper_orders(account_id, submitted_at desc);
create index if not exists idx_paper_orders_open_account on public.paper_orders(account_id, symbol) where status = 'open';
create index if not exists idx_paper_positions_account on public.paper_positions(account_id);
create index if not exists idx_paper_fills_account_executed on public.paper_fills(account_id, executed_at desc);
create index if not exists idx_paper_fills_order on public.paper_fills(order_id);
create index if not exists idx_paper_cash_ledger_account_created on public.paper_cash_ledger(account_id, created_at desc);
create index if not exists idx_paper_cash_ledger_order on public.paper_cash_ledger(order_id) where order_id is not null;
create index if not exists idx_paper_cash_ledger_fill on public.paper_cash_ledger(fill_id) where fill_id is not null;

alter table public.paper_accounts enable row level security;
alter table public.paper_orders enable row level security;
alter table public.paper_positions enable row level security;
alter table public.paper_fills enable row level security;
alter table public.paper_cash_ledger enable row level security;

create policy "Users read their own paper accounts"
on public.paper_accounts for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users read orders in their paper accounts"
on public.paper_orders for select to authenticated
using (exists (select 1 from public.paper_accounts a where a.id = account_id and a.user_id = (select auth.uid())));

create policy "Users read positions in their paper accounts"
on public.paper_positions for select to authenticated
using (exists (select 1 from public.paper_accounts a where a.id = account_id and a.user_id = (select auth.uid())));

create policy "Users read fills in their paper accounts"
on public.paper_fills for select to authenticated
using (exists (select 1 from public.paper_accounts a where a.id = account_id and a.user_id = (select auth.uid())));

create policy "Users read ledger in their paper accounts"
on public.paper_cash_ledger for select to authenticated
using (exists (select 1 from public.paper_accounts a where a.id = account_id and a.user_id = (select auth.uid())));

create or replace function public.record_paper_initial_deposit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.paper_cash_ledger (account_id, entry_type, amount, balance_after, description)
    values (new.id, 'deposit', new.initial_cash, new.cash, 'Initial paper account deposit');
    return new;
end;
$$;

drop trigger if exists trg_record_paper_initial_deposit on public.paper_accounts;
create trigger trg_record_paper_initial_deposit
after insert on public.paper_accounts
for each row execute function public.record_paper_initial_deposit();

revoke all on function public.record_paper_initial_deposit() from public, anon, authenticated;

create or replace function public.paper_submit_order(
    p_account_id uuid,
    p_user_id uuid,
    p_guest_owner_id text,
    p_symbol text,
    p_side text,
    p_quantity numeric,
    p_order_type text,
    p_time_in_force text,
    p_limit_price numeric,
    p_stop_price numeric,
    p_protective_stop numeric,
    p_target_price numeric,
    p_risk_budget numeric,
    p_thesis text,
    p_quote_price numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_account public.paper_accounts%rowtype;
    v_order public.paper_orders%rowtype;
    v_position public.paper_positions%rowtype;
    v_fill public.paper_fills%rowtype;
    v_trigger numeric;
    v_reserved numeric(20, 4) := 0;
    v_notional numeric(20, 4);
    v_realized numeric(20, 4) := 0;
    v_open_sell numeric(20, 8) := 0;
begin
    if p_quote_price is null or p_quote_price <= 0 then
        raise exception 'A positive quote price is required';
    end if;
    if p_side not in ('buy', 'sell') or p_order_type not in ('market', 'limit', 'stop') or p_time_in_force not in ('day', 'gtc') then
        raise exception 'Invalid paper order configuration';
    end if;
    if p_quantity is null or p_quantity <= 0 then
        raise exception 'Order quantity must be positive';
    end if;

    select * into v_account
    from public.paper_accounts
    where id = p_account_id
      and (
        (p_user_id is not null and user_id = p_user_id and guest_owner_id is null)
        or (p_user_id is null and user_id is null and guest_owner_id = p_guest_owner_id)
      )
    for update;
    if not found then raise exception 'Paper account not found'; end if;
    if v_account.status <> 'active' then raise exception 'Paper account is not active'; end if;

    v_trigger := case p_order_type when 'limit' then p_limit_price when 'stop' then p_stop_price else p_quote_price end;
    if v_trigger is null or v_trigger <= 0 then raise exception 'A positive trigger price is required'; end if;

    if p_side = 'sell' then
        select * into v_position from public.paper_positions
        where account_id = p_account_id and symbol = upper(trim(p_symbol))
        for update;
        select coalesce(sum(quantity), 0) into v_open_sell
        from public.paper_orders
        where account_id = p_account_id
          and symbol = upper(trim(p_symbol))
          and side = 'sell'
          and status = 'open';
        if v_position.id is null or v_position.quantity - v_open_sell < p_quantity then
            raise exception 'Cash paper accounts can only sell shares already held';
        end if;
    else
        v_reserved := round(v_trigger * p_quantity, 4);
        if v_reserved > (v_account.cash - v_account.cash_reserved) then
            raise exception 'Insufficient paper cash for this order';
        end if;
    end if;

    insert into public.paper_orders (
        account_id, symbol, side, quantity, order_type, time_in_force, limit_price, stop_price,
        protective_stop, target_price, risk_budget, thesis, reserved_cash
    ) values (
        p_account_id, upper(trim(p_symbol)), p_side, p_quantity, p_order_type, p_time_in_force,
        p_limit_price, p_stop_price, p_protective_stop, p_target_price, p_risk_budget, p_thesis,
        case when p_order_type = 'market' then 0 else v_reserved end
    ) returning * into v_order;

    if p_order_type <> 'market' then
        update public.paper_accounts
        set cash_reserved = cash_reserved + v_reserved, updated_at = now()
        where id = p_account_id;
        return to_jsonb(v_order);
    end if;

    v_notional := round(p_quote_price * p_quantity, 4);
    if p_side = 'buy' then
        update public.paper_accounts set cash = cash - v_notional, updated_at = now() where id = p_account_id;
        insert into public.paper_positions (account_id, symbol, quantity, average_entry, last_price)
        values (p_account_id, upper(trim(p_symbol)), p_quantity, p_quote_price, p_quote_price)
        on conflict (account_id, symbol) do update set
            average_entry = (
                (public.paper_positions.quantity * public.paper_positions.average_entry)
                + (excluded.quantity * excluded.average_entry)
            ) / (public.paper_positions.quantity + excluded.quantity),
            quantity = public.paper_positions.quantity + excluded.quantity,
            last_price = excluded.last_price,
            updated_at = now();
    else
        v_realized := round((p_quote_price - v_position.average_entry) * p_quantity, 4);
        update public.paper_positions
        set quantity = quantity - p_quantity,
            last_price = p_quote_price,
            realized_pnl = realized_pnl + v_realized,
            updated_at = now()
        where id = v_position.id;
        update public.paper_accounts set cash = cash + v_notional, updated_at = now() where id = p_account_id;
    end if;

    insert into public.paper_fills (account_id, order_id, symbol, side, quantity, price)
    values (p_account_id, v_order.id, v_order.symbol, p_side, p_quantity, p_quote_price)
    returning * into v_fill;
    update public.paper_orders
    set status = 'filled', average_fill_price = p_quote_price, filled_at = now(), reserved_cash = 0
    where id = v_order.id returning * into v_order;
    select * into v_account from public.paper_accounts where id = p_account_id;
    insert into public.paper_cash_ledger (account_id, order_id, fill_id, entry_type, amount, balance_after, description)
    values (
        p_account_id, v_order.id, v_fill.id, p_side,
        case when p_side = 'buy' then -v_notional else v_notional end,
        v_account.cash,
        'Paper ' || p_side || ' fill for ' || p_quantity || ' ' || v_order.symbol
    );
    return to_jsonb(v_order);
end;
$$;

create or replace function public.paper_fill_order(
    p_order_id uuid,
    p_user_id uuid,
    p_guest_owner_id text,
    p_fill_price numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_order public.paper_orders%rowtype;
    v_account public.paper_accounts%rowtype;
    v_position public.paper_positions%rowtype;
    v_fill public.paper_fills%rowtype;
    v_notional numeric(20, 4);
    v_realized numeric(20, 4) := 0;
begin
    if p_fill_price is null or p_fill_price <= 0 then raise exception 'A positive fill price is required'; end if;
    select o.* into v_order
    from public.paper_orders o
    join public.paper_accounts a on a.id = o.account_id
    where o.id = p_order_id and o.status = 'open'
      and (
        (p_user_id is not null and a.user_id = p_user_id and a.guest_owner_id is null)
        or (p_user_id is null and a.user_id is null and a.guest_owner_id = p_guest_owner_id)
      )
    for update of o;
    if not found then raise exception 'Open paper order not found'; end if;
    select * into v_account from public.paper_accounts where id = v_order.account_id for update;
    v_notional := round(p_fill_price * v_order.quantity, 4);

    if v_order.side = 'buy' then
        if v_notional > v_account.cash - greatest(0, v_account.cash_reserved - v_order.reserved_cash) then
            update public.paper_accounts
            set cash_reserved = greatest(0, cash_reserved - v_order.reserved_cash), updated_at = now()
            where id = v_order.account_id;
            update public.paper_orders
            set status = 'rejected', reserved_cash = 0
            where id = v_order.id returning * into v_order;
            return to_jsonb(v_order);
        end if;
        update public.paper_accounts
        set cash = cash - v_notional,
            cash_reserved = greatest(0, cash_reserved - v_order.reserved_cash),
            updated_at = now()
        where id = v_order.account_id;
        insert into public.paper_positions (account_id, symbol, quantity, average_entry, last_price)
        values (v_order.account_id, v_order.symbol, v_order.quantity, p_fill_price, p_fill_price)
        on conflict (account_id, symbol) do update set
            average_entry = (
                (public.paper_positions.quantity * public.paper_positions.average_entry)
                + (excluded.quantity * excluded.average_entry)
            ) / (public.paper_positions.quantity + excluded.quantity),
            quantity = public.paper_positions.quantity + excluded.quantity,
            last_price = excluded.last_price,
            updated_at = now();
    else
        select * into v_position from public.paper_positions
        where account_id = v_order.account_id and symbol = v_order.symbol for update;
        if not found or v_position.quantity < v_order.quantity then
            update public.paper_orders
            set status = 'rejected', reserved_cash = 0
            where id = v_order.id returning * into v_order;
            return to_jsonb(v_order);
        end if;
        v_realized := round((p_fill_price - v_position.average_entry) * v_order.quantity, 4);
        update public.paper_positions
        set quantity = quantity - v_order.quantity,
            last_price = p_fill_price,
            realized_pnl = realized_pnl + v_realized,
            updated_at = now()
        where id = v_position.id;
        update public.paper_accounts set cash = cash + v_notional, updated_at = now() where id = v_order.account_id;
    end if;

    insert into public.paper_fills (account_id, order_id, symbol, side, quantity, price)
    values (v_order.account_id, v_order.id, v_order.symbol, v_order.side, v_order.quantity, p_fill_price)
    returning * into v_fill;
    update public.paper_orders
    set status = 'filled', average_fill_price = p_fill_price, filled_at = now(), reserved_cash = 0
    where id = v_order.id returning * into v_order;
    select * into v_account from public.paper_accounts where id = v_order.account_id;
    insert into public.paper_cash_ledger (account_id, order_id, fill_id, entry_type, amount, balance_after, description)
    values (
        v_order.account_id, v_order.id, v_fill.id, v_order.side,
        case when v_order.side = 'buy' then -v_notional else v_notional end,
        v_account.cash,
        'Paper ' || v_order.side || ' fill for ' || v_order.quantity || ' ' || v_order.symbol
    );
    return to_jsonb(v_order);
end;
$$;

create or replace function public.paper_cancel_order(
    p_order_id uuid,
    p_user_id uuid,
    p_guest_owner_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_order public.paper_orders%rowtype;
begin
    select o.* into v_order
    from public.paper_orders o
    join public.paper_accounts a on a.id = o.account_id
    where o.id = p_order_id and o.status = 'open'
      and (
        (p_user_id is not null and a.user_id = p_user_id and a.guest_owner_id is null)
        or (p_user_id is null and a.user_id is null and a.guest_owner_id = p_guest_owner_id)
      )
    for update of o;
    if not found then raise exception 'Open paper order not found'; end if;
    update public.paper_accounts
    set cash_reserved = greatest(0, cash_reserved - v_order.reserved_cash), updated_at = now()
    where id = v_order.account_id;
    update public.paper_orders
    set status = 'canceled', canceled_at = now(), reserved_cash = 0
    where id = v_order.id returning * into v_order;
    return to_jsonb(v_order);
end;
$$;

revoke all on function public.paper_submit_order(uuid, uuid, text, text, text, numeric, text, text, numeric, numeric, numeric, numeric, numeric, text, numeric) from public, anon, authenticated;
revoke all on function public.paper_fill_order(uuid, uuid, text, numeric) from public, anon, authenticated;
revoke all on function public.paper_cancel_order(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.paper_submit_order(uuid, uuid, text, text, text, numeric, text, text, numeric, numeric, numeric, numeric, numeric, text, numeric) to service_role;
grant execute on function public.paper_fill_order(uuid, uuid, text, numeric) to service_role;
grant execute on function public.paper_cancel_order(uuid, uuid, text) to service_role;

grant select on public.paper_accounts to authenticated;
grant select on public.paper_orders to authenticated;
grant select on public.paper_positions to authenticated;
grant select on public.paper_fills to authenticated;
grant select on public.paper_cash_ledger to authenticated;
grant all on public.paper_accounts, public.paper_orders, public.paper_positions, public.paper_fills, public.paper_cash_ledger to service_role;
