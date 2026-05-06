-- add_new_event: stores legacy "Add New Event" modal data.
-- Primary key: event_id (maps to client field "id" via adapter).

create extension if not exists "pgcrypto";

create table if not exists public.add_new_event (
  event_id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
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

create index if not exists idx_add_new_event_is_recycled on public.add_new_event (is_recycled);
create index if not exists idx_add_new_event_created_at on public.add_new_event (created_at desc);

alter table public.add_new_event enable row level security;

drop policy if exists "add_new_event_select_anon_or_auth" on public.add_new_event;
create policy "add_new_event_select_anon_or_auth"
  on public.add_new_event
  for select
  to anon, authenticated
  using (true);

drop policy if exists "add_new_event_insert_anon_or_auth" on public.add_new_event;
create policy "add_new_event_insert_anon_or_auth"
  on public.add_new_event
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "add_new_event_update_anon_or_auth" on public.add_new_event;
create policy "add_new_event_update_anon_or_auth"
  on public.add_new_event
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "add_new_event_delete_anon_or_auth" on public.add_new_event;
create policy "add_new_event_delete_anon_or_auth"
  on public.add_new_event
  for delete
  to anon, authenticated
  using (true);

-- One-time copy from legacy public.events (column set varies by project; use dynamic SQL).
do $migrate$
declare
  has_description boolean;
  has_details boolean;
  has_location boolean;
  has_dates_json boolean;
  has_time_raw boolean;
  has_time_display boolean;
  has_category boolean;
  has_input_by boolean;
  has_is_recycled boolean;
  has_recycled_at boolean;
  has_updated_at boolean;
  expr_description text;
  expr_location text;
  expr_dates_json text;
  expr_time_raw text;
  expr_time_display text;
  expr_category text;
  expr_input_by text;
  expr_is_recycled text;
  expr_recycled_at text;
  expr_updated_at text;
  sql text;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'events'
  ) then
    return;
  end if;

  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'events' and c.column_name = 'description'
  ) into has_description;
  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'events' and c.column_name = 'details'
  ) into has_details;
  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'events' and c.column_name = 'location'
  ) into has_location;
  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'events' and c.column_name = 'dates_json'
  ) into has_dates_json;
  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'events' and c.column_name = 'time_raw'
  ) into has_time_raw;
  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'events' and c.column_name = 'time_display'
  ) into has_time_display;
  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'events' and c.column_name = 'category'
  ) into has_category;
  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'events' and c.column_name = 'input_by'
  ) into has_input_by;
  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'events' and c.column_name = 'is_recycled'
  ) into has_is_recycled;
  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'events' and c.column_name = 'recycled_at'
  ) into has_recycled_at;
  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'events' and c.column_name = 'updated_at'
  ) into has_updated_at;

  if has_description and has_details then
    expr_description := $e$coalesce(nullif(trim(e.description), ''), nullif(trim(coalesce(e.details, '')), ''), '')$e$;
  elsif has_description then
    expr_description := $e$coalesce(nullif(trim(e.description), ''), '')$e$;
  elsif has_details then
    expr_description := $e$coalesce(nullif(trim(coalesce(e.details, '')), ''), '')$e$;
  else
    expr_description := $e$''$e$;
  end if;

  if has_location then
    expr_location := $e$coalesce(e.location, '')$e$;
  else
    expr_location := $e$''$e$;
  end if;

  if has_dates_json then
    expr_dates_json := $e$case when jsonb_typeof(e.dates_json) = 'array' then e.dates_json else '[]'::jsonb end$e$;
  else
    expr_dates_json := $e$'[]'::jsonb$e$;
  end if;

  if has_time_raw then
    expr_time_raw := $e$coalesce(e.time_raw, '')$e$;
  else
    expr_time_raw := $e$''$e$;
  end if;

  if has_time_display then
    expr_time_display := $e$coalesce(e.time_display, '')$e$;
  else
    expr_time_display := $e$''$e$;
  end if;

  if has_category then
    expr_category := $e$coalesce(e.category, '')$e$;
  else
    expr_category := $e$''$e$;
  end if;

  if has_input_by then
    expr_input_by := $e$coalesce(e.input_by, '')$e$;
  else
    expr_input_by := $e$''$e$;
  end if;

  if has_is_recycled then
    expr_is_recycled := $e$coalesce(e.is_recycled, false)$e$;
  else
    expr_is_recycled := $e$false$e$;
  end if;

  if has_recycled_at then
    expr_recycled_at := $e$e.recycled_at$e$;
  else
    expr_recycled_at := $e$null::timestamptz$e$;
  end if;

  if has_updated_at then
    expr_updated_at := $e$e.updated_at$e$;
  else
    expr_updated_at := $e$e.created_at$e$;
  end if;

  sql := format(
    $f$insert into public.add_new_event (
      event_id, user_id, title, description, location, dates_json,
      time_raw, time_display, category, input_by, status,
      is_recycled, recycled_at, created_at, updated_at
    )
    select
      e.id, e.user_id, e.title,
      %s, %s, %s, %s, %s, %s, %s,
      coalesce(e.status, 'upcoming'),
      %s, %s, e.created_at, %s
    from public.events e
    on conflict (event_id) do nothing$f$,
    expr_description,
    expr_location,
    expr_dates_json,
    expr_time_raw,
    expr_time_display,
    expr_category,
    expr_input_by,
    expr_is_recycled,
    expr_recycled_at,
    expr_updated_at
  );

  execute sql;
end $migrate$;
