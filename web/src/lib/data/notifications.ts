import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type Db = SupabaseClient<Database>;
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type Alert = { key: string; title: string; message: string; href: string };

type Plate = { registration_number: string } | { registration_number: string }[] | null;
const plateOf = (value: Plate) => (Array.isArray(value) ? value[0] : value)?.registration_number ?? 'Véhicule';

export function myNotifications(db: Db, userId: string) {
  return db.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
}

export function markRead(db: Db, ids: string[]) {
  return db.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).in('id', ids);
}

/**
 * Alertes opérationnelles calculées en direct (mêmes règles que l'écran Angular) :
 * contrats à signer, retours, retards, soldes, maintenances, échéances, incidents.
 * Elles disparaissent d'elles-mêmes une fois la situation réglée.
 */
export async function operationalAlerts(db: Db): Promise<{ data: Alert[] | null; error: unknown }> {
  const refresh = await db.rpc('refresh_overdue_rentals');
  const [contracts, rentals, payments, maintenance, vehicles, incidents] = await Promise.all([
    db.from('contracts').select('contract_number').eq('status', 'pending_signature'),
    db.from('rentals').select('id,status,return_date,rental_price,vehicles(registration_number),vehicle_inspections(inspection_type)'),
    db.from('payments').select('rental_id,amount'),
    db
      .from('vehicle_maintenance')
      .select('id,next_maintenance_date,status,vehicles(registration_number)')
      .neq('status', 'completed'),
    db.from('vehicles').select('registration_number,insurance_expiry_date,technical_inspection_expiry_date'),
    db.from('incidents').select('id').in('status', ['open', 'in_progress']),
  ]);
  const error =
    refresh.error ?? contracts.error ?? rentals.error ?? payments.error ?? maintenance.error ?? vehicles.error ?? incidents.error;
  if (error) return { data: null, error };

  const now = Date.now();
  const soon = now + 30 * 86400000;
  const alerts: Alert[] = [];
  for (const contract of contracts.data ?? [])
    alerts.push({
      key: `contract-${contract.contract_number}`,
      title: 'Contrat à signer',
      message: `${contract.contract_number ?? 'Contrat'} attend les signatures.`,
      href: '/app/contracts',
    });
  for (const rental of rentals.data ?? []) {
    const end = new Date(rental.return_date).getTime();
    const name = plateOf(rental.vehicles as Plate);
    const returned = (rental.vehicle_inspections ?? []).some((inspection) => inspection.inspection_type === 'return');
    if (returned && rental.status !== 'completed')
      alerts.push({
        key: `closure-${rental.id}`,
        title: 'Location à clôturer',
        message: `${name} est rentré : réglez le solde, la caution ou l’incident restant pour clôturer.`,
        href: '/app/rentals',
      });
    else if (rental.status === 'overdue')
      alerts.push({ key: `late-${rental.id}`, title: 'Véhicule en retard', message: `${name} a dépassé sa date de retour.`, href: '/app/rentals' });
    else if (rental.status === 'active' && end >= now && end < now + 48 * 3600000)
      alerts.push({
        key: `return-${rental.id}`,
        title: 'Retour proche',
        message: `${name} doit être retourné dans moins de 48 h.`,
        href: '/app/rentals',
      });
    const paid = (payments.data ?? [])
      .filter((payment) => payment.rental_id === rental.id)
      .reduce((total, payment) => total + Number(payment.amount), 0);
    if (paid < Number(rental.rental_price))
      alerts.push({ key: `payment-${rental.id}`, title: 'Solde de paiement restant', message: `${name} présente un solde impayé.`, href: '/app/payments' });
  }
  for (const item of maintenance.data ?? []) {
    const date = item.next_maintenance_date ? new Date(item.next_maintenance_date).getTime() : 0;
    if (date && date <= soon)
      alerts.push({
        key: `maintenance-${item.id}`,
        title: 'Maintenance à venir',
        message: `${plateOf(item.vehicles as Plate)} arrive à échéance.`,
        href: '/app/maintenance',
      });
  }
  for (const vehicle of vehicles.data ?? []) {
    if (vehicle.insurance_expiry_date && new Date(vehicle.insurance_expiry_date).getTime() <= soon)
      alerts.push({
        key: `insurance-${vehicle.registration_number}`,
        title: 'Assurance à renouveler',
        message: `${vehicle.registration_number} : échéance d’assurance proche ou dépassée.`,
        href: '/app/vehicles',
      });
    if (vehicle.technical_inspection_expiry_date && new Date(vehicle.technical_inspection_expiry_date).getTime() <= soon)
      alerts.push({
        key: `technical-${vehicle.registration_number}`,
        title: 'Contrôle technique à renouveler',
        message: `${vehicle.registration_number} : échéance proche ou dépassée.`,
        href: '/app/vehicles',
      });
  }
  if (incidents.data?.length)
    alerts.push({
      key: 'incidents',
      title: 'Incident nécessitant une action',
      message: `${incidents.data.length} incident(s) ouvert(s) ou en cours.`,
      href: '/app/incidents',
    });
  return { data: alerts, error: null };
}
