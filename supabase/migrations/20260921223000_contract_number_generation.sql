begin;

create table public.contract_number_counters (
  contract_year integer primary key check (contract_year between 2000 and 9999),
  next_number integer not null check (next_number > 0),
  updated_at timestamptz not null default now()
);

alter table public.contract_number_counters enable row level security;

create or replace function public.assign_contract_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_year integer := extract(year from now())::integer;
  allocated_number integer;
begin
  if new.contract_number is not null then
    return new;
  end if;

  insert into public.contract_number_counters (contract_year, next_number, updated_at)
  values (target_year, 2, now())
  on conflict (contract_year) do update
    set next_number = public.contract_number_counters.next_number + 1,
        updated_at = now()
  returning next_number - 1 into allocated_number;

  new.contract_number := format('LOC-%s-%s', target_year, lpad(allocated_number::text, 6, '0'));
  return new;
end;
$$;

drop trigger if exists assign_contract_number on public.contracts;
create trigger assign_contract_number
before insert on public.contracts
for each row execute function public.assign_contract_number();

commit;
