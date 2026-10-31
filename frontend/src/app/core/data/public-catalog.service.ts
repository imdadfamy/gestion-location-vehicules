import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { StorageService } from './storage.service';

/** Données visibles sans connexion : coordonnées de l'entreprise et catalogue. */
@Injectable({ providedIn: 'root' })
export class PublicCatalogService {
  private auth = inject(AuthService);
  private storage = inject(StorageService);
  private get db() {
    return this.auth.supabase();
  }

  companyContact() {
    return this.db.rpc('public_company_contact').maybeSingle();
  }

  /** Véhicules disponibles (sur la période si elle est fournie), avec les chemins de leurs photos. */
  availableVehicles(departure?: string, returnDate?: string) {
    return this.db.rpc('public_available_vehicles', {
      target_departure: departure,
      target_return: returnDate,
    });
  }

  /** Lien de 10 minutes vers une photo publique, ou null. */
  async photoUrl(path: string) {
    const signed = await this.storage.signedUrl('rental-documents', path, 600);
    return signed.data?.signedUrl ?? null;
  }
}
