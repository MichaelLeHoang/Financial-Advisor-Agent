-- Add username and avatar_url columns to profiles for the Edit Profile feature.

alter table public.profiles
  add column if not exists username text,
  add column if not exists avatar_url text;

-- Ensure usernames are unique (case-insensitive)
create unique index if not exists idx_profiles_username_lower
  on public.profiles (lower(username))
  where username is not null;
