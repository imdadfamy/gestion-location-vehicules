import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type Db = SupabaseClient<Database>;
type Car = { make: string | null; model: string | null; registration_number: string | null } | null;

/** Du revenu au résultat net : chaque ligne est un montant en FCFA (les coûts sont positifs, déduits dans le calcul). */
export type NetResult = {
  rentalRevenue: number;
  transferRevenue: number;
  revenue: number;
  partnerShare: number;
  maintenance: number;
  marketing: number;
  /** Part du marketing qui n'est pas de l'argent sorti (véhicules prêtés, valorisés au prix de location). */
  marketingInKind: number;
  /** Faux si la personne n'a pas la permission Marketing : le résultat net ne les contient alors pas. */
  marketingIncluded: boolean;
  net: number;
};

export type Report = {
  net: NetResult;
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
export async function buildReport(db: Db, from: string, to: string, includeMarketing = false): Promise<{ data: Report | null; error: unknown }> {
  const [payments, rentals, incidents, maintenance, transfers, marketingRows] = await Promise.all([
    db.from('payments').select('amount,payment_date,rental_id,rentals(vehicles(make,model,registration_number))'),
    db.from('rentals').select('id,departure_date,return_date,status,client_id,vehicles(make,model,registration_number,owner_type,partner_requested_price)'),
    db.from('incidents').select('cost,incident_date'),
    db.from('vehicle_maintenance').select('cost,maintenance_date'),
    db.from('transfer_requests').select('final_price,quoted_price,pickup_at').eq('status', 'done'),
    includeMarketing ? db.from('marketing_expenses').select('amount,in_kind,spent_on') : Promise.resolve({ data: [], error: null }),
  ]);
  const error = payments.error ?? rentals.error ?? incidents.error ?? maintenance.error ?? transfers.error ?? marketingRows.error;
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
  const rentalRevenue = paid.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const costs = repairs.reduce((sum, item) => sum + Number(item.cost || 0), 0);
  // Transferts terminés : prix confirmé, à défaut le prix annoncé (encaissé à l'arrivée, hors encaissements de location).
  const transferRevenue = (transfers.data ?? [])
    .filter((item) => between(item.pickup_at))
    .reduce((sum, item) => sum + Number(item.final_price ?? item.quoted_price ?? 0), 0);
  const revenue = rentalRevenue + transferRevenue;
  // Part des partenaires : jours loués × prix qu'ils demandent, pour les locations commencées sur la période.
  const partnerShare = rented
    .filter((item) => item.status !== 'cancelled')
    .reduce((sum, item) => {
      const car = one(item.vehicles) as { owner_type?: string | null; partner_requested_price?: number | null } | null;
      if (car?.owner_type !== 'partner') return sum;
      const days = Math.max(1, Math.ceil((new Date(item.return_date).getTime() - new Date(item.departure_date).getTime()) / 86400000));
      return sum + days * Number(car.partner_requested_price ?? 0);
    }, 0);
  const marketing = (marketingRows.data ?? []).filter((item) => between(item.spent_on));
  const marketingTotal = marketing.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const marketingInKind = marketing.filter((item) => item.in_kind).reduce((sum, item) => sum + Number(item.amount || 0), 0);

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
      net: {
        rentalRevenue,
        transferRevenue,
        revenue,
        partnerShare,
        maintenance: costs,
        marketing: marketingTotal,
        marketingInKind,
        marketingIncluded: includeMarketing,
        net: revenue - partnerShare - costs - marketingTotal,
      },
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
  const { net } = report;
  const lines = [
    ['Revenus de location encaissés', net.rentalRevenue],
    ['Revenus des transferts terminés', net.transferRevenue],
    ['Total des revenus', net.revenue],
    ['Part des partenaires (déduite)', -net.partnerShare],
    ['Coûts de maintenance (déduits)', -net.maintenance],
    ...(net.marketingIncluded ? ([['Dépenses marketing (déduites)', -net.marketing]] as [string, number][]) : []),
    ['Résultat net', net.net],
  ].map(([label, amount]) => `${label};${money(Number(amount))}`);
  return ['Indicateur;Valeur', ...report.stats.map((stat) => `${stat.label};${stat.value}`), '', 'Résultat net;', ...lines].join('\n');
}
