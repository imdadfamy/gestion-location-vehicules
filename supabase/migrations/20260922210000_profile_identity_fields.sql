-- Internal user identity, kept separate from client records.
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

create or replace function public.sync_profile_full_name()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  composed_name text;
begin
  if new.first_name is not null or new.last_name is not null then
    composed_name := nullif(trim(concat_ws(' ', nullif(trim(new.first_name), ''), nullif(trim(new.last_name), ''))), '');
    if composed_name is not null then
      new.full_name := composed_name;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_profile_full_name on public.profiles;
create trigger sync_profile_full_name
before insert or update of first_name, last_name on public.profiles
for each row execute function public.sync_profile_full_name();
