-- Multi-user sync: allow postgres_changes on add_new_event for dashboard Realtime subscription.
-- Safe to re-run.
alter table public.add_new_event replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'add_new_event'
  ) then
    alter publication supabase_realtime add table public.add_new_event;
  end if;
end $$;
