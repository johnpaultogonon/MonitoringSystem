-- =============================================================================
-- Clear stored Events, calendar legend categories, Reports folder metadata,
-- and Birthday Celebrants data (Supabase SQL Editor → Run once).
--
-- Does NOT remove Philippine / Muslim holidays shown on the calendar:
-- those come from public/legacy-dashboard/assets/js/calendar-app.js
-- (PH_MUSLIM_HOLIDAYS_BY_YEAR, allPhilippineHolidays, etc.), not from tables.
--
-- Tables touched (only if they exist):
--   add_new_event     — dashboard “Add New Event” rows
--   events            — legacy events table (older installs only)
--   event_categories  — shared legend colors / category names
--   section_details   — per-category folder display (Reports modal)
--   birthdate         — birthday celebrants
--   birthdate_options — saved Position/Section dropdown values for birthdays
--
-- Leaves: teams, members, tasks, admin_account, dashboard_shared_settings, etc.
-- =============================================================================

do $$
begin
  if to_regclass('public.add_new_event') is not null then
    truncate table public.add_new_event restart identity cascade;
  end if;

  if to_regclass('public.events') is not null then
    truncate table public.events restart identity cascade;
  end if;

  if to_regclass('public.event_categories') is not null then
    truncate table public.event_categories restart identity cascade;
  end if;

  if to_regclass('public.section_details') is not null then
    truncate table public.section_details restart identity cascade;
  end if;

  if to_regclass('public.birthdate') is not null then
    truncate table public.birthdate restart identity cascade;
  end if;

  if to_regclass('public.birthdate_options') is not null then
    truncate table public.birthdate_options restart identity cascade;
  end if;
end $$;
