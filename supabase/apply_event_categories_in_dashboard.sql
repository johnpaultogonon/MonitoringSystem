-- Run this in Supabase Dashboard → SQL Editor → Run (all at once).
-- Creates shared event categories for the calendar legend (all users see the same list).
--
-- If you only need to fix "display_name does not exist" on an existing DB, you can run instead:
--   supabase/add_event_categories_display_columns_only.sql

-- 1) Table + RLS
create table if not exists public.event_categories (
  name text primary key,
  color text not null default '#3B82F6',
  sort_order int not null default 0,
  display_name text not null default '',
  position text not null default '',
  photo text,
  updated_at timestamptz not null default now()
);

-- If the table already existed without folder-display columns, add them:
alter table public.event_categories add column if not exists display_name text not null default '';
alter table public.event_categories add column if not exists position text not null default '';
alter table public.event_categories add column if not exists photo text;

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

-- 2) Realtime (optional; safe to re-run)
alter table public.event_categories replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_categories'
  ) then
    alter publication supabase_realtime add table public.event_categories;
  end if;
end $$;
