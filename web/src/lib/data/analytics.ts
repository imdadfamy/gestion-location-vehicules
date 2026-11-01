import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

/**
 * Analytique : lit le catalogue de mesures et appelle `analytics_metric` (agrégation dans la base).
 * Les mesures dérivées (résultat net, taux…) se recalculent ici à partir de mesures additives,
 * jamais en sommant des lignes. Voir docs/analytics-fima-auto.md.
 */
type Db = SupabaseClient<Database>;

export type MetricDef = {
  id: string;
  label: string;
  description: string;
  unit: 'money' | 'count' | 'days' | 'percent' | 'hours';
  additivity: 'additive' | 'semi_additive' | 'non_additive';
  source: string | null;
  dimensions: string[];
  filters: string[];
  formula: string | null;
  depends_on: string[];
  exclusions: string | null;
  permission: string | null;
  sort: number;
};

export type Catalog = Map<string, MetricDef>;

export async function loadCatalog(db: Db) {
  const { data, error } = await db.from('analytics_metrics').select('id,label,description,unit,additivity,source,dimensions,filters,formula,depends_on,exclusions,permission,sort').order('sort');
  return { catalog: new Map((data ?? []).map((row) => [row.id, row as MetricDef])) as Catalog, error };
}

// ── Périodes (jours à l'heure de l'agence) ──
const TIME_ZONE = 'Africa/Porto-Novo';
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
export const todayKey = () => dayFormat.format(new Date());

const parse = (key: string) => new Date(`${key}T12:00:00Z`);
const format = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (key: string, days: number) => format(new Date(parse(key).getTime() + days * 86400000));
const daysBetween = (from: string, to: string) => Math.round((parse(to).getTime() - parse(from).getTime()) / 86400000) + 1;
const monthStart = (key: string, offset = 0) => {
  const date = parse(key);
  return format(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1, 12)));
};
const monthEnd = (key: string, offset = 0) => addDays(monthStart(key, offset + 1), -1);
const quarterStart = (key: string, offset = 0) => {
  const date = parse(key);
  return format(new Date(Date.UTC(date.getUTCFullYear(), Math.floor(date.getUTCMonth() / 3) * 3 + offset * 3, 1, 12)));
};
const yearStart = (key: string, offset = 0) => `${Number(key.slice(0, 4)) + offset}-01-01`;

export type Range = { from: string; to: string };
export const PRESETS: Record<string, string> = {
  today: 'Aujourd’hui',
  this_month: 'Ce mois-ci',
  last_month: 'Mois dernier',
  last_30_days: '30 derniers jours',
  this_quarter: 'Ce trimestre',
  this_year: 'Cette année',
  last_year: 'Année dernière',
  custom: 'Période personnalisée',
};

export function presetRange(preset: string, today = todayKey()): Range {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'last_month':
      return { from: monthStart(today, -1), to: monthEnd(today, -1) };
    case 'last_30_days':
      return { from: addDays(today, -29), to: today };
    case 'this_quarter':
      return { from: quarterStart(today), to: today };
    case 'this_year':
      return { from: yearStart(today), to: today };
    case 'last_year':
      return { from: yearStart(today, -1), to: `${Number(today.slice(0, 4)) - 1}-12-31` };
    default:
      return { from: monthStart(today), to: today };
  }
}

export type Compare = 'none' | 'previous_period' | 'previous_year';
export const COMPARES: Record<Compare, string> = { none: 'Pas de comparaison', previous_period: 'Période précédente', previous_year: 'Même période, an passé' };

/**
 * Période de comparaison « à armes égales » : un mois en cours est comparé au mois précédent sur le même
 * nombre de jours écoulés, pas au mois précédent entier.
 */
export function compareRange(range: Range, preset: string, compare: Compare): Range | null {
  if (compare === 'none') return null;
  if (compare === 'previous_year') {
    const shift = (key: string) => `${Number(key.slice(0, 4)) - 1}${key.slice(4)}`;
    return { from: shift(range.from), to: shift(range.to) };
  }
  const length = daysBetween(range.from, range.to);
  if (preset === 'this_month' || preset === 'this_quarter' || preset === 'this_year') {
    const start = preset === 'this_month' ? monthStart(range.from, -1) : preset === 'this_quarter' ? quarterStart(range.from, -1) : yearStart(range.from, -1);
    return { from: start, to: addDays(start, length - 1) };
  }
  if (preset === 'last_month') return { from: monthStart(range.from, -1), to: monthEnd(range.from, -1) };
  const to = addDays(range.from, -1);
  return { from: addDays(to, -(length - 1)), to };
}

// ── Mesures dérivées ──
type Reader = (id: string) => number;
const ratio = (numerator: number, denominator: number) => (denominator ? numerator / denominator : null);
const DERIVED: Record<string, (read: Reader) => number | null> = {
  revenue_total: (v) => v('revenue_rental') + v('revenue_transfer'),
  net_result: (v) => v('revenue_rental') + v('revenue_transfer') - v('partner_share') - v('maintenance_cost') - v('marketing_spend'),
  avg_revenue_per_rental: (v) => ratio(v('revenue_rental'), v('rentals_count')),
  occupancy_rate: (v) => ratio(v('occupied_days'), v('available_days')),
  transfer_confirmation_rate: (v) => ratio(v('transfers_confirmed'), v('transfers_requested')),
  transfer_cancellation_rate: (v) => ratio(v('transfers_cancelled'), v('transfers_requested')),
  avg_confirmation_hours: (v) => ratio(v('confirmation_hours_sum'), v('transfers_confirmed')),
};

/** Mesures de base nécessaires pour calculer `ids` (les dérivées sont remplacées par leurs composants). */
function baseMetrics(catalog: Catalog, ids: string[]) {
  const needed = new Set<string>();
  const visit = (id: string) => {
    const def = catalog.get(id);
    if (!def) return;
    if (def.source) needed.add(id);
    else def.depends_on.forEach(visit);
  };
  ids.forEach(visit);
  return [...needed];
}

// ── Rapports ──
export type ReportDef = {
  id: string;
  group: string;
  title: string;
  description: string;
  metrics: string[];
  groupBy: string;
  /** Période proposée à l'ouverture. */
  period: string;
  chart: 'bar' | 'barH' | 'none';
  /** Nombre de lignes affichées au maximum (classements). */
  top?: number;
  /** Tri des lignes : par clé (chronologique) ou décroissant sur la première mesure. */
  sort?: 'key' | 'value';
  /** Filtres proposés (colonnes du catalogue). */
  filters?: ('owner_type' | 'category')[];
};

export const REPORTS: ReportDef[] = [
  { id: 'net-result', group: 'Finances', title: 'Résultat net par mois', description: 'Du revenu au résultat net, mois par mois.', metrics: ['revenue_total', 'partner_share', 'maintenance_cost', 'marketing_spend', 'net_result'], groupBy: 'month', period: 'this_year', chart: 'bar', sort: 'key' },
  { id: 'net-total', group: 'Finances', title: 'Résultat net de la période', description: 'La cascade complète sur la période choisie.', metrics: ['revenue_rental', 'revenue_transfer', 'revenue_total', 'partner_share', 'maintenance_cost', 'marketing_spend', 'net_result'], groupBy: 'none', period: 'this_month', chart: 'none' },
  { id: 'revenue-month', group: 'Finances', title: 'Revenu par mois', description: 'Location et transferts, avec comparaison à l’an passé.', metrics: ['revenue_rental', 'revenue_transfer', 'revenue_total'], groupBy: 'month', period: 'this_year', chart: 'bar', sort: 'key' },
  { id: 'revenue-vehicle', group: 'Finances', title: 'Revenu par véhicule', description: 'Quels véhicules rapportent le plus.', metrics: ['revenue_rental', 'rentals_count', 'rental_days', 'avg_revenue_per_rental'], groupBy: 'vehicle', period: 'this_year', chart: 'barH', top: 12, sort: 'value', filters: ['owner_type', 'category'] },
  { id: 'revenue-category', group: 'Finances', title: 'Revenu par catégorie', description: 'Citadine, berline, SUV…', metrics: ['revenue_rental', 'rentals_count', 'rental_days'], groupBy: 'category', period: 'this_year', chart: 'bar', sort: 'value', filters: ['owner_type'] },
  { id: 'partner-share', group: 'Finances', title: 'Part des partenaires', description: 'Ce qui revient à chaque partenaire.', metrics: ['partner_share', 'rentals_count', 'rental_days'], groupBy: 'partner', period: 'this_month', chart: 'barH', sort: 'value' },
  { id: 'rentals-weekday', group: 'Locations', title: 'Locations par jour de la semaine', description: 'Les jours de départ les plus chargés.', metrics: ['rentals_count', 'rental_days', 'revenue_rental'], groupBy: 'weekday', period: 'this_year', chart: 'bar', sort: 'key', filters: ['owner_type', 'category'] },
  { id: 'rentals-month', group: 'Locations', title: 'Locations par mois', description: 'Selon la date de départ.', metrics: ['rentals_count', 'rental_days', 'active_clients'], groupBy: 'month', period: 'this_year', chart: 'bar', sort: 'key', filters: ['owner_type', 'category'] },
  { id: 'occupancy', group: 'Locations', title: 'Taux d’occupation par véhicule', description: 'Jours loués sur jours disponibles.', metrics: ['occupancy_rate', 'occupied_days', 'available_days'], groupBy: 'vehicle', period: 'this_month', chart: 'barH', top: 12, sort: 'value', filters: ['owner_type', 'category'] },
  { id: 'driver-mode', group: 'Locations', title: 'Avec ou sans chauffeur', description: 'Revenu et nombre de locations selon le mode.', metrics: ['rentals_count', 'rental_days'], groupBy: 'driver_mode', period: 'this_year', chart: 'bar', sort: 'value', filters: ['owner_type', 'category'] },
  { id: 'clients', group: 'Clients', title: 'Nouveaux clients par mois', description: 'Premières locations, et clients actifs.', metrics: ['new_clients', 'active_clients', 'rentals_count'], groupBy: 'month', period: 'this_year', chart: 'bar', sort: 'key' },
  { id: 'transfers-month', group: 'Transferts', title: 'Transferts par mois', description: 'Demandes, confirmations et annulations.', metrics: ['transfers_requested', 'transfers_confirmed', 'transfers_done', 'transfers_cancelled', 'transfer_confirmation_rate', 'transfer_cancellation_rate'], groupBy: 'month', period: 'this_year', chart: 'bar', sort: 'key' },
  { id: 'transfers-route', group: 'Transferts', title: 'Transferts par trajet', description: 'Demandes, revenu et délai de confirmation par trajet.', metrics: ['transfers_requested', 'transfers_done', 'revenue_transfer', 'avg_confirmation_hours'], groupBy: 'route', period: 'this_year', chart: 'barH', sort: 'value' },
  { id: 'maintenance', group: 'Coûts', title: 'Maintenance par véhicule', description: 'Ce que chaque véhicule a coûté en entretien.', metrics: ['maintenance_cost'], groupBy: 'vehicle', period: 'this_year', chart: 'barH', top: 12, sort: 'value', filters: ['owner_type', 'category'] },
  { id: 'marketing-channel', group: 'Marketing', title: 'Dépenses marketing par canal', description: 'Où va l’argent, dont les véhicules prêtés.', metrics: ['marketing_spend', 'marketing_in_kind'], groupBy: 'channel', period: 'this_year', chart: 'barH', sort: 'value' },
  { id: 'marketing-campaign', group: 'Marketing', title: 'Dépenses marketing par campagne', description: 'Ce que chaque campagne a coûté.', metrics: ['marketing_spend', 'marketing_in_kind'], groupBy: 'campaign', period: 'this_year', chart: 'barH', sort: 'value' },
];

export type Row = { key: string; label: string; values: Record<string, number | null>; compare?: Record<string, number | null> };
export type ReportResult = { rows: Row[]; totals: Record<string, number | null>; compareTotals?: Record<string, number | null>; metrics: string[]; groupBy: string; range: Range; compareRange: Range | null; at: Date };

type Fetched = Map<string, { label: string; value: number }>;

async function fetchMetric(db: Db, id: string, groupBy: string, range: Range, filters: Record<string, string>): Promise<Fetched> {
  const { data, error } = await db.rpc('analytics_metric', { metric_id: id, group_by: groupBy, date_from: range.from, date_to: range.to, filters });
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.group_key, { label: row.group_label, value: Number(row.value) }]));
}

/** Calcule toutes les colonnes d'un rapport (et leur comparaison) pour une période. */
async function compute(db: Db, catalog: Catalog, def: ReportDef, range: Range, filters: Record<string, string>) {
  const bases = baseMetrics(catalog, def.metrics);
  const grouped = new Map<string, Fetched>();
  const totals = new Map<string, Fetched>();
  await Promise.all(
    bases.map(async (id) => {
      const metric = catalog.get(id)!;
      // Une mesure qui ne se découpe pas par cette dimension n'apporte que son total.
      const dimension = def.groupBy !== 'none' && metric.dimensions.includes(def.groupBy) ? def.groupBy : 'none';
      const [rows, total] = await Promise.all([
        dimension === 'none' ? Promise.resolve(new Map() as Fetched) : fetchMetric(db, id, dimension, range, filters),
        fetchMetric(db, id, 'none', range, filters),
      ]);
      grouped.set(id, rows);
      totals.set(id, total);
    }),
  );

  const keys = new Map<string, string>();
  for (const rows of grouped.values()) for (const [key, row] of rows) if (!keys.has(key)) keys.set(key, row.label);
  const total = (id: string) => totals.get(id)?.get('total')?.value ?? 0;
  const at = (id: string, key: string) => grouped.get(id)?.get(key)?.value ?? 0;

  const valuesFor = (read: (id: string) => number) => {
    const result: Record<string, number | null> = {};
    for (const id of def.metrics) {
      const derive = DERIVED[id];
      result[id] = derive ? derive(read) : read(id);
    }
    return result;
  };
  const rows: Row[] = def.groupBy === 'none' ? [] : [...keys].map(([key, label]) => ({ key, label, values: valuesFor((id) => at(id, key)) }));
  return { rows, totals: valuesFor(total) };
}

export async function runReport(db: Db, catalog: Catalog, def: ReportDef, range: Range, compare: Range | null, filters: Record<string, string>): Promise<ReportResult> {
  const [current, previous] = await Promise.all([compute(db, catalog, def, range, filters), compare ? compute(db, catalog, def, compare, filters) : null]);
  const rows = current.rows;
  if (previous) {
    // La comparaison est alignée sur la même position dans la période (mêmes mois ou mêmes jours, décalés), sinon sur la même clé.
    const sameKey = new Map(previous.rows.map((row) => [row.key, row]));
    const byPosition = def.groupBy === 'day' || def.groupBy === 'week' || def.groupBy === 'month' || def.groupBy === 'quarter';
    rows.forEach((row, index) => {
      const match = byPosition ? previous.rows[index] : sameKey.get(row.key);
      row.compare = match?.values;
    });
  }
  const first = def.metrics[0];
  if (def.sort === 'value') rows.sort((a, b) => Number(b.values[first] ?? 0) - Number(a.values[first] ?? 0));
  else rows.sort((a, b) => a.key.localeCompare(b.key));
  return { rows: def.top ? rows.slice(0, def.top) : rows, totals: current.totals, compareTotals: previous?.totals, metrics: def.metrics, groupBy: def.groupBy, range, compareRange: compare, at: new Date() };
}

// ── Affichage ──
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DRIVER = { true: 'Avec chauffeur', false: 'Sans chauffeur' } as Record<string, string>;
const OWNER = { agency: 'Agence', partner: 'Partenaires' } as Record<string, string>;
const CHANNEL: Record<string, string> = { ads: 'Publicité en ligne', influencer: 'Influenceur', print: 'Affiches, flyers, imprimés', event: 'Événement', sponsoring: 'Sponsoring, partenariat', other: 'Autre' };
const STATUS: Record<string, string> = { new: 'Nouvelle', confirmed: 'Confirmée', assigned: 'Chauffeur assigné', en_route: 'En route', arrived: 'Arrivé', done: 'Terminée', cancelled: 'Annulée' };

/** Libellé lisible d'une ligne selon la dimension de regroupement. */
export function groupLabel(dimension: string, key: string, label: string) {
  switch (dimension) {
    case 'month':
      return `${MONTHS[Number(key.slice(5, 7)) - 1] ?? key} ${key.slice(0, 4)}`;
    case 'day':
    case 'week':
      return key.split('-').reverse().join('/');
    case 'quarter':
      return key.replace('-T', ' · T');
    case 'weekday':
      return WEEKDAYS[Number(key) - 1] ?? key;
    case 'driver_mode':
      return DRIVER[key] ?? key;
    case 'owner':
      return OWNER[key] ?? key;
    case 'channel':
      return CHANNEL[key] ?? key;
    case 'status':
      return STATUS[key] ?? key;
    default:
      return label;
  }
}

export function formatValue(value: number | null | undefined, unit: MetricDef['unit']) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const fr = (n: number, digits = 0) => n.toLocaleString('fr-FR', { maximumFractionDigits: digits });
  switch (unit) {
    case 'money':
      return `${fr(value)} FCFA`;
    case 'percent':
      return `${fr(value * 100, 1)} %`;
    case 'hours':
      return `${fr(value, 1)} h`;
    case 'days':
      return `${fr(value, 1)} j`;
    default:
      return fr(value);
  }
}

/** Variation en % par rapport à la comparaison (null si la base est nulle). */
export const variation = (current: number | null, previous: number | null | undefined) =>
  current === null || previous === null || previous === undefined || previous === 0 ? null : (current - previous) / Math.abs(previous);

export function reportCsv(def: ReportDef, result: ReportResult, catalog: Catalog) {
  const metrics = result.metrics.map((id) => catalog.get(id)!);
  const head = [def.groupBy === 'none' ? 'Période' : 'Groupe', ...metrics.flatMap((m) => (result.compareRange ? [m.label, `${m.label} (comparaison)`] : [m.label]))];
  const cell = (id: string, values: Record<string, number | null> | undefined) => {
    const m = catalog.get(id)!;
    const value = values?.[id];
    return value === null || value === undefined ? '' : String(m.unit === 'percent' ? Math.round(value * 1000) / 10 : Math.round(value * 100) / 100).replace('.', ',');
  };
  const line = (label: string, values: Record<string, number | null>, compare?: Record<string, number | null>) => [label, ...result.metrics.flatMap((id) => (result.compareRange ? [cell(id, values), cell(id, compare)] : [cell(id, values)]))];
  const rows = [
    ...result.rows.map((row) => line(groupLabel(result.groupBy, row.key, row.label), row.values, row.compare)),
    line('Total', result.totals, result.compareTotals),
  ];
  const period = `Période : ${result.range.from} au ${result.range.to}${result.compareRange ? ` ; comparaison : ${result.compareRange.from} au ${result.compareRange.to}` : ''}`;
  return [def.title, period, '', head.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}
