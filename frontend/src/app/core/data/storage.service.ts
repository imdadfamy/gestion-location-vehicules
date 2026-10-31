import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';

export type Bucket = 'rental-documents' | 'contract-assets' | 'inspection-photos';

/** Fichiers Supabase Storage : chemins, envois et liens signés. */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private auth = inject(AuthService);

  /** Chemin unique `<dossier>/<uuid>-<nom nettoyé>`. */
  uniquePath(folder: string, file: File) {
    return `${folder}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  }

  upload(bucket: Bucket, path: string, file: File) {
    return this.auth
      .supabase()
      .storage.from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false });
  }

  signedUrl(bucket: Bucket, path: string, seconds = 60) {
    return this.auth.supabase().storage.from(bucket).createSignedUrl(path, seconds);
  }

  remove(bucket: Bucket, paths: string[]) {
    return this.auth.supabase().storage.from(bucket).remove(paths);
  }
}
