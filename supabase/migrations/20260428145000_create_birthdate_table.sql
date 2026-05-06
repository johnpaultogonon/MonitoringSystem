-- birthdate: stores Birthday Celebrants modal records.
-- Columns mirror modal fields: photo, name, position, section, date of birth.

create extension if not exists "pgcrypto";

create table if not exists public.birthdate (
  birthday_id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  photo text default '',
  name text not null,
  position text not null,
  section text not null,
  date_of_birth date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_birthdate_date_of_birth on public.birthdate (date_of_birth);
create index if not exists idx_birthdate_name on public.birthdate (name);

alter table public.birthdate enable row level security;

drop policy if exists "birthdate_select_anon_or_auth" on public.birthdate;
create policy "birthdate_select_anon_or_auth"
  on public.birthdate
  for select
  to anon, authenticated
  using (true);

drop policy if exists "birthdate_insert_anon_or_auth" on public.birthdate;
create policy "birthdate_insert_anon_or_auth"
  on public.birthdate
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "birthdate_update_anon_or_auth" on public.birthdate;
create policy "birthdate_update_anon_or_auth"
  on public.birthdate
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "birthdate_delete_anon_or_auth" on public.birthdate;
create policy "birthdate_delete_anon_or_auth"
  on public.birthdate
  for delete
  to anon, authenticated
  using (true);
