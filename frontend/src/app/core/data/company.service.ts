import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { StorageService } from './storage.service';

/** Paramètres de l'entreprise (ligne unique de company_settings). */
@Injectable({ providedIn: 'root' })
export class CompanyService {
  private auth = inject(AuthService);
  private storage = inject(StorageService);
  private get db() {
    return this.auth.supabase();
  }

  get(columns = '*') {
    return this.db.from('company_settings').select(columns).limit(1).maybeSingle<any>();
  }

  save(settings: any) {
    return settings.id
      ? this.db.from('company_settings').update(settings).eq('id', settings.id).select().single()
      : this.db.from('company_settings').insert(settings).select().single();
  }

  /** Lien temporaire vers le logo privé, ou null s'il n'y en a pas. */
  async logoUrl(path: string | null | undefined, seconds = 300) {
    if (!path) return null;
    const signed = await this.storage.signedUrl('rental-documents', path, seconds);
    return signed.data?.signedUrl ?? null;
  }
}
