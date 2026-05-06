Supabase migrations folder — keep every numbered *.sql file name.

Why: Remote/local databases record each filename in schema_migrations. Deleting or
renaming a file breaks `supabase db pull`, reset, and teammate clones unless you run
`supabase migration repair` (see Supabase docs).

20260426120000_drop_admin_account_legacy_columns.sql is intentionally a no-op; the
same drops run in 20260426003000_align_admin_account_modal.sql.

Optional SQL not tied to CLI history lives in supabase/*.sql (e.g. apply_all_in_one.sql).
