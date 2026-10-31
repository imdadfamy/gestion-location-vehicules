import { Component, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { MaintenanceService } from '../../core/data/maintenance.service';
import { VehiclesService } from '../../core/data/vehicles.service';

@Component({
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
  templateUrl: './maintenance.component.html',
})
export class MaintenanceComponent implements OnInit {
  rows = signal<any[]>([]);
  vehicles = signal<any[]>([]);
  form = signal<any>(null);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  message = signal('');
  private file?: File;
  constructor(
    public auth: AuthService,
    private route: ActivatedRoute,
    private maintenance: MaintenanceService,
    private vehiclesData: VehiclesService,
  ) {}
  async ngOnInit() {
    await this.load();
    const vehicle = this.route.snapshot.queryParamMap.get('vehicle');
    if (vehicle && this.auth.can('maintenance', 'create')) await this.openForm(vehicle);
  }
  private fail(value: unknown) {
    this.error.set(this.auth.errorMessage(value));
    this.message.set('');
  }
  async load() {
    this.loading.set(true);
    const result = await this.maintenance.list();
    this.loading.set(false);
    if (result.error) return this.fail(result.error);
    this.rows.set(result.data ?? []);
  }
  async openForm(vehicleId = '') {
    const result = await this.vehiclesData.options();
    if (result.error) return this.fail(result.error);
    this.vehicles.set(result.data ?? []);
    this.file = undefined;
    this.form.set({
      vehicle_id: vehicleId,
      maintenance_type: '',
      maintenance_date: new Date().toISOString().slice(0, 10),
      next_maintenance_date: null,
      mileage: null,
      cost: 0,
      provider_name: '',
      description: '',
      status: 'planned',
    });
  }
  async edit(value: any) {
    if (!this.auth.can('maintenance', 'update')) return;
    await this.openForm();
    this.form.set({
      ...value,
      maintenance_date: value.maintenance_date?.slice(0, 10),
      next_maintenance_date: value.next_maintenance_date?.slice(0, 10),
    });
  }
  chooseFile(event: Event) {
    this.file = (event.target as HTMLInputElement).files?.[0];
  }
  due(value: any) {
    return (
      value.status !== 'completed' &&
      value.next_maintenance_date &&
      new Date(value.next_maintenance_date) <= new Date(Date.now() + 30 * 86400000)
    );
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
  async save() {
    const form = this.form();
    if (
      !form?.vehicle_id ||
      !form.maintenance_type ||
      !form.maintenance_date ||
      Number(form.cost) < 0
    )
      return this.fail('Véhicule, type, date et coût valide sont requis.');
    this.saving.set(true);
    const result = await this.maintenance.save(form);
    if (result.error) {
      this.saving.set(false);
      return this.fail(result.error);
    }
    if (this.file) {
      const failure = await this.maintenance.attachInvoice(result.data.id, this.file);
      if (failure) {
        this.saving.set(false);
        return this.fail(
          failure.step === 'upload'
            ? `Maintenance enregistrée, mais facture non envoyée : ${this.auth.errorMessage(failure.error)}`
            : failure.error,
        );
      }
    }
    this.saving.set(false);
    this.form.set(null);
    this.message.set('Maintenance enregistrée.');
    await this.load();
  }
}
