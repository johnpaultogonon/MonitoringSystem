-- Fix: "column event_categories.display_name does not exist"
-- Run in Supabase → SQL Editor → Run (safe to re-run).

alter table public.event_categories add column if not exists display_name text not null default '';
alter table public.event_categories add column if not exists position text not null default '';
alter table public.event_categories add column if not exists photo text;
