-- Run in Supabase SQL Editor (all at once). Enables shared Light / Night sky theme across all users.
-- See also: supabase/migrations/20260502150000_dashboard_shared_settings.sql

create table if not exists public.dashboard_shared_settings (
  id smallint primary key default 1 constraint dashboard_shared_settings_singleton check (id = 1),
  theme text not null default 'light',
  sidebar_collapsed boolean not null default false,
  density text not null default 'compact',
  updated_at timestamptz not null default now()
);

insert into public.dashboard_shared_settings (id, theme) values (1, 'light') on conflict (id) do nothing;
alter table public.dashboard_shared_settings add column if not exists sidebar_collapsed boolean not null default false;
alter table public.dashboard_shared_settings add column if not exists density text not null default 'compact';

alter table public.dashboard_shared_settings enable row level security;

drop policy if exists "dashboard_shared_settings_select_anon_or_auth" on public.dashboard_shared_settings;
create policy "dashboard_shared_settings_select_anon_or_auth"
  on public.dashboard_shared_settings for select to anon, authenticated using (true);
drop policy if exists "dashboard_shared_settings_insert_anon_or_auth" on public.dashboard_shared_settings;
create policy "dashboard_shared_settings_insert_anon_or_auth"
  on public.dashboard_shared_settings for insert to anon, authenticated with check (true);
drop policy if exists "dashboard_shared_settings_update_anon_or_auth" on public.dashboard_shared_settings;
create policy "dashboard_shared_settings_update_anon_or_auth"
  on public.dashboard_shared_settings for update to anon, authenticated using (true) with check (true);

alter table public.dashboard_shared_settings replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dashboard_shared_settings'
  ) then
    alter publication supabase_realtime add table public.dashboard_shared_settings;
  end if;
end $$;
