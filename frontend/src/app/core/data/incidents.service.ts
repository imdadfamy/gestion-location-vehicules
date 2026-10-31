import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { blankToNull } from './form-values';
import { StorageService } from './storage.service';

/** Incidents (pannes, accidents, dommages…) et leurs justificatifs. */
@Injectable({ providedIn: 'root' })
export class IncidentsService {
  private auth = inject(AuthService);
  private storage = inject(StorageService);
  private get db() {
    return this.auth.supabase();
  }

  list() {
    return this.db
      .from('incidents')
      .select('*,vehicles(registration_number),clients(first_name,last_name)')
      .order('incident_date', { ascending: false });
  }

  /** Locations proposées dans le formulaire d'incident. */
  rentalOptions() {
    return this.db
      .from('rentals')
      .select('id,vehicle_id,client_id,vehicles(registration_number),clients(first_name,last_name)')
      .order('created_at', { ascending: false });
  }

  /** Crée ou met à jour ; les relations jointes (`vehicles`, `clients`) ne sont pas envoyées. */
  save(incident: any) {
    const { vehicles, clients, ...rest } = incident;
    const values = blankToNull(rest);
    return values.id
      ? this.db.from('incidents').update(values).eq('id', values.id).select().single()
      : this.db.from('incidents').insert(values).select().single();
  }

  /** Envoie le justificatif puis le référence ; renvoie l'erreur éventuelle. */
  async attachDocument(incidentId: string, file: File) {
    const path = this.storage.uniquePath(`incidents/${incidentId}`, file);
    const upload = await this.storage.upload('rental-documents', path, file);
    if (upload.error) return { step: 'upload' as const, error: upload.error };
    const saved = await this.db.from('incident_documents').insert({
      incident_id: incidentId,
      document_name: file.name,
      storage_path: path,
      mime_type: file.type,
    });
    return saved.error ? { step: 'link' as const, error: saved.error } : null;
  }
}
