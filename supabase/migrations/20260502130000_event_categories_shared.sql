-- Shared event category definitions (name + color) for all users on the same deployment.
create table if not exists public.event_categories (
  name text primary key,
  color text not null default '#3B82F6',
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_event_categories_sort on public.event_categories (sort_order, name);

alter table public.event_categories enable row level security;

drop policy if exists "event_categories_select_anon_or_auth" on public.event_categories;
create policy "event_categories_select_anon_or_auth"
  on public.event_categories for select to anon, authenticated using (true);

drop policy if exists "event_categories_insert_anon_or_auth" on public.event_categories;
create policy "event_categories_insert_anon_or_auth"
  on public.event_categories for insert to anon, authenticated with check (true);

drop policy if exists "event_categories_update_anon_or_auth" on public.event_categories;
create policy "event_categories_update_anon_or_auth"
  on public.event_categories for update to anon, authenticated using (true) with check (true);

drop policy if exists "event_categories_delete_anon_or_auth" on public.event_categories;
create policy "event_categories_delete_anon_or_auth"
  on public.event_categories for delete to anon, authenticated using (true);
