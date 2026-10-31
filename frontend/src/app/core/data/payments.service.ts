import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';

export type PaymentMethod = 'cash' | 'mobile_money' | 'bank_transfer' | 'other';

/**
 * Encaissements et cautions, enregistrés manuellement (aucun paiement en ligne).
 * La base refuse un total encaissé supérieur au prix et toute modification d'un
 * paiement ; une caution restituée ou retenue est définitive.
 */
@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private auth = inject(AuthService);
  private get db() {
    return this.auth.supabase();
  }

  /** Locations avec le client (e-mail compris, pour le reçu) et le véhicule. */
  rentals() {
    return this.db
      .from('rentals')
      .select(
        '*,clients(first_name,last_name,phone,email),vehicles(registration_number,make,model)',
      )
      .order('created_at', { ascending: false });
  }

  all() {
    return this.db.from('payments').select('*').order('payment_date', { ascending: false });
  }

  /** Encaissement partiel ou total ; le solde est recalculé à partir de la somme des paiements. */
  record(values: {
    rental_id: string;
    amount: number;
    payment_date: string;
    payment_method: PaymentMethod;
    reference?: string | null;
    observation?: string | null;
  }) {
    return this.db.from('payments').insert(values);
  }

  // ── Cautions ──
  deposits() {
    return this.db.from('deposits').select('*');
  }

  /** Le client a versé la caution prévue (montant imposé par la location). */
  receiveDeposit(rentalId: string, amount: number) {
    return this.db
      .from('deposits')
      .upsert(
        { rental_id: rentalId, amount, status: 'received', received_at: new Date().toISOString() },
        { onConflict: 'rental_id' },
      );
  }

  /** Restitution intégrale. */
  returnDeposit(depositId: string, amount: number, observation?: string) {
    return this.db
      .from('deposits')
      .update({
        status: 'returned',
        returned_amount: amount,
        returned_at: new Date().toISOString(),
        observation: observation || null,
      })
      .eq('id', depositId);
  }

  /** Retenue totale ou partielle : le reste est restitué au client. */
  retainDeposit(depositId: string, amount: number, retained: number, observation: string) {
    const now = new Date().toISOString();
    return this.db
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
}
