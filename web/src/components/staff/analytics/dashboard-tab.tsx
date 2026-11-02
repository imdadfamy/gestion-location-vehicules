'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  addCards,
  cardValue,
  COMPARES,
  DEFAULT_CARDS,
  formatValue,
  loadCards,
  moveCard,
  PRESETS,
  removeCard,
  variation,
  type Card as CardRow,
  type Catalog,
  type Compare,
} from '@/lib/data/analytics';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type Loaded = { value: number | null; previous: number | null; compared: boolean };
const PERIODS = Object.entries(PRESETS).filter(([key]) => key !== 'custom');

/** Cartes du tableau de bord de l'utilisateur : une mesure, une période, une comparaison « à armes égales ». */
export function DashboardTab({ catalog, userId, canMarketing, onOpen }: { catalog: Catalog; userId: string; canMarketing: boolean; onOpen: (metricId: string, period: string) => void }) {
  const [stored, setStored] = useState<CardRow[] | null>(null);
  const [values, setValues] = useState<Record<string, Loaded>>({});
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const defaults: CardRow[] = DEFAULT_CARDS.map((card, index) => ({ ...card, id: `default-${index}`, position: index }));
  const cards = stored && stored.length ? stored : defaults;
  const isDefault = !stored?.length;

  const reload = useCallback(async () => {
    const { cards: rows, error: failure } = await loadCards(createClient());
    if (failure) return setError(frenchError(failure));
    setStored(rows);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- premier chargement
    reload();
  }, [reload]);

  // Les valeurs se recalculent quand la liste des cartes change.
  const signature = cards.map((card) => `${card.id}:${card.metric_id}:${card.period}:${card.compare}`).join('|');
  useEffect(() => {
    if (!catalog.size || stored === null) return;
    let current = true;
    Promise.all(
      cards.map(async (card) => {
        try {
          const result = await cardValue(createClient(), catalog, card);
          return [card.id, { value: result.value, previous: result.previous, compared: !!result.compared }] as const;
        } catch {
          return [card.id, { value: null, previous: null, compared: false }] as const;
        }
      }),
    ).then((entries) => current && setValues(Object.fromEntries(entries)));
    return () => {
      current = false;
    };
    // `cards` est dérivé de `stored` : la signature suffit à détecter un vrai changement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, signature, stored]);

  /** Les cartes par défaut ne sont enregistrées qu'à la première modification. */
  async function materialize() {
    if (!isDefault) return cards;
    const { data, error: failure } = await addCards(createClient(), userId, DEFAULT_CARDS.map((card, index) => ({ ...card, position: index })));
    if (failure || !data) throw failure;
    return data as CardRow[];
  }

  async function change(action: (rows: CardRow[]) => Promise<void>) {
    setError('');
    try {
      await action(await materialize());
      await reload();
    } catch (failure) {
      setError(frenchError(failure));
    }
  }

  const remove = (card: CardRow) =>
    change(async (rows) => {
      const target = isDefault ? rows[defaults.findIndex((item) => item.id === card.id)] : card;
      const { error: failure } = await removeCard(createClient(), target.id);
      if (failure) throw failure;
    });

  const shift = (card: CardRow, direction: -1 | 1) =>
    change(async (rows) => {
      const index = isDefault ? defaults.findIndex((item) => item.id === card.id) : rows.findIndex((item) => item.id === card.id);
      const other = rows[index + direction];
      if (!other) return;
      const db = createClient();
      await Promise.all([moveCard(db, rows[index].id, other.position), moveCard(db, other.id, rows[index].position)]);
    });

  if (stored === null || !catalog.size) return error ? <FormMessage error={error} /> : <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {isDefault ? 'Cartes proposées par défaut : modifiez-les pour composer votre tableau de bord.' : 'Votre tableau de bord. Touchez une carte pour ouvrir son rapport.'}
        </p>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus /> Ajouter une carte
        </Button>
      </div>
      <FormMessage error={error} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card, index) => {
          const metric = catalog.get(card.metric_id);
          const loaded = values[card.id];
          if (!metric) return null;
          const change = loaded?.compared ? variation(loaded.value, loaded.previous) : null;
          return (
            <Card key={card.id} className="group relative gap-2 py-4">
              <div className="absolute top-2 right-2 flex gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <Button variant="ghost" size="icon" className="size-7" aria-label="Déplacer avant" disabled={index === 0} onClick={() => shift(card, -1)}>
                  <ChevronLeft />
                </Button>
                <Button variant="ghost" size="icon" className="size-7" aria-label="Déplacer après" disabled={index === cards.length - 1} onClick={() => shift(card, 1)}>
                  <ChevronRight />
                </Button>
                <Button variant="ghost" size="icon" className="size-7 text-destructive" aria-label="Retirer la carte" onClick={() => remove(card)}>
                  <X />
                </Button>
              </div>
              <CardContent className="px-4">
                <button type="button" className="grid w-full gap-1 text-left" onClick={() => onOpen(card.metric_id, card.period)}>
                  <span className="pr-20 text-xs text-muted-foreground">{metric.label}</span>
                  <span className="text-2xl font-semibold tabular-nums">{loaded ? formatValue(loaded.value, metric.unit) : <Loader2 className="size-5 animate-spin" />}</span>
                  <span className="text-xs text-muted-foreground">
                    {PRESETS[card.period]}
                    {loaded?.compared && (
                      <>
                        {' · avant : '}
                        {formatValue(loaded.previous, metric.unit)}
                        {change !== null && (
                          <span className={cn('ml-1 inline-flex items-center font-medium', change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                            {change >= 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                            {Math.abs(Math.round(change * 1000) / 10)} %
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AddCardDialog
        open={adding}
        onOpenChange={setAdding}
        catalog={catalog}
        canMarketing={canMarketing}
        onAdd={async (card) => {
          await change(async (rows) => {
            const { error: failure } = await addCards(createClient(), userId, [{ ...card, position: rows.length }]);
            if (failure) throw failure;
          });
          toast.success('Carte ajoutée.');
        }}
      />
    </div>
  );
}

function AddCardDialog({
  open,
  onOpenChange,
  catalog,
  canMarketing,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: Catalog;
  canMarketing: boolean;
  onAdd: (card: { metric_id: string; period: string; compare: Compare }) => Promise<void>;
}) {
  const metrics = [...catalog.values()].filter((metric) => canMarketing || !['marketing_spend', 'marketing_in_kind'].includes(metric.id));
  const [metric, setMetric] = useState('revenue_total');
  const [period, setPeriod] = useState('this_month');
  const [compare, setCompare] = useState<Compare>('previous_period');
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    await onAdd({ metric_id: metric, period, compare });
    setSaving(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Ajouter une carte</DialogTitle>
            <DialogDescription>Choisissez la mesure, la période et la comparaison. Les définitions sont dans l’onglet « Définitions ».</DialogDescription>
          </DialogHeader>
          <Field label="Mesure">
            <Select value={metric} onValueChange={setMetric}>
              <SelectTrigger className="w-full" aria-label="Mesure">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {metrics.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Période">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-full" aria-label="Période">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Comparer à">
              <Select value={compare} onValueChange={(value) => setCompare(value as Compare)}>
                <SelectTrigger className="w-full" aria-label="Comparaison">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COMPARES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
