import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { removeFiles, signedUrl, uniquePath, uploadFile } from './storage';

type Db = SupabaseClient<Database>;
type Rpc = Database['public']['Functions'];
export type ClientRecord = Database['public']['Tables']['clients']['Row'];
export type ClientDocument = Database['public']['Tables']['client_documents']['Row'];
export type DocumentKind = 'identity_document' | 'driving_license';

/**
 * Accès aux données depuis l'espace client. Le client ne lit que ses propres lignes
 * (RLS) ; les étapes sensibles passent par des RPC ou des Edge Functions dédiées.
 */

/** Message français renvoyé par une Edge Function (`{ error }`), sinon l'erreur d'origine. */
async function edgeError(result: { data: unknown; error: unknown }) {
  const data = result.data as { error?: string } | null;
  if (data?.error) return new Error(data.error);
  if (!result.error) return null;
  try {
    const body = await (result.error as { context?: Response }).context?.json?.();
    if (body?.error) return new Error(body.error);
  } catch {
    // Corps absent ou non JSON : on garde l'erreur d'origine.
  }
  return result.error;
}

// ── Dossier client ──
export function myRecord(db: Db, profileId: string) {
  return db.from('clients').select('*').eq('profile_id', profileId).maybeSingle();
}

export const RECORD_FIELDS = [
  'first_name',
  'last_name',
  'phone',
  'email',
  'id_document_type',
  'id_document_number',
  'residence',
  'address',
  'driving_license_number',
  'driving_license_issue_date',
  'driving_license_expiry_date',
  'emergency_contact_name',
  'emergency_contact_phone',
] as const;
export type RecordForm = { id?: string } & Record<(typeof RECORD_FIELDS)[number], string>;

/** Met à jour la fiche existante, ou la crée au premier enregistrement (RPC). */
export async function saveRecord(db: Db, profileId: string, form: RecordForm) {
  if (form.id) {
    const values = Object.fromEntries(RECORD_FIELDS.map((key) => [key, form[key].trim() === '' ? null : form[key].trim()]));
    return db
      .from('clients')
      .update({ ...values, first_name: form.first_name.trim(), last_name: form.last_name.trim(), profile_id: profileId })
      .eq('id', form.id)
      .select()
      .single();
  }
  const created = await db.rpc('ensure_client_profile', {
    target_first_name: form.first_name.trim(),
    target_last_name: form.last_name.trim(),
    target_phone: form.phone.trim(),
    target_email: (form.email.trim() || null) as string,
  });
  if (created.error) return { data: null, error: created.error };
  // La fiche créée est relue pour compléter les autres champs saisis.
  const record = await myRecord(db, profileId);
  if (record.error || !record.data) return { data: null, error: record.error };
  return saveRecord(db, profileId, { ...form, id: record.data.id });
}

export function myDocuments(db: Db, clientId: string) {
  return db.from('client_documents').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
}

export async function addDocument(db: Db, clientId: string, profileId: string, type: DocumentKind, file: File) {
  const path = uniquePath(`clients/${clientId}`, file);
  const upload = await uploadFile(db, 'rental-documents', path, file);
  if (upload.error) return { data: null, error: upload.error };
  return db
    .from('client_documents')
    .insert({
      client_id: clientId,
      document_type: type,
      document_name: file.name,
      storage_path: path,
      mime_type: file.type,
      file_size: file.size,
      uploaded_by: profileId,
    })
    .select()
    .single();
}

/** Retire le fichier puis sa ligne. */
export async function removeDocument(db: Db, document: Pick<ClientDocument, 'id' | 'storage_path'>) {
  const removed = await removeFiles(db, 'rental-documents', [document.storage_path]);
  if (removed.error) return removed.error;
  return (await db.from('client_documents').delete().eq('id', document.id)).error;
}

export function documentUrl(db: Db, path: string) {
  return signedUrl(db, 'rental-documents', path);
}

// ── Véhicules et réservations ──
export type PortalVehicle = Rpc['client_available_vehicles']['Returns'][number] & { photos: string[] };

export async function portalVehicles(db: Db, departure?: string, returnDate?: string) {
  const { data, error } = await db.rpc('client_available_vehicles', { target_departure: departure, target_return: returnDate });
  if (error) return { data: null, error, failedPhotos: 0 };
  let failedPhotos = 0;
  const rows: PortalVehicle[] = await Promise.all(
    (data ?? []).map(async (vehicle) => {
      const record = vehicle as typeof vehicle & { photo_storage_paths?: string[] | null; photo_storage_path?: string | null };
      const paths = record.photo_storage_paths ?? (record.photo_storage_path ? [record.photo_storage_path] : []);
      const urls = await Promise.all(
        paths.map(async (path) => {
          const url = (await signedUrl(db, 'rental-documents', path, 600)).data?.signedUrl ?? null;
          if (!url) failedPhotos++;
          return url;
        }),
      );
      return { ...vehicle, photos: urls.filter((url): url is string => !!url) };
    }),
  );
  return { data: rows, error: null, failedPhotos };
}

export function createReservation(db: Db, vehicleId: string, departure: string, returnDate: string, observation?: string) {
  return db.rpc('client_create_reservation', {
    target_vehicle_id: vehicleId,
    target_departure: departure,
    target_return: returnDate,
    target_observation: observation,
  });
}

export function reservationHistory(db: Db) {
  return db.rpc('client_reservation_history');
}

/** Annule sa propre réservation encore en attente (RPC : un UPDATE direct est filtré par la RLS). */
export function cancelReservation(db: Db, id: string) {
  return db.rpc('client_cancel_reservation', { target_reservation_id: id });
}

// ── Contrats ──
export function contractHistory(db: Db) {
  return db.rpc('client_contract_history');
}

/** Dossier envoyé par le Responsable et pas encore signé (réservation sans contrat). */
export function pendingDossier(db: Db) {
  return db.rpc('client_pending_contract_dossier');
}

/** Nombre de dossiers ou contrats qui attendent la signature du client (pastille « Contrats »). */
export async function contractAlerts(db: Db) {
  const [dossier, contracts] = await Promise.all([pendingDossier(db), contractHistory(db)]);
  const list = (contracts.data as { client_signed: boolean; status: string }[] | null) ?? [];
  return (dossier.data ? 1 : 0) + list.filter((contract) => !contract.client_signed && contract.status !== 'signed' && contract.status !== 'cancelled').length;
}

export function hasSigned(db: Db, contractId: string) {
  return db.from('contract_signatures').select('id').eq('contract_id', contractId).eq('signer_type', 'client').maybeSingle();
}

export function refreshContractContent(db: Db, contractId: string) {
  return db.rpc('client_refresh_contract_content', { target_contract_id: contractId });
}

export function reportCorrection(db: Db, contractId: string, message: string) {
  return db.rpc('report_contract_correction', { target_contract_id: contractId, correction_message: message });
}

/**
 * Signature du client. Sur un dossier de réservation, la RPC crée ensuite la location
 * et le contrat ; sur un contrat existant, la signature est ajoutée au contrat.
 */
export async function signAsClient(
  db: Db,
  target: { reservationId: string } | { contractId: string; signerName: string },
  profileId: string,
  image: Blob,
) {
  const path =
    'reservationId' in target
      ? `reservations/${target.reservationId}/signatures/client.png`
      : `contracts/${target.contractId}/signatures/client.png`;
  const upload = await db.storage.from('contract-assets').upload(path, image, { upsert: false, contentType: 'image/png' });
  if (upload.error) return upload.error;
  if ('reservationId' in target)
    return (await db.rpc('client_submit_reservation_contract', { target_reservation_id: target.reservationId, client_signature_storage_path: path }))
      .error;
  return (
    await db.from('contract_signatures').insert({
      contract_id: target.contractId,
      signer_type: 'client',
      signer_name: target.signerName,
      signature_storage_path: path,
      created_by: profileId,
      signer_user_agent: navigator.userAgent,
    })
  ).error;
}

/** Lien du PDF signé, délivré par l'Edge Function après contrôle d'appartenance. */
export async function contractPdfUrl(db: Db, contractId: string) {
  const result = await db.functions.invoke('client-contract-download', { body: { contract_id: contractId } });
  return { url: (result.data?.signedUrl as string | undefined) ?? null, error: await edgeError(result) };
}

// ── Inspections ──
export function inspectionHistory(db: Db) {
  return db.rpc('client_inspection_history');
}

export function inspectionEligibleRentals(db: Db) {
  return db.rpc('client_inspection_eligible_rentals');
}

export function createClientInspection(db: Db, args: Rpc['client_create_inspection']['Args']) {
  return db.rpc('client_create_inspection', args);
}

/** Envoi d'une photo via l'Edge Function (verrouillée 1 h après l'inspection) ; renvoie l'erreur. */
export async function uploadInspectionPhoto(db: Db, inspectionId: string, photoType: string, file: File) {
  const form = new FormData();
  form.append('inspection_id', inspectionId);
  form.append('photo_type', photoType);
  form.append('file', file, file.name);
  return edgeError(await db.functions.invoke('client-inspection-photo', { body: form }));
}

export type InspectionPhoto = { id: string; photo_type: string | null; storage_path: string; url?: string };

export async function inspectionPhotos(db: Db, inspectionId: string) {
  const result = await db.functions.invoke('client-inspection-photo', { body: { inspection_id: inspectionId } });
  return { photos: ((result.data?.photos as InspectionPhoto[] | undefined) ?? []) as InspectionPhoto[], error: await edgeError(result) };
}

export function inspectionPhotoUrl(db: Db, path: string) {
  return db.storage.from('inspection-photos').createSignedUrl(path, 60);
}
