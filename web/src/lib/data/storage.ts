import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type Db = SupabaseClient<Database>;
export type Bucket = 'rental-documents' | 'contract-assets' | 'inspection-photos' | 'marketing-receipts';

/** Chemin unique `<dossier>/<uuid>-<nom nettoyé>`. */
export function uniquePath(folder: string, file: File) {
  return `${folder}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

export function uploadFile(db: Db, bucket: Bucket, path: string, file: File) {
  return db.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
}

export function signedUrl(db: Db, bucket: Bucket, path: string, seconds = 60) {
  return db.storage.from(bucket).createSignedUrl(path, seconds);
}

export function removeFiles(db: Db, bucket: Bucket, paths: string[]) {
  return db.storage.from(bucket).remove(paths);
}
