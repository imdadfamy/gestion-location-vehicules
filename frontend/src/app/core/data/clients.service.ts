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

  /** Recherche sur prénom, nom, téléphone ou e-mail. */
  search(term = '') {
    const query = this.db.from('clients').select('*').order('last_name');
    // Les virgules et parenthèses structurent le filtre `or` de PostgREST : on les retire.
    const clean = term.trim().replace(/[,()]/g, ' ');
    if (!clean) return query;
    return query.or(
      `first_name.ilike.%${clean}%,last_name.ilike.%${clean}%,phone.ilike.%${clean}%,email.ilike.%${clean}%`,
    );
  }

  /** Tous les clients, pour les listes de choix des formulaires. */
  options() {
    return this.db.from('clients').select('id,first_name,last_name').order('last_name');
  }

  findByPhone(phone: string) {
    return this.db.from('clients').select('*').eq('phone', phone).order('last_name');
  }

  /** Crée ou met à jour la fiche et renvoie la ligne enregistrée. */
  save(client: any) {
    return client.id
      ? this.db.from('clients').update(client).eq('id', client.id).select().single()
      : this.db.from('clients').insert(client).select().single();
  }

  update(id: string, values: TablesUpdate<'clients'>) {
    return this.db.from('clients').update(values).eq('id', id);
  }

  rentals(clientId: string) {
    return this.db
      .from('rentals')
      .select('id,status,departure_date,return_date,vehicles(registration_number)')
      .eq('client_id', clientId)
      .order('departure_date', { ascending: false });
  }

  documents(clientId: string) {
    return this.db
      .from('client_documents')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
  }

  /** Envoie la pièce dans Storage puis l'enregistre ; renvoie l'erreur éventuelle. */
  async uploadDocument(clientId: string, documentType: string, file: File) {
    const path = this.storage.uniquePath(`clients/${clientId}`, file);
    const upload = await this.storage.upload('rental-documents', path, file);
    if (upload.error) return upload.error;
    const saved = await this.db.from('client_documents').insert({
      client_id: clientId,
      document_type: documentType,
      document_name: file.name,
      storage_path: path,
      mime_type: file.type,
      file_size: file.size,
    });
    return saved.error;
  }
}
