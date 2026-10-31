import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';

/** Encaissements enregistrés manuellement (aucun paiement en ligne). */
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
}
