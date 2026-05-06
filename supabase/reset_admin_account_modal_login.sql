-- Sets Account Management modal credentials (admin_account table) to the requested values.
-- Run in Supabase SQL Editor.

do $$
begin
  if to_regclass('public.admin_account') is null then
    raise exception 'public.admin_account does not exist';
  end if;

  update public.admin_account
  set
    email = 'johnpaultogonon123@gmail.com',
    role = coalesce(nullif(role, ''), 'Admin'),
    password_plain = 'janjan@123',
    updated_at = now()
  where true;

  if not found then
    insert into public.admin_account (email, role, password_plain, created_at, updated_at)
    values ('johnpaultogonon123@gmail.com', 'Admin', 'janjan@123', now(), now());
  end if;
end $$;
