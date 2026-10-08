-- get_staff_display_names() has raised "column reference \"id\" is ambiguous"
-- on every single call since it was introduced: the function's own
-- RETURNS TABLE(id uuid, ...) declares an implicit PL/pgSQL variable named
-- "id", which collided with the unqualified `where id = auth.uid()` in the
-- caller-authorization check. Every actor name across the app (activity
-- log, payment history, rental status history) silently fell back to
-- "Utilisateur interne" / "Système" because of this. Fix: qualify the
-- column with an explicit alias.

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
    from public.profiles as caller
    where caller.id = auth.uid()
      and caller.is_active
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
