-- Run in Supabase → SQL Editor after deploying app changes that no longer use these columns.

alter table public.members drop column if exists employee_id;
alter table public.members drop column if exists full_name;
alter table public.members drop column if exists position;
