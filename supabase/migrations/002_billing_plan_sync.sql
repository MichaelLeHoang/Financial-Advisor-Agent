-- Billing sync constraints and service-role policies.

alter table public.subscriptions
    add constraint subscriptions_user_id_key unique (user_id);

create unique index if not exists idx_subscriptions_stripe_customer_id
on public.subscriptions(stripe_customer_id)
where stripe_customer_id is not null;

create unique index if not exists idx_subscriptions_stripe_subscription_id
on public.subscriptions(stripe_subscription_id)
where stripe_subscription_id is not null;

create index if not exists idx_subscriptions_user_status
on public.subscriptions(user_id, status);

create policy "Service role can manage subscriptions"
on public.subscriptions for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "Service role can update profiles for billing"
on public.profiles for update
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
