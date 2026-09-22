begin;

alter table public.vehicles
  add column if not exists insurance_expiry_date date,
  add column if not exists technical_inspection_expiry_date date;

commit;
