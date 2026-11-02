import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { signedUrl, uniquePath, uploadFile } from './storage';

type Db = SupabaseClient<Database>;
export type Client = Database['public']['Tables']['clients']['Row'];
export type ClientDocument = Database['public']['Tables']['client_documents']['Row'];

export { RENTAL_STATUSES } from './rentals';

/** Champs de la fiche client (les mêmes que l'écran Angular). */
export const CLIENT_FIELDS = [
  'first_name',
  'last_name',
  'phone',
  'email',
  'address',
  'id_document_number',
  'driving_license_number',
  'driving_license_expiry_date',
  'emergency_contact_name',
  'emergency_contact_phone',
  'acquisition_source',
  'acquisition_detail',
] as const;
export type ClientForm = { id?: string } & Record<(typeof CLIENT_FIELDS)[number], string>;

export const EMPTY_CLIENT = Object.fromEntries(CLIENT_FIELDS.map((key) => [key, ''])) as ClientForm;

export function toClientForm(client: Client): ClientForm {
  const form = { id: client.id } as ClientForm;
  for (const key of CLIENT_FIELDS) form[key] = client[key] ?? '';
  return form;
}

/** Recherche sur prénom, nom, téléphone ou e-mail. */
export function searchClients(db: Db, term = '') {
  const query = db.from('clients').select('*').order('last_name').order('first_name');
  // Les virgules et parenthèses structurent le filtre `or` de PostgREST : on les retire.
  const clean = term.trim().replace(/[,()]/g, ' ');
  if (!clean) return query;
  return query.or(`first_name.ilike.%${clean}%,last_name.ilike.%${clean}%,phone.ilike.%${clean}%,email.ilike.%${clean}%`);
}

/** Crée ou met à jour la fiche (champs vides → null) et renvoie la ligne enregistrée. */
export function saveClient(db: Db, form: ClientForm) {
  const row = Object.fromEntries(
    CLIENT_FIELDS.map((key) => [key, form[key].trim() === '' ? null : form[key].trim()]),
  ) as Record<(typeof CLIENT_FIELDS)[number], string | null>;
  const values = { ...row, first_name: form.first_name.trim(), last_name: form.last_name.trim() };
  return form.id
    ? db.from('clients').update(values).eq('id', form.id).select().single()
    : db.from('clients').insert(values).select().single();
}

export function clientRentals(db: Db, clientId: string) {
  return db
    .from('rentals')
    .select('id,status,departure_date,return_date,vehicles(registration_number)')
    .eq('client_id', clientId)
    .order('departure_date', { ascending: false });
}

export function clientDocuments(db: Db, clientId: string) {
  return db.from('client_documents').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
}

/** Envoie la pièce dans Storage puis l'enregistre ; renvoie l'erreur éventuelle. */
export async function uploadClientDocument(db: Db, clientId: string, documentType: string, file: File) {
  const path = uniquePath(`clients/${clientId}`, file);
  const upload = await uploadFile(db, 'rental-documents', path, file);
  if (upload.error) return upload.error;
  const saved = await db.from('client_documents').insert({
    client_id: clientId,
    document_type: documentType,
    document_name: file.name,
    storage_path: path,
    mime_type: file.type,
    file_size: file.size,
  });
  return saved.error;
}

export function clientDocumentLink(db: Db, document: ClientDocument) {
  return signedUrl(db, 'rental-documents', document.storage_path);
}

/**
 * Lecture d'une pièce d'identité : propose prénom, nom et numéro à partir du texte
 * reconnu (mêmes motifs que l'écran Angular). L'agent vérifie toujours avant d'enregistrer.
 */
export function extractIdentity(text: string) {
  const clean = text.replace(/\r/g, '\n');
  const pick = (patterns: RegExp[]) => patterns.map((p) => clean.match(p)?.[1]?.trim()).find(Boolean) || '';
  const last = pick([/\b(?:NOM|SURNAME)\s*[:\-]?\s*([^\n]+)/i]);
  const first = pick([/\b(?:PR[ÉE]NOM(?:S)?|GIVEN\s*NAMES?)\s*[:\-]?\s*([^\n]+)/i]);
  const id = pick([/\b(?:N[°O]|NUM[ÉE]RO|NO|ID)\s*(?:D['’ ]?IDENTIT[ÉE])?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\- ]{4,})/i]);
  return {
    first_name: first.replace(/[^\p{L} '\-]/gu, '').trim(),
    last_name: last.replace(/[^\p{L} '\-]/gu, '').trim(),
    id_document_number: id.replace(/\s+/g, ' ').trim(),
  };
}
