-- Tighten user-owned research RLS.
-- Public shared reports must be served through the backend shared-report route,
-- not by granting every authenticated Supabase client access to shared rows.

alter table public.equity_research_runs
add column if not exists guest_owner_id text;

create index if not exists idx_equity_research_runs_guest_owner_id
on public.equity_research_runs (guest_owner_id)
where guest_owner_id is not null;

alter table public.equity_research_runs enable row level security;
alter table public.equity_research_snapshots enable row level security;
alter table public.equity_research_reports enable row level security;
alter table public.equity_research_events enable row level security;

drop policy if exists "Users can read own equity research runs" on public.equity_research_runs;
create policy "Users can read own equity research runs"
on public.equity_research_runs for select
using (auth.uid() = user_id);

drop policy if exists "Read snapshots through accessible runs" on public.equity_research_snapshots;
create policy "Users can read snapshots through own runs"
on public.equity_research_snapshots for select
using (exists (
    select 1 from public.equity_research_runs r
    where r.id = run_id and r.user_id = auth.uid()
));

drop policy if exists "Read reports through accessible runs" on public.equity_research_reports;
create policy "Users can read reports through own runs"
on public.equity_research_reports for select
using (exists (
    select 1 from public.equity_research_runs r
    where r.id = run_id and r.user_id = auth.uid()
));

drop policy if exists "Read events through accessible runs" on public.equity_research_events;
create policy "Users can read events through own runs"
on public.equity_research_events for select
using (exists (
    select 1 from public.equity_research_runs r
    where r.id = run_id and r.user_id = auth.uid()
));

drop policy if exists "Users can create own equity research runs" on public.equity_research_runs;
create policy "Users can create own equity research runs"
on public.equity_research_runs for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own equity research runs" on public.equity_research_runs;
create policy "Users can update own equity research runs"
on public.equity_research_runs for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own equity research runs" on public.equity_research_runs;
create policy "Users can delete own equity research runs"
on public.equity_research_runs for delete
using (auth.uid() = user_id);
