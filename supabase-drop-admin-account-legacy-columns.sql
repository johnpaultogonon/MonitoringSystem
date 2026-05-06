-- Optional: removes legacy "adminID" and "Password" if they still exist.
-- If you already ran supabase-migrate-admin-account-modal.sql (or 20260426003000_align_admin_account_modal.sql)
-- after it was updated to include step 6, this file is a no-op.
-- App + Account Management use password_plain only, not "Password".

alter table public.admin_account drop column if exists "adminID";
alter table public.admin_account drop column if exists "Password";
