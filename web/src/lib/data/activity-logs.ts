import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type Db = SupabaseClient<Database>;
export type LogEntry = Database['public']['Tables']['activity_logs']['Row'];
export type Values = Record<string, unknown>;

export const PAGE_SIZE = 200;

export const LOG_MODULES: Record<string, string> = {
  profiles: 'Utilisateurs',
  clients: 'Clients',
  vehicles: 'Véhicules',
  rentals: 'Locations',
  contracts: 'Contrats',
  contract_templates: 'Modèles',
  contract_template_versions: 'Versions',
  contract_signatures: 'Signatures',
  payments: 'Paiements',
  deposits: 'Cautions',
  vehicle_inspections: 'Inspections',
  vehicle_maintenance: 'Maintenance',
  incidents: 'Incidents',
};

export function activityPage(db: Db, from: number) {
  return db
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
}

export const valuesOf = (entry: LogEntry) => ((entry.new_values ?? entry.old_values ?? {}) as Values);

/** Noms des clients et véhicules cités par les entrées (affichage lisible du journal). */
export async function resolveReferences(db: Db, entries: LogEntry[], known: { clients: Record<string, string>; vehicles: Record<string, string> }) {
  const clientIds = new Set<string>();
  const vehicleIds = new Set<string>();
  for (const entry of entries) {
    const values = valuesOf(entry);
    if (typeof values.client_id === 'string' && !known.clients[values.client_id]) clientIds.add(values.client_id);
    if (typeof values.vehicle_id === 'string' && !known.vehicles[values.vehicle_id]) vehicleIds.add(values.vehicle_id);
  }
  const [clients, vehicles] = await Promise.all([
    clientIds.size ? db.from('clients').select('id,first_name,last_name').in('id', [...clientIds]) : Promise.resolve({ data: [] }),
    vehicleIds.size ? db.from('vehicles').select('id,registration_number,make,model').in('id', [...vehicleIds]) : Promise.resolve({ data: [] }),
  ]);
  return {
    clients: {
      ...known.clients,
      ...Object.fromEntries((clients.data ?? []).map((row) => [row.id, `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'Client'])),
    },
    vehicles: {
      ...known.vehicles,
      ...Object.fromEntries(
        (vehicles.data ?? []).map((row) => [row.id, row.registration_number || `${row.make ?? ''} ${row.model ?? ''}`.trim() || 'Véhicule']),
      ),
    },
  };
}

const STATUS_LABELS: Record<string, Record<string, string>> = {
  rentals: { pending: 'En attente', active: 'En cours', overdue: 'En retard', completed: 'Terminée' },
  vehicles: { available: 'Disponible', on_rental: 'En location', maintenance: 'Maintenance', unavailable: 'Indisponible' },
  vehicle_maintenance: { planned: 'Planifiée', in_progress: 'En cours', completed: 'Terminée', cancelled: 'Annulée' },
  incidents: { open: 'Ouvert', in_progress: 'En cours', resolved: 'Résolu', closed: 'Clôturé' },
};
const FIELD_LABELS: Record<string, string> = {
  status: 'Statut',
  rental_price: 'Prix',
  deposit_amount: 'Caution',
  mileage: 'Kilométrage',
  is_active: 'Compte',
  insurance_expiry_date: 'Expiration assurance',
  technical_inspection_expiry_date: 'Contrôle technique',
  returned_amount: 'Montant restitué',
  retained_amount: 'Montant retenu',
};
const MONEY = ['rental_price', 'deposit_amount', 'returned_amount', 'retained_amount'];
export const logMoney = (value: unknown) => `${Number(value ?? 0).toLocaleString('fr-FR')} FCFA`;

/** Champs clés modifiés (au plus 4), avec l'ancienne et la nouvelle valeur. */
export function changesOf(entry: LogEntry) {
  if (entry.action !== 'UPDATE') return [];
  const before = (entry.old_values ?? {}) as Values;
  const after = (entry.new_values ?? {}) as Values;
  const format = (key: string, value: unknown) => {
    if (value === null || value === undefined) return '—';
    if (key === 'status') return STATUS_LABELS[entry.entity_type ?? '']?.[String(value)] ?? String(value);
    if (MONEY.includes(key)) return logMoney(value);
    if (key === 'is_active') return value ? 'Actif' : 'Inactif';
    return String(value);
  };
  const out: string[] = [];
  for (const key of Object.keys(FIELD_LABELS)) {
    if (!(key in after) || JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
    // « Compte » pour un utilisateur, « État » pour le reste (modèle de contrat…).
    const label = key === 'is_active' && entry.entity_type !== 'profiles' ? 'État' : FIELD_LABELS[key];
    out.push(`${label} : ${format(key, before[key])} → ${format(key, after[key])}`);
  }
  return out.slice(0, 4);
}

/** Détail non sensible : dates et numéro de contrat seulement (aucun document ni JSON). */
export function detailOf(entry: LogEntry) {
  const values = valuesOf(entry);
  const info: string[] = [];
  if (values.payment_date) info.push(`Enregistré le ${new Date(String(values.payment_date)).toLocaleDateString('fr-FR')}`);
  if (values.departure_date) info.push(`Départ : ${new Date(String(values.departure_date)).toLocaleString('fr-FR')}`);
  if (values.return_date) info.push(`Retour : ${new Date(String(values.return_date)).toLocaleString('fr-FR')}`);
  if (values.contract_number) info.push(`N° contrat : ${values.contract_number}`);
  return info.length ? info.join(' · ') : 'Aucun contenu sensible, document, signature ou JSON n’est affiché dans le journal.';
}
