'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DAYS_PER_MONTH, type TierRow, type TierUnit } from '@/lib/pricing';

/**
 * Prix par jour selon la durée : chaque ligne est un palier « à partir de N jours (ou mois) ». On choisit
 * librement le seuil et l'unité, on peut ajouter ou retirer des lignes ; sans palier, le prix de base
 * s'applique à toutes les durées.
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
    const used = new Set(rows.map((row) => Number(row.count) * (row.unit === 'months' ? DAYS_PER_MONTH : 1)));
    let months = 1;
    while (used.has(months * DAYS_PER_MONTH) && months < 36) months++;
    onChange([...rows, { count: String(months), unit: 'months', price: basePrice && Number(basePrice) > 0 ? basePrice : '' }]);
  }
  const update = (index: number, patch: Partial<TierRow>) => onChange(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));

  return (
    <div className="grid gap-2">
      {rows.length === 0 && <p className="text-xs text-muted-foreground">Aucun palier : le prix de base s’applique quelle que soit la durée.</p>}
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 sm:border-0 sm:p-0">
          <label htmlFor={`${idPrefix}-count-${index}`} className="text-sm whitespace-nowrap">
            À partir de
          </label>
          <Input
            id={`${idPrefix}-count-${index}`}
            type="number"
            min={1}
            inputMode="numeric"
            value={row.count}
            disabled={disabled}
            onChange={(event) => update(index, { count: event.target.value })}
            aria-label="Durée minimale"
            className="w-20"
          />
          <Select value={row.unit} onValueChange={(value) => update(index, { unit: value as TierUnit })} disabled={disabled}>
            <SelectTrigger className="w-28" aria-label="Unité de durée">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="days">jours</SelectItem>
              <SelectItem value="months">mois</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm">:</span>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={row.price}
            disabled={disabled}
            onChange={(event) => update(index, { price: event.target.value })}
            aria-label="Prix par jour (FCFA)"
            className="w-28"
          />
          <span className="text-xs whitespace-nowrap text-muted-foreground">FCFA / jour</span>
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
