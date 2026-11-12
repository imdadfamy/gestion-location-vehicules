import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type Db = SupabaseClient<Database>;

/** L'agence est au Bénin (UTC+1, sans heure d'été) : les journées et les mois se comptent à cette heure-là. */
const TIME_ZONE = 'Africa/Porto-Novo';
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** « AAAA-MM-JJ » à l'heure de l'agence. */
function day(value: string | Date) {
  return dayKey.format(new Date(value));
}

type Car = { make: string | null; model: string | null } | null;
const carName = (car: Car, fallback: string) => (car ? `${car.make ?? ''} ${car.model ?? ''}`.trim() || fallback : fallback);
const one = <T,>(value: T | T[] | null | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export type DashboardData = {
  vehicles: { total: number; available: number; onRental: number; maintenance: number };
  clients: number;
  rentals: { ongoing: number; upcoming: number; overdue: number; pending: number };
  contractsToSign: number;
  maintenanceInProgress: number;
  revenue: { today: number; month: number; year: number };
  monthlyRevenue: { month: string; amount: number }[];
  monthlyRentals: { month: string; count: number }[];
  revenueByVehicle: { vehicle: string; amount: number }[];
  topVehicles: { vehicle: string; count: number }[];
};

/**
 * Indicateurs du tableau de bord (mêmes calculs que l'application Angular). Met d'abord
 * à jour les locations en retard. La RLS limite les lignes à ce que le compte peut voir.
 */
export async function loadDashboard(db: Db): Promise<DashboardData> {
  const refresh = await db.rpc('refresh_overdue_rentals');
  if (refresh.error) throw refresh.error;
  const [vehicles, clients, rentals, contracts, payments, maintenance] = await Promise.all([
    db.from('vehicles').select('id,status'),
    db.from('clients').select('id', { count: 'exact', head: true }),
    db.from('rentals').select('id,status,departure_date,vehicles(make,model)'),
    db.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'pending_signature'),
    db.from('payments').select('amount,payment_date,rentals(status,vehicles(make,model))'),
    db.from('vehicle_maintenance').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
  ]);
  const problem = vehicles.error ?? clients.error ?? rentals.error ?? contracts.error ?? payments.error ?? maintenance.error;
  if (problem) throw problem;

  const vs = vehicles.data ?? [];
  const rs = rentals.data ?? [];
  const ps = payments.data ?? [];
  const now = Date.now();
  const today = day(new Date(now));

  const revenue = { today: 0, month: 0, year: 0 };
  const monthly = new Map<string, number>();
  const byVehicle = new Map<string, number>();
  for (const payment of ps) {
    // L'argent d'une location annulée n'est pas une recette.
    if (one(payment.rentals)?.status === 'cancelled') continue;
    const amount = Number(payment.amount || 0);
    const key = day(payment.payment_date);
    if (key === today) revenue.today += amount;
    if (key.slice(0, 7) === today.slice(0, 7)) revenue.month += amount;
    if (key.slice(0, 4) === today.slice(0, 4)) revenue.year += amount;
    monthly.set(key.slice(0, 7), (monthly.get(key.slice(0, 7)) ?? 0) + amount);
    const name = carName(one(one(payment.rentals)?.vehicles), 'Non affecté');
    byVehicle.set(name, (byVehicle.get(name) ?? 0) + amount);
  }

  const rentalMonths = new Map<string, number>();
  const top = new Map<string, number>();
  for (const rental of rs) {
    if (rental.status === 'cancelled') continue;
    const key = day(rental.departure_date).slice(0, 7);
    rentalMonths.set(key, (rentalMonths.get(key) ?? 0) + 1);
    const name = carName(one(rental.vehicles), 'Véhicule');
    top.set(name, (top.get(name) ?? 0) + 1);
  }

  const byDesc = (a: [string, number], b: [string, number]) => b[1] - a[1];
  return {
    vehicles: {
      total: vs.length,
      available: vs.filter((v) => v.status === 'available').length,
      onRental: vs.filter((v) => v.status === 'on_rental').length,
      maintenance: vs.filter((v) => v.status === 'maintenance').length,
    },
    clients: clients.count ?? 0,
    rentals: {
      ongoing: rs.filter((r) => r.status === 'active' || r.status === 'overdue').length,
      upcoming: rs.filter((r) => r.status === 'pending' && new Date(r.departure_date).getTime() > now).length,
      overdue: rs.filter((r) => r.status === 'overdue').length,
      pending: rs.filter((r) => r.status === 'pending').length,
    },
    contractsToSign: contracts.count ?? 0,
    maintenanceInProgress: maintenance.count ?? 0,
    revenue,
    monthlyRevenue: [...monthly].sort().map(([month, amount]) => ({ month, amount })),
    monthlyRentals: [...rentalMonths].sort().map(([month, count]) => ({ month, count })),
    revenueByVehicle: [...byVehicle].sort(byDesc).slice(0, 8).map(([vehicle, amount]) => ({ vehicle, amount })),
    topVehicles: [...top].sort(byDesc).slice(0, 8).map(([vehicle, count]) => ({ vehicle, count })),
  };
}
