import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { StorageService } from './storage.service';
import type { TablesInsert } from '../database.types';

/**
 * Accès aux données depuis l'espace partenaire. La RLS limite le partenaire à ses
 * véhicules ; un trigger fige le statut, le prix client et l'approbation.
 */
@Injectable({ providedIn: 'root' })
export class PartnerPortalService {
  private auth = inject(AuthService);
  private storage = inject(StorageService);
  private get db() {
    return this.auth.supabase();
  }

  myPartner(profileId: string, columns = '*') {
    return this.db.from('partners').select(columns).eq('profile_id', profileId).maybeSingle<any>();
  }

  saveProfile(value: {
    company_name?: string;
    contact_name: string;
    phone: string;
    email?: string;
  }) {
    return this.db.rpc('ensure_partner_profile', {
      target_company_name: value.company_name || '',
      target_contact_name: value.contact_name,
      target_phone: value.phone,
      target_email: value.email || undefined,
    });
  }

  /** Locations de ses véhicules avec la part qui lui revient (calculée côté serveur). */
  earnings() {
    return this.db.rpc('partner_rental_earnings');
  }

  inspections() {
    return this.db
      .from('vehicle_inspections')
      .select('*,vehicles(registration_number,make,model)')
      .order('inspection_date', { ascending: false });
  }

  // ── Véhicules ──
  vehicles() {
    return this.db
      .from('vehicles')
      .select('*')
      .eq('owner_type', 'partner')
      .order('created_at', { ascending: false });
  }

  vehicleOptions() {
    return this.db
      .from('vehicles')
      .select('id,registration_number,make,model')
      .eq('owner_type', 'partner')
      .order('registration_number');
  }

  /** Soumission ou modification ; le trigger remet le véhicule en évaluation si besoin. */
  saveVehicle(id: string | undefined, values: TablesInsert<'vehicles'>) {
    return id
      ? this.db.from('vehicles').update(values).eq('id', id)
      : this.db.from('vehicles').insert(values);
  }

  /** Photos du véhicule avec un lien de 10 minutes. */
  async photos(vehicleId: string) {
    const docs = await this.db
      .from('vehicle_documents')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .eq('document_type', 'photo')
      .order('created_at', { ascending: false });
    if (docs.error) return { data: null, error: docs.error };
    const data = await Promise.all(
      (docs.data ?? []).map(async (doc) => {
        const signed = await this.storage.signedUrl('rental-documents', doc.storage_path, 600);
        return { ...doc, url: signed.data?.signedUrl ?? '' };
      }),
    );
    return { data, error: null };
  }

  // ── Maintenance ──
  maintenances() {
    return this.db
      .from('vehicle_maintenance')
      .select('*,vehicles(registration_number)')
      .order('maintenance_date', { ascending: false });
  }

  addMaintenance(values: TablesInsert<'vehicle_maintenance'>) {
    return this.db.from('vehicle_maintenance').insert(values);
  }

  completeMaintenance(id: string) {
    return this.db.from('vehicle_maintenance').update({ status: 'completed' }).eq('id', id);
  }
}
