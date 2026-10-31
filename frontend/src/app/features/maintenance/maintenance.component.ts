import { Component, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth.service';

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
    const result = await this.auth
      .supabase()
      .from('vehicle_maintenance')
      .select('*,vehicles(registration_number,make,model)')
      .order('maintenance_date', { ascending: false });
    this.loading.set(false);
    if (result.error) return this.fail(result.error);
    this.rows.set(result.data ?? []);
  }
  async openForm(vehicleId = '') {
    const result = await this.auth
      .supabase()
      .from('vehicles')
      .select('id,registration_number,make,model')
      .order('registration_number');
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
    const payload = { ...form };
    delete payload.vehicles;
    const result = form.id
      ? await this.auth
          .supabase()
          .from('vehicle_maintenance')
          .update(payload)
          .eq('id', form.id)
          .select()
          .single()
      : await this.auth.supabase().from('vehicle_maintenance').insert(payload).select().single();
    if (result.error) {
      this.saving.set(false);
      return this.fail(result.error);
    }
    if (this.file) {
      const path = `maintenance/${result.data.id}/${this.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const upload = await this.auth
        .supabase()
        .storage.from('rental-documents')
        .upload(path, this.file, { upsert: false });
      if (upload.error) {
        this.saving.set(false);
        return this.fail(
          `Maintenance enregistrée, mais facture non envoyée : ${this.auth.errorMessage(upload.error)}`,
        );
      }
      const updated = await this.auth
        .supabase()
        .from('vehicle_maintenance')
        .update({ invoice_storage_path: path })
        .eq('id', result.data.id);
      if (updated.error) {
        this.saving.set(false);
        return this.fail(updated.error);
      }
    }
    this.saving.set(false);
    this.form.set(null);
    this.message.set('Maintenance enregistrée.');
    await this.load();
  }
}
