-- section_details: per-calendar-category display metadata (matches Reports folder modal: section, name, position; photo optional).
-- section = canonical calendar category key (same as event category name / reports category key).

create extension if not exists "pgcrypto";

create table if not exists public.section_details (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  name text not null default '',
  position text not null default '',
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint section_details_section_unique unique (section)
);

create index if not exists idx_section_details_section on public.section_details (section);

alter table public.section_details enable row level security;

drop policy if exists "section_details_select_anon_or_auth" on public.section_details;
create policy "section_details_select_anon_or_auth"
  on public.section_details
  for select
  to anon, authenticated
  using (true);

drop policy if exists "section_details_insert_anon_or_auth" on public.section_details;
create policy "section_details_insert_anon_or_auth"
  on public.section_details
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "section_details_update_anon_or_auth" on public.section_details;
create policy "section_details_update_anon_or_auth"
  on public.section_details
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "section_details_delete_anon_or_auth" on public.section_details;
create policy "section_details_delete_anon_or_auth"
  on public.section_details
  for delete
  to anon, authenticated
  using (true);
