import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';

/** Parc automobile et documents des véhicules. */
@Injectable({ providedIn: 'root' })
export class VehiclesService {
  private auth = inject(AuthService);
  private get db() {
    return this.auth.supabase();
  }

  /** Véhicules disponibles, avec les tarifs utilisés pour pré-remplir une location. */
  listAvailable() {
    return this.db
      .from('vehicles')
      .select('id,registration_number,make,model,rental_price,deposit_amount')
      .eq('status', 'available')
      .order('registration_number');
  }
}
