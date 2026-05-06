-- Align public.admin_account with Account Management modal + JS adapter.
-- Legacy table (from 20260425041200): "adminID", "Email", "Password" (quoted identifiers).
--
-- Password: CANONICAL = password_plain (JS adapter). LEGACY = "Password" → backfilled into password_plain then dropped in step 6.

create extension if not exists "pgcrypto";

-- 1) Modal / adapter columns
alter table public.admin_account add column if not exists id uuid default gen_random_uuid();
alter table public.admin_account add column if not exists employee_id text default '';
alter table public.admin_account add column if not exists full_name text default '';
alter table public.admin_account add column if not exists position text default '';
alter table public.admin_account add column if not exists role text default 'Admin';
alter table public.admin_account add column if not exists password_plain text default '';
alter table public.admin_account add column if not exists photo text;
alter table public.admin_account add column if not exists created_at timestamptz not null default now();
alter table public.admin_account add column if not exists updated_at timestamptz not null default now();

-- 2) Normalize legacy quoted column "Email" -> email (pg_attribute preserves case)
do $$
begin
  if exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'admin_account'
      and a.attname = 'Email'
      and a.attnum > 0
      and not a.attisdropped
  )
  and not exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'admin_account'
      and a.attname = 'email'
      and a.attnum > 0
      and not a.attisdropped
  ) then
    execute 'alter table public.admin_account rename column "Email" to email';
  end if;
end $$;

-- 3) Backfill: id + email (always). Legacy "adminID" / "Password" only if still present (safe to re-run after step 6).
update public.admin_account
set
  id = coalesce(id, gen_random_uuid()),
  email = coalesce(nullif(trim(email), ''), '')
where true;

do $$
begin
  if exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'admin_account'
      and a.attname = 'adminID'
      and a.attnum > 0
      and not a.attisdropped
  ) then
    execute
      'update public.admin_account set employee_id = coalesce(nullif(trim(employee_id), ''''), "adminID"::text, '''')';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'admin_account'
      and a.attname = 'Password'
      and a.attnum > 0
      and not a.attisdropped
  ) then
    execute
      'update public.admin_account set password_plain = coalesce(nullif(trim(password_plain), ''''), "Password", '''')';
  end if;
end $$;

update public.admin_account
set full_name = coalesce(nullif(trim(full_name), ''), split_part(email, '@', 1), 'Administrator')
where coalesce(nullif(trim(full_name), ''), '') = '';

update public.admin_account
set position = coalesce(nullif(trim(position), ''), 'Administrator')
where coalesce(nullif(trim(position), ''), '') = '';

update public.admin_account
set role = coalesce(nullif(trim(role), ''), 'Admin')
where coalesce(nullif(trim(role), ''), '') = '';

-- 4) Primary key = id (uuid) for adapter .eq('id', …)
do $$
declare
  pk_name text;
begin
  select c.conname into pk_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'admin_account'
    and c.contype = 'p'
  limit 1;

  if pk_name is not null then
    execute format('alter table public.admin_account drop constraint %I', pk_name);
  end if;
end $$;

alter table public.admin_account alter column id set not null;

do $$
begin
  alter table public.admin_account add primary key (id);
exception
  when duplicate_object then
    null;
end $$;

drop index if exists uq_admin_account_email_ci;
create unique index if not exists uq_admin_account_email_ci
  on public.admin_account (lower(email))
  where coalesce(email, '') <> '';

-- 5) RLS
alter table public.admin_account enable row level security;

drop policy if exists "admin_account_select_anon_or_auth" on public.admin_account;
create policy "admin_account_select_anon_or_auth"
  on public.admin_account for select to anon, authenticated using (true);

drop policy if exists "admin_account_insert_anon_or_auth" on public.admin_account;
create policy "admin_account_insert_anon_or_auth"
  on public.admin_account for insert to anon, authenticated with check (true);

drop policy if exists "admin_account_update_anon_or_auth" on public.admin_account;
create policy "admin_account_update_anon_or_auth"
  on public.admin_account for update to anon, authenticated using (true) with check (true);

drop policy if exists "admin_account_delete_anon_or_auth" on public.admin_account;
create policy "admin_account_delete_anon_or_auth"
  on public.admin_account for delete to anon, authenticated using (true);

create or replace function public.set_admin_account_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_admin_account_set_updated_at on public.admin_account;
create trigger trg_admin_account_set_updated_at
  before update on public.admin_account
  for each row execute function public.set_admin_account_updated_at();

-- 6) Legacy "Password" / "adminID" — unused by app after backfill; canonical password column is password_plain.
alter table public.admin_account drop column if exists "adminID";
alter table public.admin_account drop column if exists "Password";
