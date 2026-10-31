import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { StorageService } from './storage.service';
import type { TablesUpdate } from '../database.types';

/** Programme partenaire, côté personnel : apporteurs et véhicules qu'ils soumettent. */
@Injectable({ providedIn: 'root' })
export class PartnersService {
  private auth = inject(AuthService);
  private storage = inject(StorageService);
  private get db() {
    return this.auth.supabase();
  }

  vehicles() {
    return this.db
      .from('vehicles')
      .select('*,partners(id,company_name,contact_name)')
      .eq('owner_type', 'partner')
      .order('submitted_at', { ascending: false });
  }

  partners() {
    return this.db
      .from('partners')
      .select('*,profiles!partners_profile_id_fkey(is_active)')
      .order('created_at', { ascending: false });
  }

  /** Périodes de location des véhicules partenaires (calcul des commissions). */
  rentalsOf(vehicleIds: string[]) {
    return this.db
      .from('rentals')
      .select('vehicle_id,departure_date,return_date,status')
      .in('vehicle_id', vehicleIds);
  }

  /** Photos des véhicules à évaluer, groupées par véhicule, avec un lien de 10 minutes. */
  async photosToReview(vehicleIds: string[]) {
    const docs = await this.db
      .from('vehicle_documents')
      .select('*')
      .in('vehicle_id', vehicleIds)
      .eq('document_type', 'photo');
    const byVehicle: Record<string, any[]> = {};
    for (const doc of docs.data ?? []) {
      const signed = await this.storage.signedUrl('rental-documents', doc.storage_path, 600);
      (byVehicle[doc.vehicle_id] ??= []).push({ ...doc, url: signed.data?.signedUrl ?? '' });
    }
    return byVehicle;
  }

  /** Décision, prix ou statut d'un véhicule partenaire. */
  updateVehicle(vehicleId: string, values: TablesUpdate<'vehicles'>) {
    return this.db.from('vehicles').update(values).eq('id', vehicleId);
  }

  updatePartner(partnerId: string, values: TablesUpdate<'partners'>) {
    return this.db.from('partners').update(values).eq('id', partnerId);
  }
}
