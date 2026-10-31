import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { blankToNull } from './form-values';
import { StorageService } from './storage.service';

/** Maintenances des véhicules et leurs factures. */
@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private auth = inject(AuthService);
  private storage = inject(StorageService);
  private get db() {
    return this.auth.supabase();
  }

  list() {
    return this.db
      .from('vehicle_maintenance')
      .select('*,vehicles(registration_number,make,model)')
      .order('maintenance_date', { ascending: false });
  }

  /** Crée ou met à jour ; les relations jointes (`vehicles`) ne sont pas envoyées. */
  save(maintenance: any) {
    const { vehicles, ...rest } = maintenance;
    const values = blankToNull(rest);
    return values.id
      ? this.db.from('vehicle_maintenance').update(values).eq('id', values.id).select().single()
      : this.db.from('vehicle_maintenance').insert(values).select().single();
  }

  /** Envoie la facture puis la rattache à la maintenance ; renvoie l'erreur éventuelle. */
  async attachInvoice(maintenanceId: string, file: File) {
    const path = this.storage.uniquePath(`maintenance/${maintenanceId}`, file);
    const upload = await this.storage.upload('rental-documents', path, file);
    if (upload.error) return { step: 'upload' as const, error: upload.error };
    const updated = await this.db
      .from('vehicle_maintenance')
      .update({ invoice_storage_path: path })
      .eq('id', maintenanceId);
    return updated.error ? { step: 'link' as const, error: updated.error } : null;
  }
}
