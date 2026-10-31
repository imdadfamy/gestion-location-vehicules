import { Component, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
  templateUrl: './incidents.component.html',
})
export class IncidentsComponent implements OnInit {
  rows = signal<any[]>([]);
  filtered = signal<any[]>([]);
  vehicles = signal<any[]>([]);
  rentals = signal<any[]>([]);
  clients = signal<any[]>([]);
  form = signal<any>(null);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  message = signal('');
  search = '';
  statusFilter = '';
  statuses = ['open', 'in_progress', 'resolved', 'closed'];
  private files: File[] = [];
  constructor(
    public auth: AuthService,
    private route: ActivatedRoute,
  ) {}
  async ngOnInit() {
    await this.load();
    const vehicle = this.route.snapshot.queryParamMap.get('vehicle');
    const rental = this.route.snapshot.queryParamMap.get('rental');
    if ((vehicle || rental) && this.auth.can('incidents', 'create'))
      await this.openForm(vehicle ?? '', rental ?? '');
  }
  private fail(value: unknown) {
    this.error.set(this.auth.errorMessage(value));
    this.message.set('');
  }
  async load() {
    this.loading.set(true);
    const result = await this.auth
      .supabase()
      .from('incidents')
      .select('*,vehicles(registration_number),clients(first_name,last_name)')
      .order('incident_date', { ascending: false });
    this.loading.set(false);
    if (result.error) return this.fail(result.error);
    this.rows.set(result.data ?? []);
    this.filterRows();
  }
  filterRows() {
    const term = this.search.toLowerCase();
    this.filtered.set(
      this.rows().filter(
        (item) =>
          (!this.statusFilter || item.status === this.statusFilter) &&
          (!term ||
            `${item.description} ${item.vehicles?.registration_number ?? ''} ${item.clients?.first_name ?? ''} ${item.clients?.last_name ?? ''}`
              .toLowerCase()
              .includes(term)),
      ),
    );
  }
  async openForm(vehicleId = '', rentalId = '') {
    const [vehicles, rentals, clients] = await Promise.all([
      this.auth
        .supabase()
        .from('vehicles')
        .select('id,registration_number')
        .order('registration_number'),
      this.auth
        .supabase()
        .from('rentals')
        .select(
          'id,vehicle_id,client_id,vehicles(registration_number),clients(first_name,last_name)',
        )
        .order('created_at', { ascending: false }),
      this.auth.supabase().from('clients').select('id,first_name,last_name').order('last_name'),
    ]);
    const failure = vehicles.error ?? rentals.error ?? clients.error;
    if (failure) return this.fail(failure);
    this.vehicles.set(vehicles.data ?? []);
    this.rentals.set(rentals.data ?? []);
    this.clients.set(clients.data ?? []);
    this.files = [];
    this.form.set({
      vehicle_id: vehicleId || null,
      rental_id: rentalId || null,
      client_id: null,
      incident_type: 'breakdown',
      description: '',
      incident_date: this.localDateTime(),
      cost: 0,
      status: 'open',
    });
  }
  async edit(value: any) {
    if (!this.auth.can('incidents', 'update')) return;
    await this.openForm();
    this.form.set({
      ...value,
      incident_date: new Date(value.incident_date).toISOString().slice(0, 16),
    });
  }
  chooseFiles(event: Event) {
    this.files = Array.from((event.target as HTMLInputElement).files ?? []);
  }
  label(type: string) {
    return (
      (
        {
          breakdown: 'Panne',
          accident: 'Accident',
          damage: 'Dommage',
          infraction: 'Infraction',
          delay: 'Retard',
          other: 'Autre',
        } as Record<string, string>
      )[type] ?? type
    );
  }
  statusLabel(status: string) {
    return (
      (
        {
          open: 'Ouvert',
          in_progress: 'En cours',
          resolved: 'Résolu',
          closed: 'Clôturé',
        } as Record<string, string>
      )[status] ?? status
    );
  }
  statusTone(status: string) {
    return (
      (
        {
          open: 'danger',
          in_progress: 'warning',
          resolved: 'success',
          closed: 'secondary',
        } as Record<string, string>
      )[status] ?? 'secondary'
    );
  }
  async save() {
    const form = this.form();
    if (!form?.description?.trim() || Number(form.cost) < 0)
      return this.fail('Description et coût valide sont requis.');
    this.saving.set(true);
    const payload = { ...form, incident_date: new Date(form.incident_date).toISOString() };
    const result = form.id
      ? await this.auth
          .supabase()
          .from('incidents')
          .update(payload)
          .eq('id', form.id)
          .select()
          .single()
      : await this.auth.supabase().from('incidents').insert(payload).select().single();
    if (result.error) {
      this.saving.set(false);
      return this.fail(result.error);
    }
    for (const file of this.files) {
      const path = `incidents/${result.data.id}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const uploaded = await this.auth
        .supabase()
        .storage.from('rental-documents')
        .upload(path, file, { upsert: false });
      if (uploaded.error) {
        this.saving.set(false);
        return this.fail(
          `Incident enregistré, mais document non envoyé : ${this.auth.errorMessage(uploaded.error)}`,
        );
      }
      const document = await this.auth.supabase().from('incident_documents').insert({
        incident_id: result.data.id,
        document_name: file.name,
        storage_path: path,
        mime_type: file.type,
      });
      if (document.error) {
        this.saving.set(false);
        return this.fail(`Document non référencé : ${this.auth.errorMessage(document.error)}`);
      }
    }
    this.saving.set(false);
    this.form.set(null);
    this.message.set('Incident enregistré.');
    await this.load();
  }
  private localDateTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }
}
