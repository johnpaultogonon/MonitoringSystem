-- Align public.members with simplified profile (no Employee ID / Full Name / Position columns).
-- Safe to re-run.

alter table public.members drop column if exists employee_id;
alter table public.members drop column if exists full_name;
alter table public.members drop column if exists position;
