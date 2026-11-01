import type { Booking, Earning, MyVehicle } from './partner-portal';

const sum = (rows: Earning[]) => rows.reduce((total, row) => total + Number(row.payout ?? 0), 0);
const IN_PROGRESS = ['active', 'overdue'];

/** Chiffres du tableau de bord : revenus du mois, locations en cours, véhicules à décider, prochaines locations. */
export function summarize(rows: Earning[], vehicles: MyVehicle[], now = new Date()) {
  const sameMonth = (value: string) => {
    const date = new Date(value);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  };
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const monthDone = rows.filter((row) => row.status === 'completed' && sameMonth(row.return_date));
  const inProgress = rows.filter((row) => IN_PROGRESS.includes(row.status));
  const upcoming = rows
    .filter((row) => row.status === 'pending' && new Date(row.departure_date).getTime() >= startOfToday)
    .sort((a, b) => new Date(a.departure_date).getTime() - new Date(b.departure_date).getTime());
  return {
    monthRevenue: sum(monthDone),
    monthRentals: monthDone.length,
    inProgress,
    inProgressPayout: sum(inProgress),
    upcoming,
    pendingVehicles: vehicles.filter((vehicle) => vehicle.approval_status === 'pending'),
    rejectedVehicles: vehicles.filter((vehicle) => vehicle.approval_status === 'rejected'),
    approvedVehicles: vehicles.filter((vehicle) => vehicle.approval_status === 'approved'),
  };
}

/** « 2026-11 » d'une date (mois local). */
export const monthKey = (value: string | Date) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const monthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export type DayState = 'free' | 'rental' | 'reservation' | 'maintenance';

export type Interval = { vehicleId: string; kind: Exclude<DayState, 'free'>; label: string; start: number; end: number };

/** Périodes occupées : locations, réservations et maintenances (planifiée ou en cours). */
export function intervals(
  bookings: Booking[],
  maintenances: { vehicle_id: string; maintenance_date: string; status: string; maintenance_type: string }[],
  now = new Date(),
): Interval[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const list: Interval[] = bookings.map((booking) => ({
    vehicleId: booking.vehicle_id,
    kind: booking.kind === 'reservation' ? 'reservation' : 'rental',
    label: booking.kind === 'reservation' ? 'Réservé' : 'Loué',
    start: new Date(booking.starts_at).getTime(),
    end: new Date(booking.ends_at).getTime(),
  }));
  for (const item of maintenances) {
    if (item.status !== 'planned' && item.status !== 'in_progress') continue;
    const [year, month, day] = item.maintenance_date.split('-').map(Number);
    const start = new Date(year, month - 1, day).getTime();
    // En cours : le véhicule reste indisponible jusqu'à aujourd'hui au moins.
    const end = Math.max(start + 86400000, item.status === 'in_progress' ? startOfToday + 86400000 : 0);
    list.push({ vehicleId: item.vehicle_id, kind: 'maintenance', label: `Maintenance : ${item.maintenance_type}`, start, end });
  }
  return list;
}

/** État d'un véhicule un jour donné (la maintenance l'emporte, puis la location, puis la réservation). */
export function dayState(list: Interval[], vehicleId: string, day: Date): { state: DayState; label: string } {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const end = start + 86400000;
  const hits = list.filter((item) => item.vehicleId === vehicleId && item.start < end && item.end > start);
  for (const kind of ['maintenance', 'rental', 'reservation'] as const) {
    const hit = hits.find((item) => item.kind === kind);
    if (hit) return { state: kind, label: hit.label };
  }
  return { state: 'free', label: 'Libre' };
}

/** Ligne CSV (séparateur « ; » pour un Excel français), champs protégés par des guillemets. */
export const csvLine = (cells: (string | number)[]) =>
  cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';');
