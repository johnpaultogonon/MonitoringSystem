-- Realtime for shared category rows (optional; polling still refreshes categories).
alter table public.event_categories replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_categories'
  ) then
    alter publication supabase_realtime add table public.event_categories;
  end if;
end $$;
