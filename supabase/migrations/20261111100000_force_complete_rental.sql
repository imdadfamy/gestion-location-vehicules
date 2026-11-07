-- Clôture forcée d'une location par un responsable (docs/business-rules.md, section 5).
--
-- * `rental_status_history.forced` / `reason` : repèrent un changement de statut fait à la main et son motif.
-- * `force_complete_rental(rental, reason)` : passe une location « en cours » ou « en retard » à « terminée » sans exiger
--   solde, caution ni incidents réglés. Réservé à la permission rentals.validate (le Super Admin l'a toujours), motif obligatoire.
--   Les paiements, la caution et les incidents ne sont pas modifiés.

begin;

alter table public.rental_status_history
  add column if not exists forced boolean not null default false,
  add column if not exists reason text;

create or replace function public.force_complete_rental(target_rental_id uuid, closure_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_status text;
  clean_reason text := trim(coalesce(closure_reason, ''));
begin
  if auth.uid() is null or not public.has_permission('rentals', 'validate') then
    raise exception 'Forced rental closure is not permitted' using errcode = '42501';
  end if;

  if char_length(clean_reason) < 3 then
    raise exception 'A reason is required to close a rental manually' using errcode = '22023';
  end if;

  select status into current_status
  from public.rentals
  where id = target_rental_id
  for update;

  if current_status is null then
    raise exception 'Rental does not exist' using errcode = '23503';
  end if;

  if current_status not in ('active', 'overdue') then
    raise exception 'Only a rental in progress or overdue can be closed manually' using errcode = '23514';
  end if;

  perform public.set_automatic_rental_status(target_rental_id, 'completed');

  update public.rental_status_history
  set forced = true, reason = clean_reason
  where id = (
    select id from public.rental_status_history
    where rental_id = target_rental_id and new_status = 'completed'
    order by created_at desc
    limit 1
  );
end;
$$;

revoke all on function public.force_complete_rental(uuid, text) from public, anon;
grant execute on function public.force_complete_rental(uuid, text) to authenticated;

commit;
