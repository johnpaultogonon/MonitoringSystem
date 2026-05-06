-- Birthday dropdown options for Add Birthday Celebrant modal.
-- Stores Position and Section values in Supabase (no local-only prompt flow).

create extension if not exists "pgcrypto";

create table if not exists public.birthdate_options (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('position', 'section')),
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint birthdate_options_kind_value_unique unique (kind, value)
);

create index if not exists idx_birthdate_options_kind on public.birthdate_options (kind);

alter table public.birthdate_options enable row level security;

drop policy if exists "birthdate_options_select_anon_or_auth" on public.birthdate_options;
create policy "birthdate_options_select_anon_or_auth"
  on public.birthdate_options
  for select
  to anon, authenticated
  using (true);

drop policy if exists "birthdate_options_insert_anon_or_auth" on public.birthdate_options;
create policy "birthdate_options_insert_anon_or_auth"
  on public.birthdate_options
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "birthdate_options_update_anon_or_auth" on public.birthdate_options;
create policy "birthdate_options_update_anon_or_auth"
  on public.birthdate_options
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "birthdate_options_delete_anon_or_auth" on public.birthdate_options;
create policy "birthdate_options_delete_anon_or_auth"
  on public.birthdate_options
  for delete
  to anon, authenticated
  using (true);
