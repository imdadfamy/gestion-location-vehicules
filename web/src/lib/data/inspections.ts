import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type Db = SupabaseClient<Database>;
type InspectionRow = Database['public']['Tables']['vehicle_inspections']['Row'];
export type InspectionPhoto = Database['public']['Tables']['inspection_photos']['Row'] & { url?: string };

export type Inspection = InspectionRow & {
  rentals: {
    id: string;
    departure_date: string;
    clients: { first_name: string; last_name: string } | null;
    vehicles: { registration_number: string } | null;
  } | null;
};
export type InspectionDetail = InspectionRow & {
  rentals:
    | (Database['public']['Tables']['rentals']['Row'] & {
        clients: Database['public']['Tables']['clients']['Row'] | null;
        vehicles: Database['public']['Tables']['vehicles']['Row'] | null;
      })
    | null;
};

export const PHOTO_TYPES = [
  { key: 'front', label: 'Avant' },
  { key: 'rear', label: 'Arrière' },
  { key: 'left_side', label: 'Côté gauche' },
  { key: 'right_side', label: 'Côté droit' },
  { key: 'interior', label: 'Intérieur' },
] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number]['key'];
export const FUEL_LEVELS: Record<string, string> = { '1/4': '¼', '1/2': '½', '3/4': '¾', Plein: 'Plein' };

export const inspectionLabel = (type: string) => (type === 'departure' ? 'Départ' : 'Retour');
export const photoLabel = (type: string | null) => PHOTO_TYPES.find((item) => item.key === type)?.label ?? 'Photo complémentaire';
export const damagesText = (inspection: Pick<InspectionRow, 'damages'> | null | undefined) =>
  Array.isArray(inspection?.damages) && inspection.damages.length ? inspection.damages.join('; ') : 'Aucun';

export function listInspections(db: Db) {
  return db
    .from('vehicle_inspections')
    .select('*,rentals(id,departure_date,clients(first_name,last_name),vehicles(registration_number))')
    .order('inspection_date', { ascending: false })
    .returns<Inspection[]>();
}

export type OpenRental = {
  id: string;
  status: string;
  vehicle_id: string;
  clients: { first_name: string; last_name: string } | null;
  vehicles: { registration_number: string } | null;
};

/** Locations qui peuvent recevoir une inspection (en attente, en cours ou en retard). */
export async function openRentals(db: Db) {
  await db.rpc('refresh_overdue_rentals');
  return db
    .from('rentals')
    .select('id,status,vehicle_id,clients(first_name,last_name),vehicles(registration_number)')
    .in('status', ['pending', 'active', 'overdue'])
    .returns<OpenRental[]>();
}

export type InspectionForm = {
  rental_id: string;
  vehicle_id: string;
  inspection_type: 'departure' | 'return';
  inspection_date: string;
  mileage: string;
  fuel_level: string;
  damages: string;
  observations: string;
};

/**
 * Crée l'inspection puis envoie ses photos. Une inspection de retour peut clôturer
 * la location (côté base) si plus rien ne bloque.
 */
export async function createInspection(db: Db, form: InspectionForm, photos: Partial<Record<PhotoType, File>>) {
  const created = await db
    .from('vehicle_inspections')
    .insert({
      rental_id: form.rental_id,
      vehicle_id: form.vehicle_id,
      inspection_type: form.inspection_type,
      inspection_date: new Date(form.inspection_date).toISOString(),
      mileage: Number(form.mileage),
      fuel_level: form.fuel_level || null,
      observations: form.observations.trim() || null,
      damages: form.damages
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    })
    .select()
    .single();
  if (created.error) return { data: null, error: created.error, photoError: null };
  for (const [type, file] of Object.entries(photos) as [PhotoType, File][]) {
    const path = `inspections/${created.data.id}/${type}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const upload = await db.storage.from('inspection-photos').upload(path, file, { upsert: false, contentType: file.type });
    if (upload.error) return { data: created.data, error: null, photoError: { type, error: upload.error } };
    const linked = await db.from('inspection_photos').insert({ inspection_id: created.data.id, photo_type: type, storage_path: path });
    if (linked.error) return { data: created.data, error: null, photoError: { type, error: linked.error } };
  }
  return { data: created.data, error: null, photoError: null };
}

/** Fiche complète avec les photos (liens signés de 5 minutes pour l'aperçu). */
export async function inspectionDetail(db: Db, id: string) {
  const inspection = await db
    .from('vehicle_inspections')
    .select('*,rentals(*,clients(*),vehicles(*))')
    .eq('id', id)
    .returns<InspectionDetail[]>()
    .single();
  if (inspection.error) return { data: null, error: inspection.error };
  const photos = await db.from('inspection_photos').select('*').eq('inspection_id', id).order('created_at');
  if (photos.error) return { data: null, error: photos.error };
  const withUrls: InspectionPhoto[] = await Promise.all(
    (photos.data ?? []).map(async (photo) => ({
      ...photo,
      url: (await db.storage.from('inspection-photos').createSignedUrl(photo.storage_path, 300)).data?.signedUrl,
    })),
  );
  return { data: { inspection: inspection.data, photos: withUrls }, error: null };
}

export function rentalInspections(db: Db, rentalId: string) {
  return db.from('vehicle_inspections').select('*').eq('rental_id', rentalId);
}

export function inspectionPhotoUrl(db: Db, path: string) {
  return db.storage.from('inspection-photos').createSignedUrl(path, 60);
}
