import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import type { PriceTier } from '@/lib/pricing';

type Db = SupabaseClient<Database>;

/** `vehicle_price_tiers` : prix client (équipe). `vehicle_partner_price_tiers` : prix souhaité par le partenaire. */
export type TierTable = 'vehicle_price_tiers' | 'vehicle_partner_price_tiers';

export async function loadTiers(db: Db, table: TierTable, vehicleId: string): Promise<{ data: PriceTier[]; error: unknown }> {
  const { data, error } = await db.from(table).select('min_months,daily_price').eq('vehicle_id', vehicleId).order('min_months');
  return { data: (data ?? []).map((row) => ({ min_months: row.min_months, daily_price: Number(row.daily_price) })), error };
}

/** Remplace les paliers du véhicule par la liste donnée (ajouts, modifications et retraits). */
export async function saveTiers(db: Db, table: TierTable, vehicleId: string, tiers: PriceTier[]) {
  const kept = tiers.map((tier) => tier.min_months);
  const removal = db.from(table).delete().eq('vehicle_id', vehicleId);
  const removed = await (kept.length ? removal.not('min_months', 'in', `(${kept.join(',')})`) : removal);
  if (removed.error) return removed;
  if (!tiers.length) return removed;
  return db.from(table).upsert(
    tiers.map((tier) => ({ vehicle_id: vehicleId, min_months: tier.min_months, daily_price: tier.daily_price })),
    { onConflict: 'vehicle_id,min_months' },
  );
}
