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

/** Un mois ou une année choisis au calendrier (month : 1 à 12). */
export const monthRange = (year: number, month: number): Range => ({ from: format(new Date(Date.UTC(year, month - 1, 1, 12))), to: monthEnd(format(new Date(Date.UTC(year, month - 1, 1, 12)))) });
export const yearRange = (year: number): Range => ({ from: `${year}-01-01`, to: `${year}-12-31` });

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
  // Un mois entier ou une année entière choisis au calendrier se comparent au mois ou à l'année d'avant, entiers.
  if (range.from.endsWith('-01') && range.to === monthEnd(range.from)) return { from: monthStart(range.from, -1), to: monthEnd(range.from, -1) };
  if (range.from.endsWith('-01-01') && range.to === `${range.from.slice(0, 4)}-12-31`) return yearRange(Number(range.from.slice(0, 4)) - 1);
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
  acquisition_cost: (v) => ratio(v('marketing_spend'), v('new_clients')),
  channel_net: (v) => v('revenue_rental') + v('revenue_transfer') - v('marketing_spend'),
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
  /** Nom court dans la bibliothèque. */
  title: string;
  /** La question à laquelle le rapport répond. */
  question: string;
  description: string;
  /** Colonnes proposées à l'ouverture (d'autres s'ajoutent depuis « Colonnes »). */
  metrics: string[];
  /** Regroupement proposé à l'ouverture et regroupements possibles. */
  groupBy: string;
  groupOptions: string[];
  /** Période proposée à l'ouverture. */
  period: string;
  /** Filtres proposés (colonnes du catalogue). */
  filters?: ('owner_type' | 'category')[];
  /** Réservé aux personnes ayant la permission Marketing. */
  marketing?: boolean;
};

export const DIMENSIONS: Record<string, string> = {
  none: 'Total de la période',
  day: 'Jour',
  week: 'Semaine',
  month: 'Mois',
  quarter: 'Trimestre',
  year: 'Année',
  weekday: 'Jour de la semaine',
  vehicle: 'Véhicule',
  category: 'Catégorie',
  owner: 'Propriétaire (agence ou partenaire)',
  partner: 'Partenaire',
  driver_mode: 'Avec ou sans chauffeur',
  route: 'Trajet',
  status: 'Statut',
  channel: 'Canal',
  campaign: 'Campagne',
};
export const TIME_DIMENSIONS = ['day', 'week', 'month', 'quarter', 'year'];
export const isTimeDimension = (dimension: string) => TIME_DIMENSIONS.includes(dimension);
/** Nombre maximal de lignes affichées ; les totaux portent toujours sur toutes les lignes. */
export const MAX_ROWS = 1000;

export const REPORTS: ReportDef[] = [
  {
    id: 'revenue',
    title: 'Revenus',
    question: 'Combien ai-je encaissé ?',
    description: 'Location et transferts, par mois, semaine, véhicule…',
    metrics: ['revenue_total', 'revenue_rental', 'revenue_transfer'],
    groupBy: 'month',
    groupOptions: ['month', 'week', 'day', 'quarter', 'weekday', 'vehicle', 'category', 'owner', 'channel'],
    period: 'this_year',
    filters: ['owner_type', 'category'],
  },
  {
    id: 'net',
    title: 'Résultat net',
    question: 'Combien me reste-t-il vraiment ?',
    description: 'Revenus moins la part des partenaires, la maintenance et le marketing.',
    metrics: ['revenue_total', 'partner_share', 'maintenance_cost', 'marketing_spend', 'net_result'],
    groupBy: 'month',
    groupOptions: ['none', 'month', 'quarter', 'year', 'week', 'day'],
    period: 'this_year',
  },
  {
    id: 'vehicles',
    title: 'Véhicules',
    question: 'Mes véhicules travaillent-ils ?',
    description: 'Ce que chaque véhicule rapporte, combien de jours il est loué, ce qu’il coûte en entretien.',
    metrics: ['revenue_rental', 'rentals_count', 'rental_days', 'occupancy_rate'],
    groupBy: 'vehicle',
    groupOptions: ['vehicle', 'category', 'owner', 'driver_mode', 'month'],
    period: 'this_month',
    filters: ['owner_type', 'category'],
  },
  {
    id: 'partners',
    title: 'Partenaires',
    question: 'Combien dois-je à mes partenaires ?',
    description: 'La part qui revient à chaque partenaire sur la période.',
    metrics: ['partner_share', 'rentals_count', 'rental_days'],
    groupBy: 'partner',
    groupOptions: ['partner', 'month', 'vehicle'],
    period: 'this_month',
  },
  {
    id: 'transfers',
    title: 'Transferts',
    question: 'Où en sont mes transferts ?',
    description: 'Demandes, confirmations, annulations et revenus des transferts.',
    metrics: ['transfers_requested', 'transfers_confirmed', 'transfers_done', 'transfers_cancelled', 'revenue_transfer'],
    groupBy: 'month',
    groupOptions: ['month', 'week', 'day', 'route', 'weekday', 'status'],
    period: 'this_year',
  },
  {
    id: 'customers',
    title: 'Clients',
    question: 'Combien de clients, nouveaux ou fidèles ?',
    description: 'Premières locations, clients actifs et locations.',
    metrics: ['new_clients', 'active_clients', 'rentals_count'],
    groupBy: 'month',
    groupOptions: ['month', 'week', 'quarter', 'channel', 'category'],
    period: 'this_year',
  },
  {
    id: 'acquisition',
    title: 'Marketing et canaux',
    question: 'D’où viennent mes clients, et quel canal vaut son prix ?',
    description: 'Dépenses, nouveaux clients, coût d’acquisition et revenu net de chaque canal.',
    metrics: ['marketing_spend', 'new_clients', 'acquisition_cost', 'channel_net'],
    groupBy: 'channel',
    groupOptions: ['channel', 'campaign', 'month'],
    period: 'this_year',
    marketing: true,
  },
  {
    id: 'costs',
    title: 'Dépenses',
    question: 'Où part mon argent ?',
    description: 'Maintenance et marketing, par mois, véhicule ou canal.',
    metrics: ['maintenance_cost', 'marketing_spend'],
    groupBy: 'month',
    groupOptions: ['month', 'week', 'vehicle', 'category', 'channel', 'campaign'],
    period: 'this_year',
    filters: ['owner_type', 'category'],
  },
];

export type Row = { key: string; label: string; values: Record<string, number | null>; compare?: Record<string, number | null> };
export type ReportResult = { rows: Row[]; rowCount: number; truncated: boolean; totals: Record<string, number | null>; compareTotals?: Record<string, number | null>; metrics: string[]; groupBy: string; range: Range; compareRange: Range | null; at: Date };

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
  // Une durée se lit dans l'ordre du temps ; un classement, du plus grand au plus petit.
  if (isTimeDimension(def.groupBy) || def.groupBy === 'weekday') rows.sort((a, b) => a.key.localeCompare(b.key));
  else rows.sort((a, b) => Number(b.values[first] ?? 0) - Number(a.values[first] ?? 0));
  return { rows: rows.slice(0, MAX_ROWS), rowCount: rows.length, truncated: rows.length > MAX_ROWS, totals: current.totals, compareTotals: previous?.totals, metrics: def.metrics, groupBy: def.groupBy, range, compareRange: compare, at: new Date() };
}

// ── Affichage ──
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DRIVER = { true: 'Avec chauffeur', false: 'Sans chauffeur' } as Record<string, string>;
const OWNER = { agency: 'Agence', partner: 'Partenaires' } as Record<string, string>;
const CHANNEL: Record<string, string> = { ads: 'Publicité en ligne', influencer: 'Influenceur', print: 'Affiches, flyers, imprimés', event: 'Événement', sponsoring: 'Sponsoring, partenariat', word_of_mouth: 'Bouche-à-oreille', search: 'Recherche Internet', walk_in: 'Passage devant l’agence', partner: 'Partenaire', other: 'Autre', unknown: 'Non renseigné' };
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
  const head = [def.groupBy === 'none' ? 'Période' : (DIMENSIONS[def.groupBy] ?? 'Groupe'), ...metrics.flatMap((m) => (result.compareRange ? [m.label, `${m.label} (comparaison)`] : [m.label]))];
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

/** Rapport qui détaille une mesure : celui qui la met en première colonne, sinon un rapport qui sait la découper. */
export const reportForMetric = (catalog: Catalog, metricId: string) => {
  const metric = catalog.get(metricId);
  return (
    REPORTS.find((report) => report.metrics[0] === metricId) ??
    REPORTS.find((report) => report.metrics.includes(metricId)) ??
    REPORTS.find((report) => report.groupBy === 'none' || metric?.dimensions.includes(report.groupBy)) ??
    REPORTS[0]
  );
};

// ── Rapports enregistrés ──
export type SavedDefinition = {
  report_id: string;
  metrics: string[];
  preset: string;
  from?: string;
  to?: string;
  compare: Compare;
  owner: string;
  category: string;
  group_by?: string;
};
export type SavedReport = { id: string; owner_id: string; title: string; definition: SavedDefinition; shared: boolean };

export async function listSaved(db: Db) {
  const { data, error } = await db.from('analytics_saved_reports').select('id,owner_id,title,definition,shared').order('created_at', { ascending: false });
  return { saved: ((data ?? []) as unknown as SavedReport[]), error };
}

export function saveReport(db: Db, ownerId: string, title: string, definition: SavedDefinition, shared: boolean) {
  return db.from('analytics_saved_reports').insert({ owner_id: ownerId, title: title.trim(), definition: definition as unknown as Database['public']['Tables']['analytics_saved_reports']['Insert']['definition'], shared }).select().single();
}

export const deleteSaved = (db: Db, id: string) => db.from('analytics_saved_reports').delete().eq('id', id);
