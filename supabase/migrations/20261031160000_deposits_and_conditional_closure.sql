-- Phase 3 : cautions figées une fois réglées et clôture conditionnée (workflow §24).
--
-- Une location ne passe à « terminée » que lorsque l'inspection de retour est faite
-- ET que le solde est nul, la caution restituée ou retenue et les incidents liés
-- résolus. Sinon elle reste « en cours » (jamais « en retard » : le véhicule est
-- rentré). Elle se clôture d'elle-même dès que le dernier point est réglé.

begin;

-- 1. Caution : réglée = définitive ; une caution reçue ne redevient pas « non reçue ».
create or replace function public.enforce_deposit_integrity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  expected_amount numeric(12,2);
begin
  select deposit_amount into expected_amount from public.rentals where id = new.rental_id for update;
  if expected_amount is null then
    raise exception 'Rental does not exist' using errcode = '23503';
  end if;
  if new.amount <> expected_amount then
    raise exception 'Deposit amount must match the rental deposit amount' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if new.amount is distinct from old.amount then
      raise exception 'Deposit amount is immutable after creation' using errcode = '55000';
    end if;
    if old.status in ('returned', 'retained') then
      raise exception 'A settled deposit cannot be modified' using errcode = '55000';
    end if;
    if old.status = 'received' and new.status = 'not_received' then
      raise exception 'A received deposit cannot be marked as not received' using errcode = '23514';
    end if;
  end if;

  if new.status = 'not_received' and (new.returned_amount <> 0 or new.retained_amount <> 0) then
    raise exception 'An unreceived deposit cannot be returned or retained' using errcode = '23514';
  elsif new.status = 'received' and (new.received_at is null or new.returned_amount <> 0 or new.retained_amount <> 0) then
    raise exception 'A received deposit requires its receipt date and no settlement amount' using errcode = '23514';
  elsif new.status = 'returned' and (new.received_at is null or new.returned_at is null
    or new.returned_amount <> new.amount or new.retained_amount <> 0) then
    raise exception 'A returned deposit must be returned in full' using errcode = '23514';
  elsif new.status = 'retained' and (new.received_at is null or new.retained_at is null
    or new.retained_amount <= 0 or new.returned_amount + new.retained_amount <> new.amount) then
    raise exception 'A retained deposit must be fully allocated between returned and retained amounts'
      using errcode = '23514';
  end if;
  new.recorded_by := coalesce(auth.uid(), new.recorded_by);
  new.updated_by := new.recorded_by;
  return new;
end;
$$;

-- 2. Ce qui empêche la clôture : 'balance', 'deposit', 'incidents' (tableau vide = clôturable).
create or replace function public.rental_closure_blockers(target_rental_id uuid)
returns text[]
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select array_remove(array[
    case when coalesce((select sum(p.amount) from public.payments p where p.rental_id = r.id), 0)
              <> r.rental_price then 'balance' end,
    case when r.deposit_amount > 0 and coalesce(
              (select d.status from public.deposits d where d.rental_id = r.id), 'not_received')
              not in ('returned', 'retained') then 'deposit' end,
    case when exists (select 1 from public.incidents i
                      where i.rental_id = r.id and i.status not in ('resolved', 'closed'))
         then 'incidents' end
  ], null)
  from public.rentals r
  where r.id = target_rental_id
    and (auth.uid() is null or public.has_permission('rentals', 'view'));
$$;

revoke all on function public.rental_closure_blockers(uuid) from public, anon;
grant execute on function public.rental_closure_blockers(uuid) to authenticated;

-- 3. Évaluation du statut : le retour ne termine la location que si rien ne bloque.
create or replace function public.evaluate_rental_status(target_rental_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rental_status text;
  rental_return_date timestamptz;
begin
  select status, return_date into rental_status, rental_return_date
  from public.rentals where id = target_rental_id;

  if rental_status is null or rental_status in ('completed', 'cancelled') then
    return;
  end if;

  if exists (
    select 1 from public.vehicle_inspections
    where rental_id = target_rental_id and inspection_type = 'return'
  ) then
    if coalesce(array_length(public.rental_closure_blockers(target_rental_id), 1), 0) = 0 then
      perform public.set_automatic_rental_status(target_rental_id, 'completed');
    else
      -- Véhicule rentré, clôture en attente : jamais « en retard ».
      perform public.set_automatic_rental_status(target_rental_id, 'active');
    end if;
  elsif rental_status = 'active' and rental_return_date < now() then
    perform public.set_automatic_rental_status(target_rental_id, 'overdue');
  elsif exists (
    select 1 from public.contracts
    where rental_id = target_rental_id and status = 'signed'
  ) and exists (
    select 1 from public.vehicle_inspections
    where rental_id = target_rental_id and inspection_type = 'departure'
  ) then
    perform public.set_automatic_rental_status(target_rental_id, 'active');
  end if;
end;
$$;

revoke all on function public.evaluate_rental_status(uuid) from public, anon, authenticated;

-- 4. Réévaluation après paiement, caution ou incident.
create or replace function public.evaluate_rental_after_settlement_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.rental_id is not null then
    perform public.evaluate_rental_status(new.rental_id);
  end if;
  return new;
end;
$$;

drop trigger if exists evaluate_rental_after_payment on public.payments;
create trigger evaluate_rental_after_payment
after insert on public.payments
for each row execute function public.evaluate_rental_after_settlement_change();

drop trigger if exists evaluate_rental_after_deposit on public.deposits;
create trigger evaluate_rental_after_deposit
after insert or update on public.deposits
for each row execute function public.evaluate_rental_after_settlement_change();

drop trigger if exists evaluate_rental_after_incident on public.incidents;
create trigger evaluate_rental_after_incident
after insert or update of status, rental_id on public.incidents
for each row execute function public.evaluate_rental_after_settlement_change();

commit;
