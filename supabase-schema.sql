-- Run this in Supabase SQL Editor.
-- Extends events table for legacy dashboard fields and recycle flow.

create extension if not exists "pgcrypto";

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  details text,
  description text default '',
  location text default '',
  dates_json jsonb not null default '[]'::jsonb,
  time_raw text default '',
  time_display text default '',
  category text default '',
  input_by text default '',
  status text not null default 'upcoming' check (status in ('upcoming', 'done')),
  is_recycled boolean not null default false,
  recycled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events
  add column if not exists description text default '',
  add column if not exists location text default '',
  add column if not exists dates_json jsonb not null default '[]'::jsonb,
  add column if not exists time_raw text default '',
  add column if not exists time_display text default '',
  add column if not exists category text default '',
  add column if not exists input_by text default '',
  add column if not exists is_recycled boolean not null default false,
  add column if not exists recycled_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.events
set
  description = coalesce(nullif(description, ''), coalesce(details, '')),
  dates_json = case
    when jsonb_typeof(dates_json) = 'array' then dates_json
    else '[]'::jsonb
  end
where true;

create index if not exists idx_events_is_recycled on public.events(is_recycled);
create index if not exists idx_events_created_at on public.events(created_at desc);

alter table public.events enable row level security;

drop policy if exists "events_select_anon_or_auth" on public.events;
create policy "events_select_anon_or_auth"
  on public.events
  for select
  to anon, authenticated
  using (true);

drop policy if exists "events_insert_anon_or_auth" on public.events;
create policy "events_insert_anon_or_auth"
  on public.events
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "events_update_anon_or_auth" on public.events;
create policy "events_update_anon_or_auth"
  on public.events
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "events_delete_anon_or_auth" on public.events;
create policy "events_delete_anon_or_auth"
  on public.events
  for delete
  to anon, authenticated
  using (true);

-- add_new_event: dashboard events keyed by event_id (adapter exposes as id)
create table if not exists public.add_new_event (
  event_id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  location text default '',
  dates_json jsonb not null default '[]'::jsonb,
  time_raw text default '',
  time_display text default '',
  category text default '',
  input_by text default '',
  status text not null default 'upcoming' check (status in ('upcoming', 'done')),
  is_recycled boolean not null default false,
  recycled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_add_new_event_is_recycled on public.add_new_event(is_recycled);
create index if not exists idx_add_new_event_created_at on public.add_new_event(created_at desc);

alter table public.add_new_event enable row level security;

drop policy if exists "add_new_event_select_anon_or_auth" on public.add_new_event;
create policy "add_new_event_select_anon_or_auth"
  on public.add_new_event for select to anon, authenticated using (true);
drop policy if exists "add_new_event_insert_anon_or_auth" on public.add_new_event;
create policy "add_new_event_insert_anon_or_auth"
  on public.add_new_event for insert to anon, authenticated with check (true);
drop policy if exists "add_new_event_update_anon_or_auth" on public.add_new_event;
create policy "add_new_event_update_anon_or_auth"
  on public.add_new_event for update to anon, authenticated using (true) with check (true);
drop policy if exists "add_new_event_delete_anon_or_auth" on public.add_new_event;
create policy "add_new_event_delete_anon_or_auth"
  on public.add_new_event for delete to anon, authenticated using (true);

-- Shared event category definitions (legend + dropdowns; same for all users when events API is enabled)
create table if not exists public.event_categories (
  name text primary key,
  color text not null default '#3B82F6',
  sort_order int not null default 0,
  display_name text not null default '',
  position text not null default '',
  photo text,
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

-- Shared dashboard UI (theme: light | night) — one row for all connected users when events API is on
create table if not exists public.dashboard_shared_settings (
  id smallint primary key default 1 constraint dashboard_shared_settings_singleton check (id = 1),
  theme text not null default 'light',
  sidebar_collapsed boolean not null default false,
  density text not null default 'compact',
  updated_at timestamptz not null default now()
);

insert into public.dashboard_shared_settings (id, theme) values (1, 'light') on conflict (id) do nothing;

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

-- Teams table for Team Management module
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  lead_id text default '',
  email text default '',
  password_plain text default '',
  password_mask text default '••••••••',
  team_leader text default '',
  section_team text default '',
  position text default '',
  photo text,
  members_count integer not null default 0,
  is_recycled boolean not null default false,
  recycled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_teams_is_recycled on public.teams(is_recycled);

alter table public.teams enable row level security;
drop policy if exists "teams_select_anon_or_auth" on public.teams;
create policy "teams_select_anon_or_auth" on public.teams for select to anon, authenticated using (true);
drop policy if exists "teams_insert_anon_or_auth" on public.teams;
create policy "teams_insert_anon_or_auth" on public.teams for insert to anon, authenticated with check (true);
drop policy if exists "teams_update_anon_or_auth" on public.teams;
create policy "teams_update_anon_or_auth" on public.teams for update to anon, authenticated using (true) with check (true);
drop policy if exists "teams_delete_anon_or_auth" on public.teams;
create policy "teams_delete_anon_or_auth" on public.teams for delete to anon, authenticated using (true);

-- Members table for Total Members module
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  email text default '',
  password_plain text default '',
  password_mask text default '••••••••',
  team text default '',
  photo text,
  is_recycled boolean not null default false,
  recycled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_members_is_recycled on public.members(is_recycled);

alter table public.members enable row level security;
drop policy if exists "members_select_anon_or_auth" on public.members;
create policy "members_select_anon_or_auth" on public.members for select to anon, authenticated using (true);
drop policy if exists "members_insert_anon_or_auth" on public.members;
create policy "members_insert_anon_or_auth" on public.members for insert to anon, authenticated with check (true);
drop policy if exists "members_update_anon_or_auth" on public.members;
create policy "members_update_anon_or_auth" on public.members for update to anon, authenticated using (true) with check (true);
drop policy if exists "members_delete_anon_or_auth" on public.members;
create policy "members_delete_anon_or_auth" on public.members for delete to anon, authenticated using (true);

-- Task lists table for Tasks module
create table if not exists public.task_lists (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled',
  status text not null default 'new',
  creator_notes text default '',
  published boolean not null default false,
  items_json jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  approved_at timestamptz,
  viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_task_lists_status on public.task_lists(status);
create index if not exists idx_task_lists_created_at on public.task_lists(created_at desc);

alter table public.task_lists enable row level security;
drop policy if exists "task_lists_select_anon_or_auth" on public.task_lists;
create policy "task_lists_select_anon_or_auth" on public.task_lists for select to anon, authenticated using (true);
drop policy if exists "task_lists_insert_anon_or_auth" on public.task_lists;
create policy "task_lists_insert_anon_or_auth" on public.task_lists for insert to anon, authenticated with check (true);
drop policy if exists "task_lists_update_anon_or_auth" on public.task_lists;
create policy "task_lists_update_anon_or_auth" on public.task_lists for update to anon, authenticated using (true) with check (true);
drop policy if exists "task_lists_delete_anon_or_auth" on public.task_lists;
create policy "task_lists_delete_anon_or_auth" on public.task_lists for delete to anon, authenticated using (true);

-- Profile notifications table
create table if not exists public.profile_notifications (
  id uuid primary key default gen_random_uuid(),
  title text default '',
  message text default '',
  recipients jsonb not null default '[]'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profile_notifications_created_at on public.profile_notifications(created_at desc);

alter table public.profile_notifications enable row level security;
drop policy if exists "profile_notifications_select_anon_or_auth" on public.profile_notifications;
create policy "profile_notifications_select_anon_or_auth" on public.profile_notifications for select to anon, authenticated using (true);
drop policy if exists "profile_notifications_insert_anon_or_auth" on public.profile_notifications;
create policy "profile_notifications_insert_anon_or_auth" on public.profile_notifications for insert to anon, authenticated with check (true);
drop policy if exists "profile_notifications_update_anon_or_auth" on public.profile_notifications;
create policy "profile_notifications_update_anon_or_auth" on public.profile_notifications for update to anon, authenticated using (true) with check (true);
drop policy if exists "profile_notifications_delete_anon_or_auth" on public.profile_notifications;
create policy "profile_notifications_delete_anon_or_auth" on public.profile_notifications for delete to anon, authenticated using (true);

-- User logs table
create table if not exists public.user_logs (
  id uuid primary key default gen_random_uuid(),
  full_name text default '',
  email text default '',
  role text default '',
  team text default '',
  login text default '',
  logout text default '',
  date text default '',
  log_date text default '',
  time_in text default '',
  time_out text default '',
  created_at timestamptz not null default now()
);

alter table public.user_logs
  add column if not exists log_date text default '',
  add column if not exists time_in text default '',
  add column if not exists time_out text default '';

update public.user_logs
set
  log_date = coalesce(nullif(log_date, ''), coalesce(date, '')),
  time_in = coalesce(nullif(time_in, ''), coalesce(login, '')),
  time_out = coalesce(nullif(time_out, ''), coalesce(logout, ''))
where true;

create index if not exists idx_user_logs_created_at on public.user_logs(created_at desc);

alter table public.user_logs enable row level security;
drop policy if exists "user_logs_select_anon_or_auth" on public.user_logs;
create policy "user_logs_select_anon_or_auth" on public.user_logs for select to anon, authenticated using (true);
drop policy if exists "user_logs_insert_anon_or_auth" on public.user_logs;
create policy "user_logs_insert_anon_or_auth" on public.user_logs for insert to anon, authenticated with check (true);
drop policy if exists "user_logs_update_anon_or_auth" on public.user_logs;
create policy "user_logs_update_anon_or_auth" on public.user_logs for update to anon, authenticated using (true) with check (true);
drop policy if exists "user_logs_delete_anon_or_auth" on public.user_logs;
create policy "user_logs_delete_anon_or_auth" on public.user_logs for delete to anon, authenticated using (true);

-- Admin account table (singular)
create table if not exists public.admin_account (
  id uuid primary key default gen_random_uuid(),
  email text default '',
  role text default 'Admin',
  password_plain text default '',
  photo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_account
  add column if not exists email text default '';

alter table public.admin_account
  add column if not exists password_plain text default '';

alter table public.admin_account
  add column if not exists photo text;

alter table public.admin_account
  add column if not exists role text default 'Admin';

create unique index if not exists uq_admin_account_email_ci
  on public.admin_account (lower(email))
  where coalesce(email, '') <> '';

alter table public.admin_account
  add column if not exists created_at timestamptz not null default now();

alter table public.admin_account
  add column if not exists updated_at timestamptz not null default now();

alter table public.admin_account enable row level security;
drop policy if exists "admin_account_select_anon_or_auth" on public.admin_account;
create policy "admin_account_select_anon_or_auth" on public.admin_account for select to anon, authenticated using (true);
drop policy if exists "admin_account_insert_anon_or_auth" on public.admin_account;
create policy "admin_account_insert_anon_or_auth" on public.admin_account for insert to anon, authenticated with check (true);
drop policy if exists "admin_account_update_anon_or_auth" on public.admin_account;
create policy "admin_account_update_anon_or_auth" on public.admin_account for update to anon, authenticated using (true) with check (true);
drop policy if exists "admin_account_delete_anon_or_auth" on public.admin_account;
create policy "admin_account_delete_anon_or_auth" on public.admin_account for delete to anon, authenticated using (true);

-- Keep updated_at fresh on every update for admin_account
create or replace function public.set_admin_account_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_admin_account_set_updated_at on public.admin_account;
create trigger trg_admin_account_set_updated_at
before update on public.admin_account
for each row
execute function public.set_admin_account_updated_at();
