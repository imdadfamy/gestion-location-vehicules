import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [DatePipe, FormsModule],
  styleUrl: './notifications.component.scss',
  templateUrl: './notifications.component.html',
})
export class NotificationsComponent implements OnInit {
  rows = signal<any[]>([]);
  alerts = signal<any[]>([]);
  loading = signal(false);
  error = signal('');
  filter = '';
  constructor(private auth: AuthService) {}
  ngOnInit() {
    this.load();
  }
  visible() {
    return this.rows().filter(
      (item) => !this.filter || (this.filter === 'read' ? !item.wasUnread : item.wasUnread),
    );
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    const refresh = await this.auth.supabase().rpc('refresh_overdue_rentals');
    const [notifications, contracts, rentals, payments, maintenance, vehicles, incidents] =
      await Promise.all([
        this.auth
          .supabase()
          .from('notifications')
          .select('*')
          .eq('user_id', this.auth.profile()?.id)
          .order('created_at', { ascending: false }),
        this.auth
          .supabase()
          .from('contracts')
          .select('contract_number')
          .eq('status', 'pending_signature'),
        this.auth
          .supabase()
          .from('rentals')
          .select('id,status,return_date,rental_price,vehicles(registration_number)'),
        this.auth.supabase().from('payments').select('rental_id,amount'),
        this.auth
          .supabase()
          .from('vehicle_maintenance')
          .select('id,next_maintenance_date,status,vehicles(registration_number)')
          .neq('status', 'completed'),
        this.auth
          .supabase()
          .from('vehicles')
          .select('registration_number,insurance_expiry_date,technical_inspection_expiry_date'),
        this.auth.supabase().from('incidents').select('id').in('status', ['open', 'in_progress']),
      ]);
    this.loading.set(false);
    const problem =
      refresh.error ??
      notifications.error ??
      contracts.error ??
      rentals.error ??
      payments.error ??
      maintenance.error ??
      vehicles.error ??
      incidents.error;
    if (problem) {
      this.error.set(this.auth.errorMessage(problem));
      return;
    }
    this.rows.set(
      (notifications.data ?? []).map((item) => ({ ...item, wasUnread: !item.is_read })),
    );
    await this.markAllSeen();
    const now = Date.now(),
      soon = now + 30 * 86400000,
      alerts: any[] = [];
    for (const contract of contracts.data ?? [])
      alerts.push({
        key: `contract-${contract.contract_number}`,
        title: 'Contrat à signer',
        message: `${contract.contract_number ?? 'Contrat'} attend les signatures.`,
      });
    for (const rental of rentals.data ?? []) {
      const end = new Date(rental.return_date).getTime(),
        vehicle: any = Array.isArray(rental.vehicles) ? rental.vehicles[0] : rental.vehicles,
        name = vehicle?.registration_number ?? 'Véhicule';
      if (rental.status === 'overdue')
        alerts.push({
          key: `late-${rental.id}`,
          title: 'Véhicule en retard',
          message: `${name} a dépassé sa date de retour.`,
        });
      else if (rental.status === 'active' && end >= now && end < now + 48 * 3600000)
        alerts.push({
          key: `return-${rental.id}`,
          title: 'Retour proche',
          message: `${name} doit être retourné dans moins de 48 h.`,
        });
      const paid = (payments.data ?? [])
        .filter((payment) => payment.rental_id === rental.id)
        .reduce((total, payment) => total + Number(payment.amount), 0);
      if (paid < Number(rental.rental_price))
        alerts.push({
          key: `payment-${rental.id}`,
          title: 'Solde de paiement restant',
          message: `${name} présente un solde impayé.`,
        });
    }
    for (const item of maintenance.data ?? []) {
      const date = item.next_maintenance_date ? new Date(item.next_maintenance_date).getTime() : 0;
      if (date && date <= soon)
        alerts.push({
          key: `maintenance-${item.id}`,
          title: 'Maintenance à venir',
          message: `${(Array.isArray(item.vehicles) ? item.vehicles[0] : item.vehicles)?.registration_number ?? 'Véhicule'} arrive à échéance.`,
        });
    }
    for (const vehicle of vehicles.data ?? []) {
      if (
        vehicle.insurance_expiry_date &&
        new Date(vehicle.insurance_expiry_date).getTime() <= soon
      )
        alerts.push({
          key: `insurance-${vehicle.registration_number}`,
          title: 'Assurance à renouveler',
          message: `${vehicle.registration_number} : échéance d'assurance proche ou dépassée.`,
        });
      if (
        vehicle.technical_inspection_expiry_date &&
        new Date(vehicle.technical_inspection_expiry_date).getTime() <= soon
      )
        alerts.push({
          key: `technical-${vehicle.registration_number}`,
          title: 'Contrôle technique à renouveler',
          message: `${vehicle.registration_number} : échéance proche ou dépassée.`,
        });
    }
    if ((incidents.data ?? []).length)
      alerts.push({
        key: 'incidents',
        title: 'Incident nécessitant une action',
        message: `${(incidents.data ?? []).length} incident(s) ouvert(s) ou en cours.`,
      });
    this.alerts.set(alerts);
  }
  async markAllSeen() {
    const unreadIds = this.rows()
      .filter((item) => !item.is_read)
      .map((item) => item.id);
    if (unreadIds.length) {
      const result = await this.auth
        .supabase()
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', unreadIds);
      if (result.error) {
        this.error.set(this.auth.errorMessage(result.error));
        return;
      }
      this.rows.set(
        this.rows().map((item) =>
          unreadIds.includes(item.id) ? { ...item, is_read: true } : item,
        ),
      );
    }
    await this.auth.refreshUnreadNotifications();
  }
}
