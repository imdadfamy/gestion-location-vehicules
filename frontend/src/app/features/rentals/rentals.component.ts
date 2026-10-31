import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ActorNamesService } from '../../core/actor-names.service';
import { DigitsOnlyDirective } from '../../shared/digits-only.directive';
import { ClientsService } from '../../core/data/clients.service';
import { RentalsService } from '../../core/data/rentals.service';
import { StorageService } from '../../core/data/storage.service';
import { VehiclesService } from '../../core/data/vehicles.service';
import { RentalsCalendarComponent } from './rentals-calendar.component';

@Component({
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink, DigitsOnlyDirective, RentalsCalendarComponent],
  styleUrl: './rentals.component.scss',
  templateUrl: './rentals.component.html',
})
export class RentalsComponent implements OnInit {
  rows = signal<any[]>([]);
  vehicles = signal<any[]>([]);
  matches = signal<any[]>([]);
  documents = signal<any[]>([]);
  history = signal<any[]>([]);
  selectedPayments = signal<any[]>([]);
  closureBlockers = signal<string[]>([]);
  /** Affichage mémorisé pour l'utilisateur (préférence locale, sans incidence métier). */
  view = signal<'list' | 'calendar'>(this.storedView());
  private storedView(): 'list' | 'calendar' {
    try {
      return globalThis.localStorage?.getItem('rentals-view') === 'calendar' ? 'calendar' : 'list';
    } catch {
      return 'list';
    }
  }
  setView(view: 'list' | 'calendar') {
    this.view.set(view);
    try {
      localStorage.setItem('rentals-view', view);
    } catch {
      // Stockage indisponible (navigation privée) : la préférence n'est simplement pas gardée.
    }
  }
  wizard = signal(false);
  step = signal(1);
  editingId = signal<string | null>(null);
  selected = signal<any>(null);
  clientForm = signal<any>(null);
  rentalForm = signal<any>(null);
  loading = signal(false);
  saving = signal(false);
  paymentSaving = signal(false);
  error = signal('');
  message = signal('');
  search = '';
  filter = '';
  private files = new Map<string, File>();
  readonly statuses = ['pending', 'active', 'overdue', 'completed'];
  constructor(
    public auth: AuthService,
    private actors: ActorNamesService,
    private rentals: RentalsService,
    private clients: ClientsService,
    private vehiclesData: VehiclesService,
    private storage: StorageService,
  ) {}
  ngOnInit() {
    void this.load();
  }
  clearFeedback() {
    this.error.set('');
    this.message.set('');
  }
  async refreshStatuses() {
    const result = await this.rentals.refreshOverdue();
    if (result.error) this.error.set(this.auth.errorMessage(result.error));
  }
  async load() {
    this.loading.set(true);
    this.clearFeedback();
    await this.refreshStatuses();
    const result = await this.rentals.list(this.filter);
    let data = result.data ?? [];
    if (this.search) {
      const term = this.search.toLowerCase();
      data = data.filter((item) =>
        (
          (item.clients?.first_name ?? '') +
          ' ' +
          (item.clients?.last_name ?? '') +
          ' ' +
          (item.vehicles?.registration_number ?? '')
        )
          .toLowerCase()
          .includes(term),
      );
    }
    this.rows.set(
      data.map((item) => ({
        ...item,
        payment_received:
          (item.payments ?? []).reduce(
            (sum: any, payment: any) => sum + Number(payment.amount ?? 0),
            0,
          ) >= Number(item.rental_price ?? 0),
      })),
    );
    if (result.error) this.error.set(this.auth.errorMessage(result.error));
    this.loading.set(false);
  }
  async loadVehicles() {
    const result = await this.vehiclesData.listAvailable();
    this.vehicles.set(result.data ?? []);
    if (result.error) this.error.set(this.auth.errorMessage(result.error));
  }
  openNew() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.clearFeedback();
    this.selected.set(null);
    this.documents.set([]);
    this.history.set([]);
    this.selectedPayments.set([]);
    this.files.clear();
    this.matches.set([]);
    this.editingId.set(null);
    this.clientForm.set({
      first_name: '',
      last_name: '',
      phone: '',
      email: '',
      id_document_number: '',
      driving_license_number: '',
      driving_license_expiry_date: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      address: '',
      residence: '',
      id: null,
    });
    this.rentalForm.set({
      vehicle_id: '',
      departure_date: '',
      return_date: '',
      duration_days: 0,
      departure_location: '',
      return_location: '',
      rental_price: 0,
      deposit_amount: 0,
      driving_zone: '',
      payment_received: null,
    });
    this.step.set(1);
    this.wizard.set(true);
    void this.loadVehicles();
  }
  closeWizard() {
    this.wizard.set(false);
    this.files.clear();
    this.matches.set([]);
    this.editingId.set(null);
  }
  async findMatches() {
    const phone = this.clientForm()?.phone?.trim();
    if (!phone) {
      this.error.set('Saisissez le téléphone avant de rechercher un client.');
      return;
    }
    const result = await this.clients.findByPhone(phone);
    this.matches.set(result.data ?? []);
    if (result.error) this.error.set(this.auth.errorMessage(result.error));
  }
  useClient(client: any) {
    this.clientForm.set({ ...client });
    this.matches.set([]);
    this.message.set(
      'Client existant sélectionné. Ses données restent modifiables tant que la location est en attente.',
    );
  }
  chooseFile(type: string, event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.files.set(type, file);
  }
  fileName(type: string) {
    return this.files.get(type)?.name ?? '';
  }
  validClient() {
    const c = this.clientForm();
    return !!(
      c?.first_name?.trim() &&
      c?.last_name?.trim() &&
      c?.phone?.trim() &&
      c?.id_document_number?.trim() &&
      c?.driving_license_number?.trim() &&
      c?.driving_license_expiry_date &&
      c?.emergency_contact_name?.trim() &&
      c?.emergency_contact_phone?.trim() &&
      c?.address?.trim()
    );
  }
  next() {
    this.clearFeedback();
    if (!this.validClient()) {
      this.error.set('Veuillez renseigner toutes les informations client obligatoires.');
      return;
    }
    this.step.set(2);
  }
  priceFromVehicle() {
    const vehicle = this.vehicles().find((item) => item.id === this.rentalForm()?.vehicle_id);
    if (vehicle)
      this.rentalForm.set({
        ...this.rentalForm(),
        rental_price: vehicle.rental_price ?? 0,
        deposit_amount: vehicle.deposit_amount ?? 0,
      });
  }
  duration() {
    const form = this.rentalForm();
    if (form?.departure_date && form.return_date) {
      const days =
        (new Date(form.return_date).getTime() - new Date(form.departure_date).getTime()) / 86400000;
      this.rentalForm.set({ ...form, duration_days: days > 0 ? days : 0 });
    }
  }
  durationLabel() {
    const value = Number(this.rentalForm()?.duration_days ?? 0);
    if (!value) return '—';
    return value === 1
      ? '1 jour'
      : value.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' jours';
  }
  validRental() {
    const r = this.rentalForm();
    return !!(
      r?.vehicle_id &&
      r?.departure_date &&
      r?.return_date &&
      r?.departure_location?.trim() &&
      r?.return_location?.trim() &&
      r.payment_received !== null &&
      r.payment_received !== undefined &&
      Number(r.rental_price) >= 0 &&
      Number(r.deposit_amount ?? 0) >= 0 &&
      new Date(r.return_date) > new Date(r.departure_date)
    );
  }
  async saveWizard() {
    this.clearFeedback();
    if (!this.validRental()) {
      this.error.set(
        'Veuillez renseigner les informations location obligatoires, choisir le paiement reçu et vérifier les dates.',
      );
      return;
    }
    this.saving.set(true);
    const client = this.clientForm(),
      rental = this.rentalForm();
    if (this.editingId()) {
      const clientUpdate = await this.clients.update(client.id, this.clientPayload(client));
      const rentalUpdate = clientUpdate.error
        ? null
        : await this.rentals.update(this.editingId()!, this.rentalPayload(rental));
      this.saving.set(false);
      if (clientUpdate.error || rentalUpdate?.error) {
        this.error.set(this.auth.errorMessage(clientUpdate.error ?? rentalUpdate?.error));
        return;
      }
      await this.uploadDocuments(client.id);
      this.closeWizard();
      await this.load();
      this.message.set('Location et informations client mises à jour.');
      return;
    }
    const result = await this.rentals.createFromWizard({
      target_existing_client_id: client.id || null,
      target_first_name: client.first_name,
      target_last_name: client.last_name,
      target_phone: client.phone,
      target_email: client.email || null,
      target_id_document_number: client.id_document_number,
      target_driving_license_number: client.driving_license_number,
      target_driving_license_expiry_date: client.driving_license_expiry_date,
      target_emergency_contact_name: client.emergency_contact_name,
      target_emergency_contact_phone: client.emergency_contact_phone,
      target_address: client.address,
      target_residence: client.residence || null,
      target_vehicle_id: rental.vehicle_id,
      target_departure_date: new Date(rental.departure_date).toISOString(),
      target_return_date: new Date(rental.return_date).toISOString(),
      target_departure_location: rental.departure_location,
      target_return_location: rental.return_location,
      target_rental_price: Number(rental.rental_price),
      target_deposit_amount: Number(rental.deposit_amount || 0),
      target_driving_zone: rental.driving_zone || null,
      target_payment_received: rental.payment_received,
    });
    this.saving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    const data = result.data as any;
    const documentsOk = await this.uploadDocuments(data.client_id);
    this.closeWizard();
    // load() efface les messages : on affiche le résultat après le rechargement.
    await this.load();
    this.message.set(
      documentsOk
        ? 'Location créée avec succès.'
        : 'Location créée, mais une ou plusieurs pièces n’ont pas pu être envoyées.',
    );
  }
  clientPayload(c: any) {
    return {
      first_name: c.first_name.trim(),
      last_name: c.last_name.trim(),
      phone: c.phone.trim(),
      email: c.email || null,
      id_document_number: c.id_document_number.trim(),
      driving_license_number: c.driving_license_number.trim(),
      driving_license_expiry_date: c.driving_license_expiry_date,
      emergency_contact_name: c.emergency_contact_name.trim(),
      emergency_contact_phone: c.emergency_contact_phone.trim(),
      address: c.address.trim(),
      residence: c.residence || null,
    };
  }
  rentalPayload(r: any) {
    return {
      vehicle_id: r.vehicle_id,
      departure_date: new Date(r.departure_date).toISOString(),
      return_date: new Date(r.return_date).toISOString(),
      duration_days: Number(r.duration_days),
      departure_location: r.departure_location.trim(),
      return_location: r.return_location.trim(),
      rental_price: Number(r.rental_price),
      deposit_amount: Number(r.deposit_amount || 0),
      driving_zone: r.driving_zone || null,
    };
  }
  async uploadDocuments(clientId: string) {
    let success = true;
    for (const [type, file] of this.files) {
      if (await this.clients.uploadDocument(clientId, type, file)) success = false;
    }
    return success;
  }
  async detail(rental: any) {
    this.clearFeedback();
    await this.refreshStatuses();
    const [latest, history, payments, blockers] = await Promise.all([
      this.rentals.get(rental.id),
      this.rentals.statusHistory(rental.id),
      this.rentals.payments(rental.id),
      this.rentals.closureBlockers(rental.id),
    ]);
    this.selected.set(latest.data ?? rental);
    this.history.set(history.data ?? []);
    this.selectedPayments.set(payments.data ?? []);
    this.closureBlockers.set(blockers.data ?? []);
    await this.actors.load([
      ...(history.data ?? []).map((item) => item.changed_by),
      ...(payments.data ?? []).map((item) => item.recorded_by),
    ]);
    if (latest.data?.client_id) {
      const docs = await this.clients.documents(latest.data.client_id);
      this.documents.set(docs.data ?? []);
      if (docs.error) this.error.set(this.auth.errorMessage(docs.error));
    }
    if (latest.error || history.error || payments.error)
      this.error.set(this.auth.errorMessage(latest.error ?? history.error ?? payments.error));
  }
  blockerLabel(code: string) {
    return (
      (
        {
          balance: 'Solde de paiement restant à encaisser',
          deposit: 'Caution à recevoir puis à restituer ou retenir',
          incidents: 'Incident lié encore ouvert',
        } as Record<string, string>
      )[code] ?? code
    );
  }
  closeDetail() {
    this.closureBlockers.set([]);
    this.selected.set(null);
    this.documents.set([]);
    this.history.set([]);
    this.selectedPayments.set([]);
  }
  receivedAmount() {
    return this.selectedPayments().reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  }
  paymentReceived() {
    return (
      !!this.selected() &&
      this.receivedAmount() >= Number(this.selected().rental_price ?? 0) &&
      Number(this.selected().rental_price ?? 0) >= 0
    );
  }
  canEdit() {
    return (
      this.auth.can('rentals', 'update') &&
      this.selected()?.status === 'pending' &&
      !this.paymentReceived()
    );
  }
  async openEdit(rental: any) {
    this.clearFeedback();
    this.selected.set(null);
    this.documents.set([]);
    this.history.set([]);
    this.selectedPayments.set([]);
    await this.loadVehicles();
    const client = rental.clients ?? {};
    this.clientForm.set({ ...client });
    this.rentalForm.set({
      ...rental,
      departure_date: this.localDate(rental.departure_date),
      return_date: this.localDate(rental.return_date),
      payment_received: false,
    });
    this.editingId.set(rental.id);
    this.files.clear();
    this.step.set(1);
    this.wizard.set(true);
  }
  localDate(value: string) {
    return value ? new Date(value).toISOString().slice(0, 16) : '';
  }
  async togglePayment(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const rental = this.selected();
    if (!rental) return;
    this.clearFeedback();
    if (!checked) {
      this.error.set(
        'Un paiement déjà enregistré ne peut pas être remis à Non reçu depuis cette fiche.',
      );
      return;
    }
    if (this.paymentReceived()) {
      this.message.set('Le paiement total est déjà confirmé.');
      return;
    }
    this.paymentSaving.set(true);
    const result = await this.rentals.confirmPayment(rental.id);
    this.paymentSaving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    await this.detail(rental);
    await this.load();
    this.message.set(
      'Paiement total reçu et enregistré. Les informations sont maintenant verrouillées.',
    );
  }
  async openDocument(document: any) {
    const result = await this.storage.signedUrl('rental-documents', document.storage_path);
    if (result.error) this.error.set(this.auth.errorMessage(result.error));
    else window.open(result.data.signedUrl, '_blank', 'noopener');
  }
  actorName(id: string | null | undefined) {
    return this.actors.label(id);
  }
  money(value: unknown) {
    return (
      Number(value ?? 0)
        .toLocaleString('fr-FR')
        .replace(/\\u202f/g, ' ') + ' FCFA'
    );
  }
  statusLabel(status: string | undefined) {
    return (
      (
        {
          pending: 'En attente',
          active: 'En cours',
          overdue: 'En retard',
          completed: 'Terminée',
        } as Record<string, string>
      )[status ?? ''] ??
      status ??
      ''
    );
  }
  statusTone(status: string) {
    return (
      (
        {
          pending: 'warning',
          active: 'primary',
          overdue: 'danger',
          completed: 'success',
        } as Record<string, string>
      )[status] ?? 'secondary'
    );
  }
}
