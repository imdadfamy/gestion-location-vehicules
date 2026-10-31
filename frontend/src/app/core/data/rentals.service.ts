import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import type { Database, TablesUpdate } from '../database.types';

type Rpc = Database['public']['Functions'];
export type RentalWizardArgs = Rpc['create_rental_from_wizard']['Args'];
export type RentalFromReservationArgs = Rpc['create_rental_from_reservation']['Args'];

/** Locations, leur historique de statuts et les RPC du workflow. */
@Injectable({ providedIn: 'root' })
export class RentalsService {
  private auth = inject(AuthService);
  private get db() {
    return this.auth.supabase();
  }

  /** Recalcule les retards (statut « En retard ») côté serveur. */
  refreshOverdue() {
    return this.db.rpc('refresh_overdue_rentals');
  }

  list(status?: string) {
    let query = this.db
      .from('rentals')
      .select(
        '*,clients(first_name,last_name,phone),vehicles(registration_number,make,model),payments(amount)',
      )
      .order('departure_date', { ascending: false });
    if (status) query = query.eq('status', status);
    return query;
  }

  get(id: string) {
    return this.db
      .from('rentals')
      .select('*,clients(*),vehicles(registration_number,make,model)')
      .eq('id', id)
      .single();
  }

  statusHistory(rentalId: string) {
    return this.db
      .from('rental_status_history')
      .select('*')
      .eq('rental_id', rentalId)
      .order('created_at');
  }

  payments(rentalId: string) {
    return this.db
      .from('payments')
      .select('id,amount,payment_date,recorded_by,reference')
      .eq('rental_id', rentalId)
      .order('payment_date', { ascending: false });
  }

  createFromWizard(args: RentalWizardArgs) {
    return this.db.rpc('create_rental_from_wizard', args);
  }

  createFromReservation(args: RentalFromReservationArgs) {
    return this.db.rpc('create_rental_from_reservation', args);
  }

  update(id: string, values: TablesUpdate<'rentals'>) {
    return this.db.from('rentals').update(values).eq('id', id);
  }

  confirmPayment(rentalId: string) {
    return this.db.rpc('confirm_rental_payment', { target_rental_id: rentalId });
  }
}
