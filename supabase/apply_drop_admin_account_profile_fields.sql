-- Run in Supabase → SQL Editor if Account Management no longer uses Employee ID / Full Name / Position.
-- Matches supabase/migrations/20260506120000_drop_admin_account_profile_fields.sql

alter table public.admin_account drop column if exists employee_id;
alter table public.admin_account drop column if exists full_name;
alter table public.admin_account drop column if exists position;
