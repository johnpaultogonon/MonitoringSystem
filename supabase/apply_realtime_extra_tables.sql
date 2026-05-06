-- Optional: instant cross-user UI updates (otherwise ~1s poll still refreshes).
-- Run in Supabase SQL Editor after your tables exist. Safe to re-run.

alter table public.teams replica identity full;
alter table public.members replica identity full;
alter table public.task_lists replica identity full;
alter table public.birthdate replica identity full;

do $$
declare
  t text;
begin
  foreach t in array array['teams', 'members', 'task_lists', 'birthdate']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
