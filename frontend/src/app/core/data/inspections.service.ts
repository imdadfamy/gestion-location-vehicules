import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { StorageService } from './storage.service';
import type { TablesInsert } from '../database.types';

/** États des lieux de départ et de retour, et leurs photos. */
@Injectable({ providedIn: 'root' })
export class InspectionsService {
  private auth = inject(AuthService);
  private storage = inject(StorageService);
  private get db() {
    return this.auth.supabase();
  }

  list() {
    return this.db
      .from('vehicle_inspections')
      .select(
        '*,rentals(id,departure_date,clients(first_name,last_name),vehicles(registration_number))',
      )
      .order('inspection_date', { ascending: false });
  }

  /** Locations qui peuvent recevoir une inspection (en attente, en cours ou en retard). */
  async openRentals() {
    await this.db.rpc('refresh_overdue_rentals');
    return this.db
      .from('rentals')
      .select('id,status,vehicle_id,clients(first_name,last_name),vehicles(registration_number)')
      .in('status', ['pending', 'active', 'overdue']);
  }

  create(values: TablesInsert<'vehicle_inspections'>) {
    return this.db.from('vehicle_inspections').insert(values).select().single();
  }

  /** Envoie la photo puis l'enregistre ; renvoie l'étape en échec et l'erreur. */
  async addPhoto(inspectionId: string, photoType: string, file: File) {
    const path = `inspections/${inspectionId}/${photoType}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const upload = await this.db.storage
      .from('inspection-photos')
      .upload(path, file, { upsert: false, contentType: file.type });
    if (upload.error) return { step: 'upload' as const, error: upload.error };
    const saved = await this.db
      .from('inspection_photos')
      .insert({ inspection_id: inspectionId, photo_type: photoType, storage_path: path });
    return saved.error ? { step: 'link' as const, error: saved.error } : null;
  }

  get(id: string) {
    return this.db
      .from('vehicle_inspections')
      .select('*,rentals(*,clients(*),vehicles(*))')
      .eq('id', id)
      .single();
  }

  photos(inspectionId: string) {
    return this.db
      .from('inspection_photos')
      .select('*')
      .eq('inspection_id', inspectionId)
      .order('created_at');
  }

  forRental(rentalId: string) {
    return this.db.from('vehicle_inspections').select('*').eq('rental_id', rentalId);
  }

  photoUrl(path: string, seconds = 60) {
    return this.storage.signedUrl('inspection-photos', path, seconds);
  }

  photoFile(path: string) {
    return this.storage.download('inspection-photos', path);
  }
}
