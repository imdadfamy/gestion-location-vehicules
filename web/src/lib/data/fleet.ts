import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type Db = SupabaseClient<Database>;

export type FleetStatus = 'unknown' | 'paid' | 'running';

/** Un véhicule de l'agence avec son prix d'achat et ce que ses locations ont rapporté. */
export type FleetRow = {
  vehicleId: string;
  label: string;
  registration: string;
  purchasePrice: number | null;
  purchaseDate: string | null;
  revenue: number;
  maintenance: number;
  /** Résultat depuis l'achat : encaissements de location moins coûts de maintenance. */
  net: number;
  /** Part du prix d'achat récupérée (0 à 1, au-delà si le véhicule a déjà rapporté plus que son prix). */
  recovered: number | null;
  remaining: number | null;
  /** Résultat moyen par jour sur les 90 derniers jours. */
  perDay: number;
  /** Date estimée de rentabilisation, d'après le rythme des 90 derniers jours (null : non estimable). */
  estimatedOn: string | null;
  status: FleetStatus;
};

const DAY = 86400000;

export async function loadFleet(db: Db): Promise<{ rows: FleetRow[]; error: unknown }> {
  const { data, error } = await db.rpc('fleet_profitability');
  if (error) return { rows: [], error };
  const today = Date.now();
  const rows = (data ?? []).map((row): FleetRow => {
    const price = row.purchase_price === null ? null : Number(row.purchase_price);
    const revenue = Number(row.revenue);
    const maintenance = Number(row.maintenance_cost);
    const net = revenue - maintenance;
    const perDay = (Number(row.revenue_90) - Number(row.maintenance_90)) / 90;
    const remaining = price === null ? null : Math.max(0, price - net);
    const status: FleetStatus = price === null ? 'unknown' : net >= price ? 'paid' : 'running';
    const estimatedOn = status === 'running' && remaining !== null && perDay > 0 ? new Date(today + Math.ceil(remaining / perDay) * DAY).toISOString().slice(0, 10) : null;
    return {
      vehicleId: row.vehicle_id,
      label: row.label,
      registration: row.registration_number,
      purchasePrice: price,
      purchaseDate: row.purchase_date,
      revenue,
      maintenance,
      net,
      recovered: price && price > 0 ? net / price : null,
      remaining,
      perDay,
      estimatedOn,
      status,
    };
  });
  return { rows, error: null };
}

export const savePurchase = (db: Db, vehicleId: string, price: number, date: string) =>
  db.from('vehicle_purchases').upsert({ vehicle_id: vehicleId, purchase_price: price, purchase_date: date || null }, { onConflict: 'vehicle_id' });

export const removePurchase = (db: Db, vehicleId: string) => db.from('vehicle_purchases').delete().eq('vehicle_id', vehicleId);
