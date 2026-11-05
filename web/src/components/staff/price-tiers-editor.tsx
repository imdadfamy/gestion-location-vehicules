'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MAX_TIER_MONTHS, type TierRow } from '@/lib/pricing';

/**
 * Prix par jour selon la durée : chaque ligne est un palier « à partir de N mois ». On peut en ajouter
 * ou en retirer librement ; sans palier, le prix de base s'applique à toutes les durées.
 */
export function PriceTiersEditor({
  rows,
  onChange,
  disabled,
  idPrefix,
  basePrice,
}: {
  rows: TierRow[];
  onChange: (rows: TierRow[]) => void;
  disabled?: boolean;
  idPrefix: string;
  /** Prix de base, proposé comme point de départ d'un nouveau palier. */
  basePrice?: string;
}) {
  function add() {
    const used = new Set(rows.map((row) => Number(row.months)));
    let months = 1;
    while (used.has(months) && months < MAX_TIER_MONTHS) months++;
    onChange([...rows, { months: String(months), price: basePrice && Number(basePrice) > 0 ? basePrice : '' }]);
  }
  const update = (index: number, patch: Partial<TierRow>) => onChange(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));

  return (
    <div className="grid gap-2">
      {rows.length === 0 && <p className="text-xs text-muted-foreground">Aucun palier : le prix de base s’applique quelle que soit la durée.</p>}
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[auto_4.5rem_1fr_auto] items-center gap-2">
          <label htmlFor={`${idPrefix}-months-${index}`} className="text-sm whitespace-nowrap">
            À partir de
          </label>
          <div className="flex items-center gap-1">
            <Input
              id={`${idPrefix}-months-${index}`}
              type="number"
              min={1}
              max={MAX_TIER_MONTHS}
              inputMode="numeric"
              value={row.months}
              disabled={disabled}
              onChange={(event) => update(index, { months: event.target.value })}
              aria-label="Nombre de mois"
              className="min-w-0"
            />
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={row.price}
              disabled={disabled}
              onChange={(event) => update(index, { price: event.target.value })}
              aria-label="Prix par jour (FCFA)"
              className="min-w-0"
            />
            <span className="text-xs whitespace-nowrap text-muted-foreground">mois · FCFA/jour</span>
          </div>
          {!disabled && (
            <Button type="button" variant="ghost" size="icon" aria-label="Retirer ce palier" onClick={() => onChange(rows.filter((_, position) => position !== index))}>
              <Trash2 />
            </Button>
          )}
        </div>
      ))}
      {!disabled && (
        <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={add}>
          <Plus /> Ajouter un palier
        </Button>
      )}
    </div>
  );
}
