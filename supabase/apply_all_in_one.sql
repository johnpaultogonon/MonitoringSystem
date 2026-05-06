-- =============================================================================
-- ONE-PASTE SUPABASE SETUP (SQL Editor → Run)
-- =============================================================================
-- Prerequisites: deploy the latest legacy-dashboard (public/) so the app matches
-- the schema — especially BEFORE section "D" if you dropped member columns.
--
-- A) Shared theme / sidebar / density + Realtime
-- B) Extra tables on Realtime (teams, members, tasks, birthdate)
-- C) Admin account: drop legacy profile columns (optional if you use new UI)
-- D) Members: drop employee_id, full_name, position (optional if you use new UI)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A) dashboard_shared_settings (shared Light / Night sky, sidebar, density)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- B) Realtime for teams, members, task_lists, birthdate
-- -----------------------------------------------------------------------------
alter table public.teams replica identity full;
alter table public.members replica identity full;
alter table public.task_lists replica identity full;
alter table public.birthdate replica identity full;

do $$
declare
  t text;
begin
  foreach t in array array['teams', 'members', 'task_lists', 'birthdate']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- C) admin_account — remove Employee ID / Full Name / Position columns
-- -----------------------------------------------------------------------------
alter table public.admin_account drop column if exists employee_id;
alter table public.admin_account drop column if exists full_name;
alter table public.admin_account drop column if exists position;

-- -----------------------------------------------------------------------------
-- D) members — remove Employee ID / Full Name / Position columns
-- (Run only after the new member add/edit UI is live for all users.)
-- -----------------------------------------------------------------------------
alter table public.members drop column if exists employee_id;
alter table public.members drop column if exists full_name;
alter table public.members drop column if exists position;
