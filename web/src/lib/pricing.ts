/**
 * Tarifs selon la durée : une liste de paliers « à partir de N jours (ou N mois), X FCFA par jour ». Chaque
 * palier se règle librement ; un mois = 30 jours. On applique le palier le plus élevé atteint, à tous les
 * jours de la location ; sans palier atteint, le prix de base du véhicule s'applique. Même règle que les
 * fonctions SQL `vehicle_client_daily_price` et `vehicle_partner_daily_price`.
 */
export type PriceTier = { min_days: number; daily_price: number };
export type TierUnit = 'days' | 'months';
/** Palier en cours de saisie (valeurs de champs). */
export type TierRow = { count: string; unit: TierUnit; price: string };

export const DAYS_PER_MONTH = 30;
export const MIN_TIER_DAYS = 2;
export const MAX_TIER_DAYS = 1095;

/** Nombre de jours facturés : toute journée commencée compte, au moins un jour. */
export const rentalDays = (departure: string | Date, returnDate: string | Date) =>
  Math.max(1, Math.ceil((new Date(returnDate).getTime() - new Date(departure).getTime()) / 86400000));

/** Lit les paliers renvoyés par les catalogues (JSON) ou la base. */
export function parseTiers(value: unknown): PriceTier[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({ min_days: Number((item as PriceTier).min_days), daily_price: Number((item as PriceTier).daily_price) }))
    .filter((tier) => Number.isFinite(tier.min_days) && Number.isFinite(tier.daily_price))
    .sort((a, b) => a.min_days - b.min_days);
}

/** Prix par jour applicable pour `days` jours, et le palier qui s'applique (null = prix de base). */
export function dailyPriceFor(base: number | string | null | undefined, tiers: PriceTier[] | null | undefined, days: number) {
  const reached = (tiers ?? []).filter((tier) => tier.min_days <= days).sort((a, b) => b.min_days - a.min_days)[0] ?? null;
  return { price: reached ? reached.daily_price : Number(base ?? 0), tier: reached };
}

/** « 2 mois » quand le seuil est un nombre entier de mois, sinon « 10 jours ». */
export function tierThreshold(minDays: number) {
  return minDays % DAYS_PER_MONTH === 0 ? { count: minDays / DAYS_PER_MONTH, unit: 'months' as const } : { count: minDays, unit: 'days' as const };
}
export const tierTitle = (minDays: number) => {
  const { count, unit } = tierThreshold(minDays);
  return `À partir de ${count} ${unit === 'months' ? 'mois' : 'jours'}`;
};
/** Texte français + variables pour `t()` (site public bilingue). */
export const tierTitleKey = (minDays: number) => {
  const { count, unit } = tierThreshold(minDays);
  return { key: unit === 'months' ? 'À partir de {n} mois' : 'À partir de {n} jours', vars: { n: count } };
};

export const rowsFromTiers = (tiers: PriceTier[]): TierRow[] =>
  tiers.map((tier) => {
    const { count, unit } = tierThreshold(tier.min_days);
    return { count: String(count), unit, price: String(tier.daily_price) };
  });

const rowDays = (row: TierRow) => Number(row.count) * (row.unit === 'months' ? DAYS_PER_MONTH : 1);

/** Paliers valides tirés des champs de saisie (les lignes vides sont ignorées). */
export function tiersFromRows(rows: TierRow[]): PriceTier[] {
  return rows
    .filter((row) => row.count.trim() !== '' && row.price.trim() !== '')
    .map((row) => ({ min_days: rowDays(row), daily_price: Number(row.price) }))
    .sort((a, b) => a.min_days - b.min_days);
}

/** Message d'erreur si les paliers saisis sont invalides, sinon chaîne vide. */
export function validateTierRows(rows: TierRow[]): string {
  const seen = new Set<number>();
  for (const row of rows) {
    if (row.count.trim() === '' && row.price.trim() === '') continue;
    const days = rowDays(row);
    const price = Number(row.price);
    if (!Number.isInteger(Number(row.count)) || !Number.isInteger(days) || days < MIN_TIER_DAYS || days > MAX_TIER_DAYS)
      return `Un palier doit commencer entre ${MIN_TIER_DAYS} jours et ${MAX_TIER_DAYS} jours (environ 36 mois).`;
    if (row.price.trim() === '' || !Number.isFinite(price) || price < 0) return 'Indiquez un prix par jour valide pour chaque palier.';
    if (seen.has(days)) return `Deux paliers commencent à ${tierTitle(days).replace('À partir de ', '')} : gardez-en un seul.`;
    seen.add(days);
  }
  return '';
}
