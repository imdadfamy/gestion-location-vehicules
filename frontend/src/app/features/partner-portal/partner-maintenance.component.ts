import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { PartnerPortalService } from '../../core/data/partner-portal.service';

@Component({
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './partner-maintenance.component.html',
})
export class PartnerMaintenanceComponent implements OnInit {
  rows = signal<any[]>([]);
  vehicles = signal<any[]>([]);
  form = signal<any>(null);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  message = signal('');
  constructor(
    private auth: AuthService,
    private portal: PartnerPortalService,
  ) {}

  async ngOnInit() {
    await this.load();
  }
  statusLabel(status: string) {
    return (
      (
        {
          planned: 'Planifiée',
          in_progress: 'En cours',
          completed: 'Terminée',
          cancelled: 'Annulée',
        } as Record<string, string>
      )[status] ?? status
    );
  }
  statusTone(status: string) {
    return (
      (
        {
          planned: 'secondary',
          in_progress: 'warning',
          completed: 'success',
          cancelled: 'danger',
        } as Record<string, string>
      )[status] ?? 'secondary'
    );
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    const [vehicles, rows] = await Promise.all([
      this.portal.vehicleOptions(),
      this.portal.maintenances(),
    ]);
    this.loading.set(false);
    const failure = vehicles.error ?? rows.error;
    if (failure) {
      this.error.set(this.auth.errorMessage(failure));
      return;
    }
    this.vehicles.set(vehicles.data ?? []);
    this.rows.set(rows.data ?? []);
  }

  openForm() {
    this.error.set('');
    this.message.set('');
    this.form.set({
      vehicle_id: '',
      maintenance_type: '',
      maintenance_date: new Date().toISOString().slice(0, 10),
      status: 'in_progress',
      description: '',
    });
  }

  async save() {
    const value = this.form();
    if (!value?.vehicle_id || !value.maintenance_type?.trim()) {
      this.error.set('Véhicule et type sont obligatoires.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const result = await this.portal.addMaintenance({
      vehicle_id: value.vehicle_id,
      maintenance_type: value.maintenance_type.trim(),
      maintenance_date: value.maintenance_date,
      status: value.status,
      description: value.description || null,
    });
    this.saving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.form.set(null);
    this.message.set('Maintenance déclarée. Le véhicule est indisponible à la réservation.');
    await this.load();
  }

  async complete(item: any) {
    this.error.set('');
    this.message.set('');
    const result = await this.portal.completeMaintenance(item.id);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.message.set('Maintenance clôturée. Le véhicule redevient disponible.');
    await this.load();
  }
}
