-- =============================================================================
-- Remove ALL shared calendar legend categories (clean slate).
-- Run in Supabase → SQL Editor.
--
-- Clears:
--   event_categories — legend names/colors (dropdown + sidebar legend)
--   section_details  — Reports folder display tied to category keys (if table exists)
--
-- Does NOT delete events (add_new_event still has category TEXT fields;
-- you can edit events later or run clear_calendar_and_birthday_data.sql for full wipe).
--
-- After running: reload the dashboard (hard refresh). The bundled JS clears
-- rpbdd_event_categories + report display cache when GET /categories returns [].
-- =============================================================================

do $$
begin
  if to_regclass('public.event_categories') is not null then
    truncate table public.event_categories restart identity cascade;
  end if;

  if to_regclass('public.section_details') is not null then
    truncate table public.section_details restart identity cascade;
  end if;
end $$;
