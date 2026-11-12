-- Annulation d'une location qui n'a pas commencé (docs/business-rules.md, « Annulation d'une location qui n'a pas commencé »).
--
-- `cancel_rental(location, motif)` : passe une location « en attente » à « annulée », avec un motif obligatoire conservé dans
-- l'historique des statuts.
--   * Qui : le personnel avec la permission rentals.update, ou le partenaire propriétaire de la location.
--   * Un contrat en attente de signature est annulé (son lien de signature à distance devient inutilisable) ; un contrat signé
--     n'est jamais modifié. Paiements et caution ne sont pas touchés.
--   * L'autre partie est prévenue (partenaire ou équipe).

begin;

create or replace function public.cancel_rental(target_rental_id uuid, cancel_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.rentals%rowtype;
  clean_reason text := trim(coalesce(cancel_reason, ''));
  by_partner boolean := false;
  partner_profile uuid;
  vehicle_text text;
begin
  if auth.uid() is null then
    raise exception 'Cancelling a rental is not permitted' using errcode = '42501';
  end if;

  select * into r from public.rentals where id = target_rental_id for update;
  if r.id is null then
    raise exception 'Rental does not exist' using errcode = '23503';
  end if;

  -- Partenaire propriétaire de la location (compte actif), sinon permission du personnel.
  select exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'partner' and pr.is_active
      and r.owner_partner_id is not null and r.owner_partner_id = public.my_partner_id()
  ) into by_partner;
  if not (by_partner or public.has_permission('rentals', 'update')) then
    raise exception 'Cancelling a rental is not permitted' using errcode = '42501';
  end if;

  if char_length(clean_reason) < 3 then
    raise exception 'A reason is required to cancel a rental' using errcode = '22023';
  end if;
  if r.status <> 'pending' then
    raise exception 'Only a rental that has not started can be cancelled' using errcode = '23514';
  end if;

  perform set_config('app.rental_status_sync', 'on', true);
  update public.rentals set status = 'cancelled' where id = r.id;
  perform set_config('app.rental_status_sync', 'off', true);

  update public.rental_status_history
  set reason = clean_reason
  where id = (
    select id from public.rental_status_history
    where rental_id = r.id and new_status = 'cancelled'
    order by created_at desc
    limit 1
  );

  -- Un contrat en attente est annulé et son lien de signature n'est plus utilisable ; un contrat signé reste intact.
  update public.contract_signing_links
  set revoked_at = now()
  where revoked_at is null and signed_at is null
    and contract_id in (select id from public.contracts where rental_id = r.id and status <> 'signed');
  update public.contracts set status = 'cancelled' where rental_id = r.id and status in ('draft', 'pending_signature');

  -- L'autre partie est prévenue.
  select concat_ws(' ', v.make, v.model) into vehicle_text from public.vehicles v where v.id = r.vehicle_id;
  if r.owner_partner_id is not null and not by_partner then
    select profile_id into partner_profile from public.partners where id = r.owner_partner_id;
    if partner_profile is not null then
      insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
      values (partner_profile, 'rental_cancelled', 'Location annulée',
              'La location de ' || coalesce(vehicle_text, 'votre véhicule') || ' a été annulée par l’équipe. Motif : ' || clean_reason, 'rental', r.id);
    end if;
  elsif by_partner then
    insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
    select p.id, 'rental_cancelled', 'Location de partenaire annulée',
           'Un partenaire a annulé la location de ' || coalesce(vehicle_text, 'son véhicule') || '. Motif : ' || clean_reason, 'rental', r.id
    from public.profiles p
    where p.is_active
      and (p.role = 'super_admin' or (p.permissions ? 'rentals' and p.permissions -> 'rentals' ? 'view'));
  end if;
end;
$$;

revoke all on function public.cancel_rental(uuid, text) from public, anon;
grant execute on function public.cancel_rental(uuid, text) to authenticated;

commit;
