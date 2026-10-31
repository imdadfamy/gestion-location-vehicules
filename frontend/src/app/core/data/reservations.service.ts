import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import type { TablesInsert } from '../database.types';

/** Réservations et leur workflow (validation, envoi au client, finalisation). */
@Injectable({ providedIn: 'root' })
export class ReservationsService {
  private auth = inject(AuthService);
  private get db() {
    return this.auth.supabase();
  }

  list() {
    return this.db
      .from('reservations')
      .select('*,vehicles(registration_number,make,model)')
      .order('planned_departure_date', { ascending: false });
  }

  /** Réservation encore ouverte (en attente ou validée), sinon `data` vaut null. */
  getOpen(id: string) {
    return this.db
      .from('reservations')
      .select('*')
      .eq('id', id)
      .in('status', ['pending', 'validated'])
      .maybeSingle();
  }

  save(id: string | undefined, values: TablesInsert<'reservations'>) {
    return id
      ? this.db.from('reservations').update(values).eq('id', id)
      : this.db.from('reservations').insert(values);
  }

  validate(id: string) {
    return this.db.rpc('validate_reservation', { target_reservation_id: id });
  }

  cancel(id: string, reason: string) {
    return this.db.rpc('cancel_reservation', { target_reservation_id: id, reason });
  }

  /** Réservation faite en ligne : le contrat part au client qui l'a créée. */
  sendToOwner(id: string) {
    return this.db.rpc('send_reservation_to_client', { target_reservation_id: id });
  }

  /** Réservation saisie au comptoir : le contrat part au compte client choisi. */
  sendToClient(id: string, clientProfileId: string) {
    return this.db.rpc('send_reservation_to_selected_client', {
      target_reservation_id: id,
      target_client_profile_id: clientProfileId,
    });
  }
}
