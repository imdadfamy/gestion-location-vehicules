-- Alertes sur le téléphone de l'équipe (notifications push du navigateur, sans service tiers
-- à abonner) : chaque notification créée pour un utilisateur qui a activé les alertes est
-- aussi envoyée sur ses appareils par la fonction Edge `send-push`.
--
-- * `push_subscriptions` : un appareil = une ligne, visible et supprimable par son seul propriétaire.
-- * `register_push_subscription` : enregistre l'appareil pour l'utilisateur connecté (un téléphone
--   partagé change de propriétaire à la connexion suivante).
-- * Un déclencheur sur `notifications` appelle la fonction Edge (pg_net, asynchrone) ; une erreur
--   d'envoi ne bloque jamais la création de la notification.
-- * La fonction Edge « réclame » la notification (`push_sent_at`) : un identifiant ne sert qu'une fois
--   et seulement dans les 10 minutes qui suivent sa création.

create extension if not exists pg_net with schema extensions;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_select on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

alter table public.notifications add column push_sent_at timestamptz;

create or replace function public.register_push_subscription(
  target_endpoint text,
  target_p256dh text,
  target_auth text,
  target_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if coalesce(target_endpoint, '') = '' or coalesce(target_p256dh, '') = '' or coalesce(target_auth, '') = '' then
    raise exception 'Appareil invalide.' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), target_endpoint, target_p256dh, target_auth, left(target_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end;
$$;
revoke all on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

-- Réglages internes (aucune politique : lus uniquement par les fonctions SECURITY DEFINER).
create table public.app_config (key text primary key, value text not null);
alter table public.app_config enable row level security;
insert into public.app_config (key, value)
values ('push_function_url', 'https://zkhpdpixwlimqnwublab.supabase.co/functions/v1/send-push')
on conflict (key) do nothing;

create or replace function public.push_on_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  target text;
begin
  if not exists (select 1 from public.push_subscriptions where user_id = new.user_id) then return new; end if;
  select value into target from public.app_config where key = 'push_function_url';
  if target is null then return new; end if;
  perform net.http_post(
    url := target,
    body := jsonb_build_object('notification_id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
exception when others then
  return new;
end;
$$;

create trigger notifications_push
after insert on public.notifications
for each row execute function public.push_on_notification();
