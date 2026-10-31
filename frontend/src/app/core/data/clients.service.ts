import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { StorageService } from './storage.service';
import type { TablesUpdate } from '../database.types';

/** Fiches clients et pièces justificatives (table client_documents). */
@Injectable({ providedIn: 'root' })
export class ClientsService {
  private auth = inject(AuthService);
  private storage = inject(StorageService);
  private get db() {
    return this.auth.supabase();
  }

  findByPhone(phone: string) {
    return this.db.from('clients').select('*').eq('phone', phone).order('last_name');
  }

  update(id: string, values: TablesUpdate<'clients'>) {
    return this.db.from('clients').update(values).eq('id', id);
  }

  documents(clientId: string) {
    return this.db
      .from('client_documents')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
  }

  /** Envoie la pièce dans Storage puis l'enregistre ; renvoie false si l'une des deux étapes échoue. */
  async uploadDocument(clientId: string, documentType: string, file: File) {
    const path = this.storage.uniquePath(`clients/${clientId}`, file);
    const upload = await this.storage.upload('rental-documents', path, file);
    if (upload.error) return false;
    const saved = await this.db.from('client_documents').insert({
      client_id: clientId,
      document_type: documentType,
      document_name: file.name,
      storage_path: path,
      mime_type: file.type,
      file_size: file.size,
    });
    return !saved.error;
  }
}
