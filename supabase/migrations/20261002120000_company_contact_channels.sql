alter table public.company_settings
  add column if not exists secondary_phone text,
  add column if not exists whatsapp_phone text;
