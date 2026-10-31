import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';

/** Données du tableau de bord (indicateurs et graphiques). */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private auth = inject(AuthService);
  private get db() {
    return this.auth.supabase();
  }

  /** Parc, clients, locations, contrats à signer, encaissements et maintenances en cours. */
  sources() {
    return Promise.all([
      this.db.from('vehicles').select('id,status'),
      this.db.from('clients').select('id', { count: 'exact' }),
      this.db
        .from('rentals')
        .select(
          'id,status,departure_date,return_date,vehicle_id,vehicles(make,model,registration_number)',
        ),
      this.db.from('contracts').select('id').eq('status', 'pending_signature'),
      this.db
        .from('payments')
        .select(
          'amount,payment_date,rental_id,rentals(vehicle_id,vehicles(make,model,registration_number))',
        ),
      this.db.from('vehicle_maintenance').select('id').eq('status', 'in_progress'),
    ]);
  }
}
