'use client';

import FullCalendar from '@fullcalendar/react';
import frLocale from '@fullcalendar/core/locales/fr';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import type { EventInput } from '@fullcalendar/core';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * Calendrier du back-office (FullCalendar, en français, semaine du lundi). Les couleurs
 * suivent le thème clair/sombre via les variables `--fc-*` de globals.css.
 */
export function StaffCalendar<T>({
  events,
  onSelect,
}: {
  events: (EventInput & { extendedProps: { item: T } })[];
  onSelect: (item: T) => void;
}) {
  const mobile = useIsMobile();
  return (
    <div className="staff-calendar">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locales={[frLocale]}
        locale="fr"
        firstDay={1}
        headerToolbar={
          mobile
            ? { left: 'prev,next', center: 'title', right: 'today' }
            : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }
        }
        buttonText={{ today: 'Aujourd’hui', month: 'Mois', week: 'Semaine', day: 'Jour' }}
        height="auto"
        dayMaxEvents={3}
        events={events}
        eventClick={(info) => onSelect(info.event.extendedProps.item as T)}
      />
    </div>
  );
}
