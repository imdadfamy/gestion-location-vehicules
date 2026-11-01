import { Check } from 'lucide-react';
import { currentStep, reachedSteps, STEP_HINTS, TRACK_STEPS, type TrackedReservation } from '@/lib/data/client-progress';
import { cn } from '@/lib/utils';

/** Frise de suivi : Demandée → Validée → Dossier à signer → Contrat signé → Véhicule remis → Retourné. */
export function ReservationTimeline({ row }: { row: TrackedReservation }) {
  if (row.status === 'cancelled')
    return <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Cette réservation a été annulée.</p>;

  const reached = reachedSteps(row);
  const current = currentStep(row);
  const done = current >= TRACK_STEPS.length;

  return (
    <div>
      <ol className="grid gap-3 sm:grid-cols-6 sm:gap-0" aria-label="Suivi de la réservation">
        {TRACK_STEPS.map((label, index) => {
          const isDone = reached[index];
          const isCurrent = !done && index === current;
          return (
            <li key={label} aria-current={isCurrent ? 'step' : undefined} className="flex items-center gap-3 sm:flex-col sm:gap-1.5 sm:text-center">
              <div className="flex items-center sm:w-full">
                <span className={cn('hidden h-0.5 flex-1 sm:block', index === 0 ? 'opacity-0' : isDone || isCurrent ? 'bg-primary' : 'bg-muted')} />
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                    isDone ? 'border-primary bg-primary text-primary-foreground' : isCurrent ? 'border-primary bg-background text-primary ring-4 ring-primary/15' : 'border-muted bg-background text-muted-foreground',
                  )}
                >
                  {isDone ? <Check className="size-4" /> : index + 1}
                </span>
                <span className={cn('hidden h-0.5 flex-1 sm:block', index === TRACK_STEPS.length - 1 ? 'opacity-0' : reached[index + 1] ? 'bg-primary' : 'bg-muted')} />
              </div>
              <span className={cn('text-xs leading-tight', isCurrent ? 'font-semibold text-foreground' : isDone ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm text-muted-foreground">{done ? 'Location terminée. Merci de votre confiance !' : STEP_HINTS[current]}</p>
    </div>
  );
}
