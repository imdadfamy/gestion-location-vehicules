import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';

/** Notifications personnelles et données des alertes opérationnelles calculées en direct. */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private auth = inject(AuthService);
  private get db() {
    return this.auth.supabase();
  }

  mine(userId: string) {
    return this.db
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
  }

  markRead(ids: string[]) {
    return this.db
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', ids);
  }

  /** Contrats à signer, locations et paiements, maintenances, échéances et incidents ouverts. */
  alertSources() {
    return Promise.all([
      this.db.from('contracts').select('contract_number').eq('status', 'pending_signature'),
      this.db
        .from('rentals')
        .select(
          'id,status,return_date,rental_price,vehicles(registration_number),vehicle_inspections(inspection_type)',
        ),
      this.db.from('payments').select('rental_id,amount'),
      this.db
        .from('vehicle_maintenance')
        .select('id,next_maintenance_date,status,vehicles(registration_number)')
        .neq('status', 'completed'),
      this.db
        .from('vehicles')
        .select('registration_number,insurance_expiry_date,technical_inspection_expiry_date'),
      this.db.from('incidents').select('id').in('status', ['open', 'in_progress']),
    ]);
  }
}
