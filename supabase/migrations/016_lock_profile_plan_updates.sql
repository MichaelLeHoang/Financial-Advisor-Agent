-- Restrict authenticated profile edits to user-facing identity fields.
-- Billing fields remain writable only through the service-role backend.

revoke update on table public.profiles from anon;
revoke update on table public.profiles from authenticated;

grant update (display_name, username, avatar_url)
on table public.profiles
to authenticated;
