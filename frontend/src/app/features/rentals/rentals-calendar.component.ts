import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  input,
  output,
} from '@angular/core';
import { Calendar } from '@fullcalendar/core';
import frLocale from '@fullcalendar/core/locales/fr';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';

/** Couleur par statut, alignée sur les badges de la liste des locations. */
const statusColors: Record<string, string> = {
  pending: '#d58b00',
  active: '#0b6efd',
  overdue: '#dc3545',
  completed: '#198754',
};

/** Calendrier des locations : une barre du départ au retour prévu, par véhicule. */
@Component({
  selector: 'app-rentals-calendar',
  standalone: true,
  template: `
    <div class="calendar-legend small text-muted mb-2">
      <span><i style="background: #d58b00"></i>En attente</span>
      <span><i style="background: #0b6efd"></i>En cours</span>
      <span><i style="background: #dc3545"></i>En retard</span>
      <span><i style="background: #198754"></i>Terminée</span>
    </div>
    <div #host class="rentals-calendar"></div>
  `,
  styles: `
    .rentals-calendar {
      min-height: 650px;
    }
    :host ::ng-deep .rentals-calendar .fc-event {
      white-space: normal;
      cursor: pointer;
    }
    .calendar-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .calendar-legend i {
      display: inline-block;
      width: 0.75rem;
      height: 0.75rem;
      border-radius: 3px;
      margin-right: 0.35rem;
      vertical-align: -1px;
    }
    @media (max-width: 760px) {
      .rentals-calendar {
        min-height: 520px;
        font-size: 0.78rem;
      }
      :host ::ng-deep .fc-toolbar {
        flex-wrap: wrap;
        gap: 0.5rem;
      }
    }
  `,
})
export class RentalsCalendarComponent implements AfterViewInit, OnDestroy {
  rentals = input<any[]>([]);
  select = output<any>();
  @ViewChild('host') host?: ElementRef<HTMLElement>;
  private calendar?: Calendar;

  constructor() {
    effect(() => this.refresh(this.rentals()));
  }

  ngAfterViewInit() {
    if (!this.host) return;
    this.calendar = new Calendar(this.host.nativeElement, {
      plugins: [dayGridPlugin, timeGridPlugin],
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
      eventClick: (info) => this.select.emit(info.event.extendedProps['rental']),
    });
    this.calendar.render();
    this.refresh(this.rentals());
  }

  ngOnDestroy() {
    this.calendar?.destroy();
  }

  private refresh(rentals: any[]) {
    if (!this.calendar) return;
    this.calendar.removeAllEvents();
    this.calendar.addEventSource(
      rentals
        .filter((rental) => rental.status !== 'cancelled')
        .map((rental) => ({
          id: rental.id,
          title: `${rental.vehicles?.registration_number ?? 'Véhicule'} · ${rental.clients?.first_name ?? ''} ${rental.clients?.last_name ?? ''}`,
          start: rental.departure_date,
          end: rental.return_date,
          color: statusColors[rental.status] ?? '#6c757d',
          extendedProps: { rental },
        })),
    );
  }
}
