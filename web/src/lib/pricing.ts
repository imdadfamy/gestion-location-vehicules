/**
 * Tarifs selon la durée : une liste de paliers « à partir de N mois, X FCFA par jour ». Un mois = 30 jours,
 * on applique le palier le plus élevé atteint, à tous les jours de la location ; sans palier atteint, le prix
 * de base du véhicule s'applique. Même règle que les fonctions SQL `vehicle_client_daily_price` et
 * `vehicle_partner_daily_price`.
 */
export type PriceTier = { min_months: number; daily_price: number };
/** Palier en cours de saisie (valeurs de champs). */
export type TierRow = { months: string; price: string };

export const DAYS_PER_MONTH = 30;
export const MAX_TIER_MONTHS = 36;

/** Nombre de jours facturés : toute journée commencée compte, au moins un jour. */
export const rentalDays = (departure: string | Date, returnDate: string | Date) =>
  Math.max(1, Math.ceil((new Date(returnDate).getTime() - new Date(departure).getTime()) / 86400000));

/** Lit les paliers renvoyés par les catalogues (JSON) ou la base. */
export function parseTiers(value: unknown): PriceTier[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({ min_months: Number((item as PriceTier).min_months), daily_price: Number((item as PriceTier).daily_price) }))
    .filter((tier) => Number.isFinite(tier.min_months) && Number.isFinite(tier.daily_price))
    .sort((a, b) => a.min_months - b.min_months);
}

/** Prix par jour applicable pour `days` jours, et le palier qui s'applique (null = prix de base). */
export function dailyPriceFor(base: number | string | null | undefined, tiers: PriceTier[] | null | undefined, days: number) {
  const reached = (tiers ?? []).filter((tier) => tier.min_months * DAYS_PER_MONTH <= days).sort((a, b) => b.min_months - a.min_months)[0] ?? null;
  return { price: reached ? reached.daily_price : Number(base ?? 0), tier: reached };
}

export const tierTitle = (months: number) => `À partir de ${months} mois`;

export const rowsFromTiers = (tiers: PriceTier[]): TierRow[] => tiers.map((tier) => ({ months: String(tier.min_months), price: String(tier.daily_price) }));

/** Paliers valides tirés des champs de saisie (les lignes vides sont ignorées). */
export function tiersFromRows(rows: TierRow[]): PriceTier[] {
  return rows
    .filter((row) => row.months.trim() !== '' && row.price.trim() !== '')
    .map((row) => ({ min_months: Number(row.months), daily_price: Number(row.price) }))
    .sort((a, b) => a.min_months - b.min_months);
}

/** Message d'erreur si les paliers saisis sont invalides, sinon chaîne vide. */
export function validateTierRows(rows: TierRow[]): string {
  const seen = new Set<number>();
  for (const row of rows) {
    if (row.months.trim() === '' && row.price.trim() === '') continue;
    const months = Number(row.months);
    const price = Number(row.price);
    if (!Number.isInteger(months) || months < 1 || months > MAX_TIER_MONTHS) return `Un palier doit commencer entre 1 et ${MAX_TIER_MONTHS} mois.`;
    if (row.price.trim() === '' || !Number.isFinite(price) || price < 0) return 'Indiquez un prix par jour valide pour chaque palier.';
    if (seen.has(months)) return `Deux paliers commencent à ${months} mois : gardez-en un seul.`;
    seen.add(months);
  }
  return '';
}
