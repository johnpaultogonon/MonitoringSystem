-- Remove profile fields no longer shown in Account Management (Employee ID, Full Name, Position).
-- Safe to re-run.

alter table public.admin_account drop column if exists employee_id;
alter table public.admin_account drop column if exists full_name;
alter table public.admin_account drop column if exists position;
