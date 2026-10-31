import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Calendar } from '@fullcalendar/core';
import frLocale from '@fullcalendar/core/locales/fr';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { AuthService } from '../../core/auth.service';
import { ClientsService } from '../../core/data/clients.service';
import { ReservationsService } from '../../core/data/reservations.service';
import { VehiclesService } from '../../core/data/vehicles.service';
import { DigitsOnlyDirective } from '../../shared/digits-only.directive';

@Component({
  standalone: true,
  imports: [FormsModule, DatePipe, DigitsOnlyDirective],
  styleUrl: './reservations.component.scss',
  templateUrl: './reservations.component.html',
})
export class ReservationsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('calendarHost') calendarHost?: ElementRef<HTMLElement>;
  calendar?: Calendar;
  rows = signal<any[]>([]);
  vehicles = signal<any[]>([]);
  form = signal<any>(null);
  selected = signal<any>(null);
  dispatch = signal<any>(null);
  recipients = signal<any[]>([]);
  selectedRecipient = signal<any>(null);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  message = signal('');
  query = '';
  vehicleFilter = '';
  statusFilter = '';
  recipientQuery = '';
  constructor(
    public auth: AuthService,
    private router: Router,
    private reservations: ReservationsService,
    private vehiclesData: VehiclesService,
    private clientsData: ClientsService,
  ) {}
  ngOnInit() {
    void this.load();
  }
  ngAfterViewInit() {
    this.createCalendar();
  }
  ngOnDestroy() {
    this.calendar?.destroy();
  }
  async load() {
    this.loading.set(true);
    const [vehicles, reservations] = await Promise.all([
      this.vehiclesData.options(),
      this.reservations.list(),
    ]);
    this.loading.set(false);
    this.vehicles.set(vehicles.data ?? []);
    this.rows.set(reservations.data ?? []);
    this.error.set(
      vehicles.error
        ? this.auth.errorMessage(vehicles.error)
        : reservations.error
          ? this.auth.errorMessage(reservations.error)
          : '',
    );
    this.refresh();
  }
  visible() {
    return this.filtered(true);
  }
  calendarItems() {
    return this.filtered(false);
  }
  filtered(withStatus: boolean) {
    const term = this.query.trim().toLowerCase();
    return this.rows().filter(
      (item) =>
        (!withStatus ||
          !this.statusFilter ||
          (this.statusFilter === 'active'
            ? ['pending', 'validated'].includes(item.status)
            : item.status === this.statusFilter)) &&
        (!this.vehicleFilter || item.vehicle_id === this.vehicleFilter) &&
        (!term ||
          (
            item.first_name +
            ' ' +
            item.last_name +
            ' ' +
            item.phone +
            ' ' +
            (item.vehicles?.registration_number ?? '')
          )
            .toLowerCase()
            .includes(term)),
    );
  }
  refresh() {
    if (!this.calendar) return;
    this.calendar.removeAllEvents();
    this.calendar.addEventSource(
      this.calendarItems().map((item) => ({
        id: item.id,
        title:
          (item.vehicles?.registration_number ?? 'Véhicule') +
          ' · ' +
          item.first_name +
          ' ' +
          item.last_name +
          ' · ' +
          item.phone,
        start: item.planned_departure_date,
        end: item.planned_return_date,
        color:
          item.status === 'pending'
            ? '#d58b00'
            : item.status === 'validated'
              ? '#0b9cac'
              : item.status === 'finalized'
                ? '#198754'
                : '#6c757d',
        extendedProps: { reservation: item },
      })),
    );
  }
  createCalendar() {
    if (!this.calendarHost) return;
    this.calendar = new Calendar(this.calendarHost.nativeElement, {
      plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
      initialView: 'dayGridMonth',
      locales: [frLocale],
      locale: 'fr',
      firstDay: 1,
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay',
      },
      buttonText: { today: 'Aujourd’hui', month: 'Mois', week: 'Semaine', day: 'Jour' },
      height: 'auto',
      eventClick: (info) => this.show(info.event.extendedProps['reservation']),
    });
    this.calendar.render();
    this.refresh();
  }
  openNew() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.error.set('');
    this.message.set('');
    this.selected.set(null);
    this.form.set({
      first_name: '',
      last_name: '',
      phone: '',
      vehicle_id: '',
      planned_departure_date: '',
      planned_return_date: '',
      observation: '',
    });
    setTimeout(
      () =>
        document
          .querySelector('.form-card')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      0,
    );
  }
  openEdit(item: any) {
    this.error.set('');
    this.message.set('');
    this.form.set({
      ...item,
      planned_departure_date: this.local(item.planned_departure_date),
      planned_return_date: this.local(item.planned_return_date),
    });
  }
  local(value: string) {
    return value ? new Date(value).toISOString().slice(0, 16) : '';
  }
  async save() {
    const value = this.form();
    if (
      !value?.first_name?.trim() ||
      !value?.last_name?.trim() ||
      !value?.phone?.trim() ||
      !value?.vehicle_id ||
      !value?.planned_departure_date ||
      !value?.planned_return_date
    ) {
      this.error.set('Prénom, nom, téléphone, véhicule et période sont obligatoires.');
      return;
    }
    this.saving.set(true);
    const payload = {
      first_name: value.first_name.trim(),
      last_name: value.last_name.trim(),
      phone: value.phone.trim(),
      vehicle_id: value.vehicle_id,
      planned_departure_date: new Date(value.planned_departure_date).toISOString(),
      planned_return_date: new Date(value.planned_return_date).toISOString(),
      observation: value.observation || null,
    };
    const result = await this.reservations.save(value.id, payload);
    this.saving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.form.set(null);
    this.message.set('Réservation enregistrée.');
    await this.load();
  }
  show(item: any) {
    this.selected.set(item);
    setTimeout(
      () =>
        document
          .querySelector('.form-card')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      0,
    );
  }
  async validate(item: any) {
    const result = await this.reservations.validate(item.id);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.message.set(
      'Réservation validée. Elle reste bloquante jusqu’à sa finalisation ou son annulation.',
    );
    await this.load();
  }
  finalize(item: any) {
    this.error.set('');
    this.message.set('');
    this.recipients.set([]);
    this.selectedRecipient.set(null);
    this.recipientQuery = '';
    this.dispatch.set(item);
  }
  prepareDispatch() {
    const item = this.dispatch();
    this.dispatch.set(null);
    if (item)
      void this.router.navigate(['/reservation-client'], { queryParams: { reservation: item.id } });
  }
  async findRecipient() {
    const term = this.recipientQuery.trim();
    if (!term) {
      this.recipients.set([]);
      return;
    }
    const result = await this.clientsData.searchPortalAccounts(term);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.recipients.set(result.data ?? []);
  }
  chooseRecipient(client: any) {
    this.selectedRecipient.set(client);
    this.recipients.set([]);
    this.recipientQuery = `${client.first_name} ${client.last_name} — ${client.phone}`;
  }
  isOnlineReservation(item: any) {
    return !!item?.client_profile_id;
  }
  async sendToClient() {
    const item = this.dispatch(),
      recipient = this.selectedRecipient();
    if (!item) return;
    if (!this.isOnlineReservation(item) && !recipient?.profile_id) {
      this.error.set('Recherchez et sélectionnez le compte client qui doit recevoir le contrat.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const result = this.isOnlineReservation(item)
      ? await this.reservations.sendToOwner(item.id)
      : await this.reservations.sendToClient(item.id, recipient.profile_id);
    this.saving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.dispatch.set(null);
    this.message.set(
      'Dossier envoyé au client. La location et le contrat seront créés dès qu’il aura complété son dossier et signé depuis son espace client.',
    );
    await this.load();
  }
  async cancel(item: any) {
    if (!confirm('Annuler la réservation de ' + item.first_name + ' ' + item.last_name + ' ?'))
      return;
    const reason = prompt('Motif d’annulation (facultatif)') ?? '';
    const result = await this.reservations.cancel(item.id, reason);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.message.set('Réservation annulée. Le véhicule est immédiatement libéré.');
    this.selected.set(null);
    await this.load();
  }
  label(item: any) {
    if (item.status === 'validated' && item.rental_id) return 'Contrat en attente de signatures';
    if (item.status === 'validated' && item.client_contract_sent_at)
      return 'Dossier envoyé au client';
    return (
      (
        {
          pending: 'En attente',
          validated: 'Validée',
          finalized: 'Finalisée',
          cancelled: 'Annulée',
        } as Record<string, string>
      )[item.status] ?? item.status
    );
  }
  tone(status: string) {
    return (
      (
        {
          pending: 'warning',
          validated: 'info',
          finalized: 'success',
          cancelled: 'secondary',
        } as Record<string, string>
      )[status] ?? 'secondary'
    );
  }
}
