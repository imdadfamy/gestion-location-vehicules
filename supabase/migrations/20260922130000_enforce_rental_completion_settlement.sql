begin;

create or replace function public.enforce_rental_completion_settlement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  paid_total numeric(12,2);
  deposit_status text;
begin
  if tg_op = 'UPDATE' and new.status = 'completed' and old.status is distinct from 'completed' then
    select coalesce(sum(amount), 0) into paid_total
      from public.payments where rental_id = new.id;
    if paid_total <> new.rental_price then
      raise exception 'A rental can only be completed when its payment balance is zero' using errcode = '23514';
    end if;

    if new.deposit_amount > 0 then
      select status into deposit_status from public.deposits where rental_id = new.id;
      if deposit_status is null or deposit_status not in ('returned', 'retained') then
        raise exception 'A rental can only be completed when its deposit is returned or retained' using errcode = '23514';
      end if;
    end if;

    if exists (select 1 from public.incidents where rental_id = new.id and status not in ('resolved', 'closed')) then
      raise exception 'A rental can only be completed when related incidents are resolved' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_rental_completion_settlement on public.rentals;
create trigger enforce_rental_completion_settlement
before update of status on public.rentals
for each row execute function public.enforce_rental_completion_settlement();

commit;
