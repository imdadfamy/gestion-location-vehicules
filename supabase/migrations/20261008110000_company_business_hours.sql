-- Public home page footer currently hardcodes "Horaires : à préciser".
-- Add a configurable business hours field alongside the existing
-- phone/whatsapp_phone/secondary_phone contact columns, and expose it
-- through the same public RPC already used for the footer's contact info.
alter table public.company_settings
  add column if not exists business_hours text;

drop function if exists public.public_company_contact();

create function public.public_company_contact()
returns table (
  company_name text, phone text, secondary_phone text, whatsapp_phone text, address text, business_hours text
)
language sql stable security definer set search_path = public, pg_temp as $$
  select company_name, phone, secondary_phone, whatsapp_phone, address, business_hours
  from public.company_settings
  limit 1;
$$;

revoke all on function public.public_company_contact() from public;
grant execute on function public.public_company_contact() to anon, authenticated;
