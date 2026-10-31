import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';

/** Réservations et leur workflow (validation, envoi au client, finalisation). */
@Injectable({ providedIn: 'root' })
export class ReservationsService {
  private auth = inject(AuthService);
  private get db() {
    return this.auth.supabase();
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
}
