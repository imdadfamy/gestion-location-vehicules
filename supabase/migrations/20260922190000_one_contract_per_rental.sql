-- One rental is represented by exactly one contract for the whole lifecycle.
-- This constraint is deliberately added in a new migration: it has not been
-- deployed to the remote Supabase project yet.
create unique index if not exists contracts_one_contract_per_rental
  on public.contracts (rental_id);
