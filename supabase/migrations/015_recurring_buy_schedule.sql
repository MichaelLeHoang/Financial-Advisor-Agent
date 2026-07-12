-- Add buy-mode and recurrence schedule metadata to recurring buys.

alter table public.portfolio_recurring_buys
add column if not exists purchase_mode text not null default 'amount',
add column if not exists recurrence_frequency text not null default 'monthly',
add column if not exists schedule_time text not null default '09:30',
add column if not exists schedule_day_of_week int,
add column if not exists schedule_day_of_month int,
add column if not exists schedule_month int;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'portfolio_recurring_buys_purchase_mode'
          and conrelid = 'public.portfolio_recurring_buys'::regclass
    ) then
        alter table public.portfolio_recurring_buys
        add constraint portfolio_recurring_buys_purchase_mode
        check (purchase_mode in ('amount', 'shares'));
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'portfolio_recurring_buys_recurrence_frequency'
          and conrelid = 'public.portfolio_recurring_buys'::regclass
    ) then
        alter table public.portfolio_recurring_buys
        add constraint portfolio_recurring_buys_recurrence_frequency
        check (recurrence_frequency in ('daily', 'weekly', 'monthly', 'yearly'));
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'portfolio_recurring_buys_schedule_time'
          and conrelid = 'public.portfolio_recurring_buys'::regclass
    ) then
        alter table public.portfolio_recurring_buys
        add constraint portfolio_recurring_buys_schedule_time
        check (schedule_time ~ '^\d{2}:\d{2}$');
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'portfolio_recurring_buys_schedule_day_of_week'
          and conrelid = 'public.portfolio_recurring_buys'::regclass
    ) then
        alter table public.portfolio_recurring_buys
        add constraint portfolio_recurring_buys_schedule_day_of_week
        check (schedule_day_of_week is null or schedule_day_of_week between 0 and 6);
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'portfolio_recurring_buys_schedule_day_of_month'
          and conrelid = 'public.portfolio_recurring_buys'::regclass
    ) then
        alter table public.portfolio_recurring_buys
        add constraint portfolio_recurring_buys_schedule_day_of_month
        check (schedule_day_of_month is null or schedule_day_of_month between 1 and 31);
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'portfolio_recurring_buys_schedule_month'
          and conrelid = 'public.portfolio_recurring_buys'::regclass
    ) then
        alter table public.portfolio_recurring_buys
        add constraint portfolio_recurring_buys_schedule_month
        check (schedule_month is null or schedule_month between 1 and 12);
    end if;
end $$;
