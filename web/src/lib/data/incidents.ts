import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { toLocalInput } from './reservations';
import { signedUrl, uniquePath, uploadFile } from './storage';

type Db = SupabaseClient<Database>;
type Tone = 'success' | 'info' | 'warning' | 'danger' | 'muted';
export type Incident = Database['public']['Tables']['incidents']['Row'] & {
  vehicles: { registration_number: string } | null;
  clients: { first_name: string; last_name: string } | null;
};
export type IncidentDocument = Database['public']['Tables']['incident_documents']['Row'];

export const INCIDENT_TYPES: Record<string, string> = {
  breakdown: 'Panne',
  accident: 'Accident',
  damage: 'Dommage',
  infraction: 'Infraction',
  delay: 'Retard',
  other: 'Autre',
};
/** Un incident ouvert ou en cours bloque la clôture de la location liée. */
export const INCIDENT_STATUSES: Record<string, { label: string; tone: Tone }> = {
  open: { label: 'Ouvert', tone: 'danger' },
  in_progress: { label: 'En cours', tone: 'warning' },
  resolved: { label: 'Résolu', tone: 'success' },
  closed: { label: 'Clôturé', tone: 'muted' },
};

export type IncidentForm = {
  id?: string;
  incident_type: string;
  incident_date: string;
  status: string;
  vehicle_id: string;
  rental_id: string;
  client_id: string;
  cost: string;
  description: string;
};

export const emptyIncident = (vehicleId = '', rentalId = ''): IncidentForm => ({
  incident_type: 'breakdown',
  incident_date: toLocalInput(new Date().toISOString()),
  status: 'open',
  vehicle_id: vehicleId,
  rental_id: rentalId,
  client_id: '',
  cost: '0',
  description: '',
});

export const toIncidentForm = (item: Incident): IncidentForm => ({
  id: item.id,
  incident_type: item.incident_type,
  incident_date: toLocalInput(item.incident_date),
  status: item.status,
  vehicle_id: item.vehicle_id ?? '',
  rental_id: item.rental_id ?? '',
  client_id: item.client_id ?? '',
  cost: String(item.cost ?? 0),
  description: item.description,
});

export function listIncidents(db: Db) {
  return db
    .from('incidents')
    .select('*,vehicles(registration_number),clients(first_name,last_name)')
    .order('incident_date', { ascending: false })
    .returns<Incident[]>();
}

export type RentalOption = {
  id: string;
  vehicle_id: string;
  client_id: string;
  vehicles: { registration_number: string } | null;
  clients: { first_name: string; last_name: string } | null;
};

/** Véhicules, locations et clients proposés dans le formulaire. */
export async function incidentOptions(db: Db) {
  const [vehicles, rentals, clients] = await Promise.all([
    db.from('vehicles').select('id,registration_number,make,model').order('registration_number'),
    db
      .from('rentals')
      .select('id,vehicle_id,client_id,vehicles(registration_number),clients(first_name,last_name)')
      .order('created_at', { ascending: false })
      .returns<RentalOption[]>(),
    db.from('clients').select('id,first_name,last_name').order('last_name'),
  ]);
  return {
    vehicles: vehicles.data ?? [],
    rentals: rentals.data ?? [],
    clients: clients.data ?? [],
    error: vehicles.error ?? rentals.error ?? clients.error,
  };
}

/** Crée ou met à jour l'incident (champs vides → null), puis envoie ses justificatifs. */
export async function saveIncident(db: Db, form: IncidentForm, files: File[]) {
  const values = {
    incident_type: form.incident_type,
    incident_date: new Date(form.incident_date).toISOString(),
    status: form.status,
    vehicle_id: form.vehicle_id || null,
    rental_id: form.rental_id || null,
    client_id: form.client_id || null,
    cost: Number(form.cost || 0),
    description: form.description.trim(),
  };
  const saved = form.id
    ? await db.from('incidents').update(values).eq('id', form.id).select().single()
    : await db.from('incidents').insert(values).select().single();
  if (saved.error) return { error: saved.error, documentError: null };
  for (const file of files) {
    const path = uniquePath(`incidents/${saved.data.id}`, file);
    const upload = await uploadFile(db, 'rental-documents', path, file);
    if (upload.error) return { error: null, documentError: upload.error };
    const linked = await db
      .from('incident_documents')
      .insert({ incident_id: saved.data.id, document_name: file.name, storage_path: path, mime_type: file.type });
    if (linked.error) return { error: null, documentError: linked.error };
  }
  return { error: null, documentError: null };
}

export function incidentDocuments(db: Db, incidentId: string) {
  return db.from('incident_documents').select('*').eq('incident_id', incidentId).order('created_at');
}

export function incidentDocumentLink(db: Db, document: IncidentDocument) {
  return signedUrl(db, 'rental-documents', document.storage_path);
}
