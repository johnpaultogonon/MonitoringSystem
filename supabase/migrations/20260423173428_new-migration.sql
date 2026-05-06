-- Run this in Supabase SQL Editor.
-- Creates events table with RLS so users only access their own rows.

create extension if not exists "pgcrypto";

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  details text,
  status text not null default 'upcoming' check (status in ('upcoming', 'done')),
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

drop policy if exists "events_select_own" on public.events;
create policy "events_select_own"
  on public.events
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "events_insert_own" on public.events;
create policy "events_insert_own"
  on public.events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "events_update_own" on public.events;
create policy "events_update_own"
  on public.events
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "events_delete_own" on public.events;
create policy "events_delete_own"
  on public.events
  for delete
  to authenticated
  using (auth.uid() = user_id);
