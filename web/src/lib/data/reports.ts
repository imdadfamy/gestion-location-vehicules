import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type Db = SupabaseClient<Database>;
type Car = { make: string | null; model: string | null; registration_number: string | null } | null;

export type Report = {
  stats: { label: string; value: string }[];
  revenueByVehicle: { name: string; amount: number }[];
  topVehicles: { name: string; count: number }[];
};

const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
const carName = (car: Car, fallback: string) =>
  car ? `${car.make || ''} ${car.model || ''} · ${car.registration_number || ''}`.trim() : fallback;
const money = (value: number) => `${value.toLocaleString('fr-FR').replace(/ /g, ' ')} FCFA`;

/** Jour local AAAA-MM-JJ : les bornes de période s'appliquent au jour entier. */
const localDay = (value: Date) => value.toLocaleDateString('en-CA');

/**
 * Synthèse sur une période (mêmes calculs que l'écran Angular), fondée sur les
 * encaissements réellement enregistrés.
 */
export async function buildReport(db: Db, from: string, to: string): Promise<{ data: Report | null; error: unknown }> {
  const [payments, rentals, incidents, maintenance] = await Promise.all([
    db.from('payments').select('amount,payment_date,rental_id,rentals(vehicles(make,model,registration_number))'),
    db.from('rentals').select('id,departure_date,client_id,vehicles(make,model,registration_number)'),
    db.from('incidents').select('cost,incident_date'),
    db.from('vehicle_maintenance').select('cost,maintenance_date'),
  ]);
  const error = payments.error ?? rentals.error ?? incidents.error ?? maintenance.error;
  if (error) return { data: null, error };

  // Une date seule (AAAA-MM-JJ) est déjà un jour ; un horodatage est ramené au jour local.
  const between = (date: string | null | undefined) => {
    if (!date) return false;
    const day = date.length <= 10 ? date : localDay(new Date(date));
    return (!from || day >= from) && (!to || day <= to);
  };
  const paid = (payments.data ?? []).filter((item) => between(item.payment_date));
  const rented = (rentals.data ?? []).filter((item) => between(item.departure_date));
  const incidentCount = (incidents.data ?? []).filter((item) => between(item.incident_date)).length;
  const repairs = (maintenance.data ?? []).filter((item) => between(item.maintenance_date));
  const revenue = paid.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const costs = repairs.reduce((sum, item) => sum + Number(item.cost || 0), 0);

  const byVehicle = new Map<string, number>();
  for (const item of paid) {
    const name = carName(one(one(item.rentals)?.vehicles) as Car, 'Location non liée');
    byVehicle.set(name, (byVehicle.get(name) ?? 0) + Number(item.amount || 0));
  }
  const top = new Map<string, number>();
  for (const item of rented) {
    const name = carName(one(item.vehicles) as Car, 'Véhicule');
    top.set(name, (top.get(name) ?? 0) + 1);
  }

  return {
    data: {
      stats: [
        { label: 'Revenus encaissés', value: money(revenue) },
        { label: 'Locations', value: String(rented.length) },
        { label: 'Clients actifs', value: String(new Set(rented.map((item) => item.client_id)).size) },
        { label: 'Incidents', value: String(incidentCount) },
        { label: 'Coûts maintenance', value: money(costs) },
      ],
      revenueByVehicle: [...byVehicle].sort((a, b) => b[1] - a[1]).map(([name, amount]) => ({ name, amount })),
      topVehicles: [...top].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
    },
    error: null,
  };
}

/** Export CSV (séparateur « ; », lisible par Excel en français). */
export function reportCsv(report: Report) {
  return ['Indicateur;Valeur', ...report.stats.map((stat) => `${stat.label};${stat.value}`)].join('\n');
}
