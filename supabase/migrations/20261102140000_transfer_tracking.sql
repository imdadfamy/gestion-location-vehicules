-- Suivi enrichi des transferts aéroport.
--
-- * `transfer_drivers` : carnet de chauffeurs (nom, téléphone), assignés aux transferts.
-- * Statuts « en route » et « arrivé » ; point de rendez-vous par transfert.
-- * `transfer_events` : historique daté de chaque étape (alimenté par un déclencheur).
-- * Suivi public : `public_transfer_status` renvoie la frise, le chauffeur, le véhicule et le point
--   de rendez-vous ; `public_cancel_transfer` et `public_update_transfer` laissent le client agir ;
--   `public_subscribe_transfer_push` lui permet de recevoir les mises à jour sur son téléphone.
-- Chaque RPC publique exige la référence ET le téléphone du client.

-- ── Chauffeurs ──
create table public.transfer_drivers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null check (char_length(phone) between 6 and 30),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.transfer_drivers enable row level security;
create policy transfer_drivers_select on public.transfer_drivers for select to authenticated using (public.has_permission('reservations', 'view'));
create policy transfer_drivers_insert on public.transfer_drivers for insert to authenticated with check (public.has_permission('reservations', 'update'));
create policy transfer_drivers_update on public.transfer_drivers for update to authenticated
  using (public.has_permission('reservations', 'update')) with check (public.has_permission('reservations', 'update'));
create policy transfer_drivers_delete on public.transfer_drivers for delete to authenticated using (public.has_permission('reservations', 'update'));

-- ── Statuts, chauffeur, point de rendez-vous ──
alter table public.transfer_requests drop constraint transfer_requests_status_check;
alter table public.transfer_requests add constraint transfer_requests_status_check
  check (status in ('new', 'confirmed', 'assigned', 'en_route', 'arrived', 'done', 'cancelled'));
alter table public.transfer_requests
  add column driver_id uuid references public.transfer_drivers(id) on delete set null,
  add column meeting_point text check (char_length(meeting_point) <= 300);

-- ── Historique ──
create table public.transfer_events (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.transfer_requests(id) on delete cascade,
  status text not null,
  -- null = étape décidée par l'équipe ; 'client' = action du client (annulation) ; 'client_update' = modification.
  note text,
  created_at timestamptz not null default now(),
  push_sent_at timestamptz
);
create index transfer_events_transfer_idx on public.transfer_events (transfer_id, created_at);
alter table public.transfer_events enable row level security;
create policy transfer_events_select on public.transfer_events for select to authenticated using (public.has_permission('reservations', 'view'));

create or replace function public.log_transfer_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.transfer_events (transfer_id, status) values (new.id, new.status);
  elsif new.status is distinct from old.status then
    insert into public.transfer_events (transfer_id, status, note)
    values (new.id, new.status, case when current_setting('app.actor', true) = 'client' then 'client' end);
  end if;
  return new;
end;
$$;
create trigger transfer_requests_log_status
after insert or update of status on public.transfer_requests
for each row execute function public.log_transfer_status();

-- Les transferts déjà enregistrés reçoivent leur première étape.
insert into public.transfer_events (transfer_id, status, created_at)
select id, status, created_at from public.transfer_requests;

-- ── Alertes sur le téléphone du client (sans compte) ──
create table public.transfer_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.transfer_requests(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  lang text not null default 'fr' check (lang in ('fr', 'en')),
  created_at timestamptz not null default now(),
  unique (transfer_id, endpoint)
);
alter table public.transfer_push_subscriptions enable row level security;

create or replace function public.push_on_transfer_event()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  target text;
begin
  -- Seules les étapes décidées par l'équipe préviennent le client (pas la première, pas ses propres actions).
  if new.note is not null or new.status = 'new' then return new; end if;
  if not exists (select 1 from public.transfer_push_subscriptions where transfer_id = new.transfer_id) then return new; end if;
  select value into target from public.app_config where key = 'push_function_url';
  if target is null then return new; end if;
  perform net.http_post(
    url := target,
    body := jsonb_build_object('event_id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
exception when others then
  return new;
end;
$$;
create trigger transfer_events_push
after insert on public.transfer_events
for each row execute function public.push_on_transfer_event();

-- ── RPC publiques : la référence ET le téléphone doivent correspondre ──
create or replace function public.find_transfer_by_contact(target_reference text, target_phone text)
returns uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select t.id from public.transfer_requests t
  where t.reference = upper(trim(target_reference))
    and char_length(regexp_replace(coalesce(target_phone, ''), '\D', '', 'g')) >= 6
    and right(regexp_replace(t.customer_phone, '\D', '', 'g'), 8) = right(regexp_replace(coalesce(target_phone, ''), '\D', '', 'g'), 8);
$$;
revoke all on function public.find_transfer_by_contact(text, text) from public, anon, authenticated;

drop function public.public_transfer_status(text, text);
create or replace function public.public_transfer_status(target_reference text, target_phone text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  tid uuid := public.find_transfer_by_contact(target_reference, target_phone);
  t public.transfer_requests%rowtype;
  plate text;
  photo text;
  driver public.transfer_drivers%rowtype;
  show_vehicle boolean;
  show_driver boolean;
begin
  if tid is null then return null; end if;
  select * into t from public.transfer_requests where id = tid;
  show_vehicle := t.vehicle_id is not null and t.status in ('confirmed', 'assigned', 'en_route', 'arrived', 'done');
  show_driver := t.driver_id is not null and t.status in ('assigned', 'en_route', 'arrived');
  if show_vehicle then
    select v.registration_number into plate from public.vehicles v where v.id = t.vehicle_id;
    select vd.storage_path into photo from public.vehicle_documents vd
      where vd.vehicle_id = t.vehicle_id and coalesce(vd.mime_type, '') like 'image/%' order by vd.created_at desc limit 1;
  end if;
  if show_driver then select * into driver from public.transfer_drivers where id = t.driver_id; end if;
  return jsonb_build_object(
    'reference', t.reference,
    'route_from', t.route_from,
    'route_to', t.route_to,
    'pickup_at', t.pickup_at,
    'flight_number', t.flight_number,
    'passengers', t.passengers,
    'status', t.status,
    'price', coalesce(t.final_price, t.quoted_price),
    'vehicle_label', case when show_vehicle then t.vehicle_label end,
    'vehicle_plate', plate,
    'vehicle_photo', photo,
    'meeting_point', case when t.status not in ('new', 'cancelled') then t.meeting_point end,
    'driver_name', case when show_driver then driver.full_name end,
    'driver_phone', case when show_driver then driver.phone end,
    'can_cancel', t.status = 'new',
    'can_edit', t.status in ('new', 'confirmed', 'assigned') and t.pickup_at > now(),
    'events', coalesce((select jsonb_agg(jsonb_build_object('status', e.status, 'note', e.note, 'at', e.created_at) order by e.created_at)
                        from public.transfer_events e where e.transfer_id = t.id), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.public_transfer_status(text, text) from public;
grant execute on function public.public_transfer_status(text, text) to anon, authenticated;

create or replace function public.notify_staff_of_transfer(target_id uuid, notification_title text, notification_message text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
  select p.id, 'transfer_updated', notification_title, notification_message, 'transfer', target_id
  from public.profiles p
  where p.is_active
    and (p.role = 'super_admin' or (p.permissions ? 'reservations' and p.permissions -> 'reservations' ? 'view'));
$$;
revoke all on function public.notify_staff_of_transfer(uuid, text, text) from public, anon, authenticated;

create or replace function public.public_cancel_transfer(target_reference text, target_phone text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tid uuid := public.find_transfer_by_contact(target_reference, target_phone);
  t public.transfer_requests%rowtype;
begin
  if tid is null then return false; end if;
  perform set_config('app.actor', 'client', true);
  update public.transfer_requests set status = 'cancelled' where id = tid and status = 'new' returning * into t;
  if t.id is null then return false; end if;
  perform public.notify_staff_of_transfer(t.id, 'Transfert annulé par le client',
    t.customer_name || ' a annulé ' || t.route_from || ' → ' || t.route_to || ' (' || t.reference || ').');
  return true;
end;
$$;
revoke all on function public.public_cancel_transfer(text, text) from public;
grant execute on function public.public_cancel_transfer(text, text) to anon, authenticated;

create or replace function public.public_update_transfer(
  target_reference text,
  target_phone text,
  target_pickup_at timestamptz,
  target_flight_number text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tid uuid := public.find_transfer_by_contact(target_reference, target_phone);
  t public.transfer_requests%rowtype;
begin
  if tid is null then return false; end if;
  if target_pickup_at is null or target_pickup_at <= now() then
    raise exception 'La date du transfert doit être à venir.' using errcode = '22023';
  end if;
  update public.transfer_requests
    set pickup_at = target_pickup_at, flight_number = nullif(trim(target_flight_number), '')
    where id = tid and status in ('new', 'confirmed', 'assigned')
    returning * into t;
  if t.id is null then return false; end if;
  insert into public.transfer_events (transfer_id, status, note) values (t.id, t.status, 'client_update');
  perform public.notify_staff_of_transfer(t.id, 'Transfert modifié par le client',
    t.customer_name || ' a modifié l’heure ou le vol de ' || t.route_from || ' → ' || t.route_to
      || ' : ' || to_char(t.pickup_at at time zone 'Africa/Porto-Novo', 'DD/MM/YYYY HH24:MI') || ' (' || t.reference || ').');
  return true;
end;
$$;
revoke all on function public.public_update_transfer(text, text, timestamptz, text) from public;
grant execute on function public.public_update_transfer(text, text, timestamptz, text) to anon, authenticated;

create or replace function public.public_subscribe_transfer_push(
  target_reference text,
  target_phone text,
  target_endpoint text,
  target_p256dh text,
  target_auth text,
  target_lang text default 'fr'
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tid uuid := public.find_transfer_by_contact(target_reference, target_phone);
begin
  if tid is null or coalesce(target_endpoint, '') = '' or coalesce(target_p256dh, '') = '' or coalesce(target_auth, '') = '' then return false; end if;
  insert into public.transfer_push_subscriptions (transfer_id, endpoint, p256dh, auth, lang)
  values (tid, target_endpoint, target_p256dh, target_auth, case when target_lang = 'en' then 'en' else 'fr' end)
  on conflict (transfer_id, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, lang = excluded.lang;
  return true;
end;
$$;
revoke all on function public.public_subscribe_transfer_push(text, text, text, text, text, text) from public;
grant execute on function public.public_subscribe_transfer_push(text, text, text, text, text, text) to anon, authenticated;
