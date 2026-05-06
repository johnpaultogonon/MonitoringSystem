-- Reports folder cards: shared display name, position, photo (same as legend categories).

alter table public.event_categories
  add column if not exists display_name text not null default '';

alter table public.event_categories
  add column if not exists position text not null default '';

alter table public.event_categories
  add column if not exists photo text;
