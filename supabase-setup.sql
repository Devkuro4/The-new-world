create table if not exists public.pieck_storage (
  id text primary key,
  value text not null
);
alter table public.pieck_storage enable row level security;
revoke all on public.pieck_storage from anon, authenticated;
grant select, insert, update, delete on public.pieck_storage to service_role;
