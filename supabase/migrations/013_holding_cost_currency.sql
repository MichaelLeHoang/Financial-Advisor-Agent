-- Preserve the purchase currency for each portfolio holding.

alter table public.holdings
add column if not exists cost_currency text;

update public.holdings h
set cost_currency = upper(p.base_currency)
from public.portfolios p
where h.portfolio_id = p.id
  and (h.cost_currency is null or length(trim(h.cost_currency)) = 0);

alter table public.holdings
alter column cost_currency set default 'USD';

alter table public.holdings
alter column cost_currency set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'holdings_cost_currency_length'
          and conrelid = 'public.holdings'::regclass
    ) then
        alter table public.holdings
        add constraint holdings_cost_currency_length
        check (char_length(cost_currency) = 3);
    end if;
end $$;
