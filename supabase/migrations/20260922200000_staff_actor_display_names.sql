-- Expose only internal display names for activity and business histories.
-- This avoids granting access to complete profiles merely to resolve an author.

create or replace function public.get_staff_display_names(target_ids uuid[])
returns table (id uuid, display_name text)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active
  ) then
    raise exception 'Authentication is required to view internal actor names'
      using errcode = '42501';
  end if;

  return query
  select
    profile.id,
    coalesce(nullif(trim(profile.full_name), ''), nullif(trim(profile.email), ''), 'Utilisateur interne')
  from public.profiles as profile
  where profile.id = any(coalesce(target_ids, '{}'::uuid[]));
end;
$$;

revoke all on function public.get_staff_display_names(uuid[]) from public;
grant execute on function public.get_staff_display_names(uuid[]) to authenticated;
