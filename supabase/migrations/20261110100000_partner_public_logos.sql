-- Logos des partenaires sur le site public (bandeau défilant), voir docs/business-rules.md, section 18.
--
-- * `partners.logo_public_consent` : le partenaire accepte, de lui-même, que son logo soit affiché sur le site public
--   (décoché par défaut ; il se modifie par la policy `partners_update_self` existante).
-- * Un logo est publiable quand : le compte est actif, le partenaire a un nom commercial, un logo et a donné son accord.
-- * `public_partner_logos()` : nom commercial et chemin du logo des seuls partenaires publiables (rien d'autre : ni contrat,
--   ni coordonnées). Le seuil d'affichage (5 par défaut) est réglé dans l'éditeur « Site web », pas ici.
-- * `is_public_partner_logo(path)` + policy de stockage : la lecture anonyme est limitée aux fichiers de logo publiables
--   (un logo retiré, un accord retiré ou un compte désactivé ferme l'accès aussitôt).

begin;

alter table public.partners add column if not exists logo_public_consent boolean not null default false;

create or replace function public.is_public_partner_logo(target_path text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.partners p
    join public.profiles pr on pr.id = p.profile_id
    where p.logo_path = target_path
      and p.logo_public_consent
      and pr.is_active
      and char_length(trim(coalesce(p.company_name, ''))) > 0
  );
$$;
revoke all on function public.is_public_partner_logo(text) from public;
grant execute on function public.is_public_partner_logo(text) to anon, authenticated;

create or replace function public.public_partner_logos()
returns table (company_name text, logo_path text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select trim(p.company_name), p.logo_path
  from public.partners p
  join public.profiles pr on pr.id = p.profile_id
  where p.logo_path is not null
    and p.logo_public_consent
    and pr.is_active
    and char_length(trim(coalesce(p.company_name, ''))) > 0
  order by p.created_at, p.id;
$$;
revoke all on function public.public_partner_logos() from public;
grant execute on function public.public_partner_logos() to anon, authenticated;

drop policy if exists contract_assets_public_partner_logo_read on storage.objects;
create policy contract_assets_public_partner_logo_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'contract-assets' and name ~ '^partners/[0-9a-f-]{36}/logo-[0-9]+\.(png|jpe?g|webp)$' and public.is_public_partner_logo(name));

commit;
