import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type Tone = 'success' | 'info' | 'warning' | 'danger' | 'muted';

const TONES: Record<Tone, string> = {
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  info: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  danger: 'bg-red-500/10 text-red-700 dark:text-red-400',
  muted: 'bg-muted text-muted-foreground',
};

/** Pastille de statut colorée, commune aux écrans du back-office. */
export function StatusBadge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <Badge variant="secondary" className={cn('border-transparent font-medium', TONES[tone], className)}>
      {children}
    </Badge>
  );
}
