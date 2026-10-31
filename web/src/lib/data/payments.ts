import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type Db = SupabaseClient<Database>;
type Tone = 'success' | 'info' | 'warning' | 'danger' | 'muted';
export type Payment = Database['public']['Tables']['payments']['Row'];
export type Deposit = Database['public']['Tables']['deposits']['Row'];
export type PaymentMethod = 'cash' | 'mobile_money' | 'bank_transfer' | 'other';

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile money',
  bank_transfer: 'Virement',
  other: 'Autre',
};

/** Location avec son client (e-mail compris, pour le justificatif), son véhicule, ses paiements et sa caution. */
export type FinancialRow = Database['public']['Tables']['rentals']['Row'] & {
  clients: { first_name: string; last_name: string; phone: string | null; email: string | null } | null;
  vehicles: { registration_number: string; make: string; model: string } | null;
  payments: Payment[];
  deposit: Deposit | null;
};

/**
 * Encaissements et cautions, enregistrés manuellement (aucun paiement en ligne).
 * La base refuse un total encaissé supérieur au prix et toute modification d'un
 * paiement ; une caution restituée ou retenue est définitive.
 */
export async function loadFinancialRows(db: Db) {
  const [rentals, payments, deposits] = await Promise.all([
    db
      .from('rentals')
      .select('*,clients(first_name,last_name,phone,email),vehicles(registration_number,make,model)')
      .order('created_at', { ascending: false })
      .returns<Omit<FinancialRow, 'payments' | 'deposit'>[]>(),
    db.from('payments').select('*').order('payment_date', { ascending: false }),
    db.from('deposits').select('*'),
  ]);
  const error = rentals.error ?? payments.error ?? deposits.error;
  if (error) return { data: null, error };
  const byRental = new Map<string, Payment[]>();
  for (const payment of payments.data ?? []) byRental.set(payment.rental_id, [...(byRental.get(payment.rental_id) ?? []), payment]);
  const depositByRental = new Map((deposits.data ?? []).map((deposit) => [deposit.rental_id, deposit]));
  const data: FinancialRow[] = (rentals.data ?? []).map((rental) => ({
    ...rental,
    payments: byRental.get(rental.id) ?? [],
    deposit: depositByRental.get(rental.id) ?? null,
  }));
  return { data, error: null };
}

export const received = (row: Pick<FinancialRow, 'payments'>) =>
  row.payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
export const outstanding = (row: Pick<FinancialRow, 'payments' | 'rental_price'>) =>
  Math.max(0, Number(row.rental_price ?? 0) - received(row));

export function paymentState(row: Pick<FinancialRow, 'payments' | 'rental_price'>): { label: string; tone: Tone } {
  const amount = received(row);
  if (amount <= 0) return { label: 'Non payé', tone: 'muted' };
  return amount < Number(row.rental_price ?? 0) ? { label: 'Partiellement payé', tone: 'warning' } : { label: 'Payé', tone: 'success' };
}

export function depositState(row: Pick<FinancialRow, 'deposit_amount' | 'deposit'>): { label: string; tone: Tone } {
  if (!(Number(row.deposit_amount) > 0)) return { label: 'Aucune', tone: 'muted' };
  return (
    {
      received: { label: 'Reçue', tone: 'info' as Tone },
      returned: { label: 'Restituée', tone: 'success' as Tone },
      retained: { label: 'Retenue', tone: 'warning' as Tone },
    }[row.deposit?.status ?? ''] ?? { label: 'Non reçue', tone: 'muted' }
  );
}

/** Référence affichée : la référence technique de confirmation automatique est masquée. */
export function displayReference(payment: Payment) {
  const reference = String(payment.reference ?? '').trim();
  const clean = reference.startsWith('LOCATION-CONFIRMEE-') ? '' : reference;
  const parts = [clean || null, payment.observation || null].filter(Boolean);
  return parts.length ? parts.join(' — ') : '—';
}

export const receiptRef = (row: { id: string }) => `REC-${row.id.slice(0, 8).toUpperCase()}`;

/** Encaissement partiel ou total ; le solde est recalculé à partir de la somme des paiements. */
export function recordPayment(
  db: Db,
  values: { rental_id: string; amount: number; payment_date: string; payment_method: PaymentMethod; reference: string | null; observation: string | null },
) {
  return db.from('payments').insert(values);
}

/** Le client a versé la caution prévue (montant imposé par la location). */
export function receiveDeposit(db: Db, rentalId: string, amount: number) {
  return db
    .from('deposits')
    .upsert({ rental_id: rentalId, amount, status: 'received', received_at: new Date().toISOString() }, { onConflict: 'rental_id' });
}

/** Restitution intégrale. */
export function returnDeposit(db: Db, depositId: string, amount: number) {
  return db
    .from('deposits')
    .update({ status: 'returned', returned_amount: amount, returned_at: new Date().toISOString(), observation: null })
    .eq('id', depositId);
}

/** Retenue totale ou partielle : le reste est restitué au client. */
export function retainDeposit(db: Db, depositId: string, amount: number, retained: number, observation: string) {
  const now = new Date().toISOString();
  return db
    .from('deposits')
    .update({
      status: 'retained',
      retained_amount: retained,
      returned_amount: amount - retained,
      retained_at: now,
      returned_at: amount - retained > 0 ? now : null,
      observation,
    })
    .eq('id', depositId);
}
