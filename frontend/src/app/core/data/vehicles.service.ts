import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { StorageService } from './storage.service';

/** Parc automobile et documents des véhicules. */
@Injectable({ providedIn: 'root' })
export class VehiclesService {
  private auth = inject(AuthService);
  private storage = inject(StorageService);
  private get db() {
    return this.auth.supabase();
  }

  /** Recherche sur immatriculation, marque ou modèle. */
  search(term = '') {
    const query = this.db.from('vehicles').select('*').order('created_at', { ascending: false });
    // Les virgules et parenthèses structurent le filtre `or` de PostgREST : on les retire.
    const clean = term.trim().replace(/[,()]/g, ' ');
    if (!clean) return query;
    return query.or(
      `registration_number.ilike.%${clean}%,make.ilike.%${clean}%,model.ilike.%${clean}%`,
    );
  }

  /** Véhicules disponibles, avec les tarifs utilisés pour pré-remplir une location. */
  listAvailable() {
    return this.db
      .from('vehicles')
      .select('id,registration_number,make,model,rental_price,deposit_amount')
      .eq('status', 'available')
      .order('registration_number');
  }

  save(vehicle: any) {
    return vehicle.id
      ? this.db.from('vehicles').update(vehicle).eq('id', vehicle.id).select().single()
      : this.db.from('vehicles').insert(vehicle).select().single();
  }

  /**
   * Supprime le véhicule puis ses fichiers. `filesCleaned` vaut false si la base a
   * accepté la suppression mais que certains fichiers sont restés dans Storage.
   */
  async remove(vehicleId: string) {
    const files = await this.db
      .from('vehicle_documents')
      .select('storage_path')
      .eq('vehicle_id', vehicleId);
    const deleted = await this.db.from('vehicles').delete().eq('id', vehicleId);
    if (deleted.error) return { error: deleted.error, filesCleaned: true };
    const paths = (files.data ?? []).map((d) => d.storage_path);
    const cleanup = paths.length ? await this.storage.remove('rental-documents', paths) : null;
    return { error: null, filesCleaned: !cleanup?.error };
  }

  documents(vehicleId: string) {
    return this.db
      .from('vehicle_documents')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false });
  }

  /** Envoie un fichier puis l'enregistre ; renvoie l'erreur éventuelle. */
  async uploadDocument(vehicleId: string, documentType: 'document' | 'photo', file: File) {
    const path = this.storage.uniquePath(`vehicles/${vehicleId}`, file);
    const upload = await this.storage.upload('rental-documents', path, file);
    if (upload.error) return upload.error;
    const saved = await this.db.from('vehicle_documents').insert({
      vehicle_id: vehicleId,
      document_type: documentType,
      document_name: file.name,
      storage_path: path,
      mime_type: file.type,
      file_size: file.size,
    });
    return saved.error;
  }
}
