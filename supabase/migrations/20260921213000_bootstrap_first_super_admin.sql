-- One-time, SQL-administrator-only bootstrap for the first internal Super Admin.
begin;

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_setting('app.bootstrap_first_super_admin', true) = 'on'
    or auth.role() = 'service_role'
    or public.is_super_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.permissions is distinct from old.permissions
    or new.is_active is distinct from old.is_active
    or new.created_at is distinct from old.created_at then
    raise exception 'Only a Super Admin or the secured backend can change account privileges'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.bootstrap_first_super_admin(target_email text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_id uuid;
begin
  if exists (select 1 from public.profiles where role = 'super_admin') then
    raise exception 'A Super Admin already exists; bootstrap is permanently closed'
      using errcode = '55000';
  end if;

  select id into target_id from public.profiles where email = target_email;
  if target_id is null then
    raise exception 'No profile exists for the supplied email' using errcode = 'P0002';
  end if;

  perform set_config('app.bootstrap_first_super_admin', 'on', true);
  update public.profiles
  set role = 'super_admin', is_active = true, permissions = '{}'::jsonb
  where id = target_id;
  return target_id;
end;
$$;

revoke all on function public.bootstrap_first_super_admin(text) from public, anon, authenticated, service_role;

commit;
