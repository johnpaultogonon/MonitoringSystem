create table if not exists public.admin_account (
  "adminID" integer generated always as identity primary key,
  "Email" varchar(255) not null unique,
  "Password" varchar(25) not null
);

insert into public.admin_account ("Email", "Password")
values ('johnpaultogonon123@gmail.com', 'janjan@123')
on conflict ("Email") do update
set "Password" = excluded."Password";
