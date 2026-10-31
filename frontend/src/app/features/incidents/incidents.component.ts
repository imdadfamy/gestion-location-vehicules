import { Component, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ClientsService } from '../../core/data/clients.service';
import { IncidentsService } from '../../core/data/incidents.service';
import { VehiclesService } from '../../core/data/vehicles.service';
import { toLocalInput } from '../../core/data/form-values';

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
    private incidents: IncidentsService,
    private vehiclesData: VehiclesService,
    private clientsData: ClientsService,
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
    const result = await this.incidents.list();
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
      this.vehiclesData.options(),
      this.incidents.rentalOptions(),
      this.clientsData.options(),
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
      incident_date: toLocalInput(value.incident_date),
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
    const result = await this.incidents.save(payload);
    if (result.error) {
      this.saving.set(false);
      return this.fail(result.error);
    }
    for (const file of this.files) {
      const failure = await this.incidents.attachDocument(result.data.id, file);
      if (failure) {
        this.saving.set(false);
        return this.fail(
          failure.step === 'upload'
            ? `Incident enregistré, mais document non envoyé : ${this.auth.errorMessage(failure.error)}`
            : `Document non référencé : ${this.auth.errorMessage(failure.error)}`,
        );
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
