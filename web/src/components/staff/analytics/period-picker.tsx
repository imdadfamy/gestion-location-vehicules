'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/staff/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { monthRange, PRESETS, presetRange, todayKey, yearRange, type Range } from '@/lib/data/analytics';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const FIRST_YEAR = 2024;

/** Périodes que l'on règle soi-même au calendrier : leurs dates sont dans `custom`. */
export const PICKED = ['pick_month', 'pick_year', 'custom'];
const LABELS: Record<string, string> = { ...Object.fromEntries(Object.entries(PRESETS).filter(([key]) => key !== 'custom')), pick_month: 'Choisir un mois…', pick_year: 'Choisir une année…', custom: 'Entre deux dates…' };

export const resolveRange = (preset: string, custom: Range): Range => (PICKED.includes(preset) ? custom : presetRange(preset));

/**
 * Choix de la période : un raccourci (ce mois-ci, année dernière…) ou n'importe quel mois, année ou
 * intervalle de dates. À placer dans une grille : rend le sélecteur puis, au besoin, ses champs.
 */
export function PeriodPicker({ preset, custom, onChange, idPrefix = 'period' }: { preset: string; custom: Range; onChange: (preset: string, custom: Range) => void; idPrefix?: string }) {
  // Les dates saisies ne s'appliquent qu'au clic sur « Appliquer la période ».
  const [draft, setDraft] = useState(custom);
  const thisYear = Number(todayKey().slice(0, 4));
  const years = Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, index) => thisYear - index);
  const year = Number(custom.from.slice(0, 4));
  const month = Number(custom.from.slice(5, 7));
  const yearOptions = years.includes(year) ? years : [year, ...years];

  function choose(next: string) {
    if (next === 'pick_month') onChange(next, PICKED.includes(preset) ? monthRange(year, month) : presetRange('this_month'));
    else if (next === 'pick_year') onChange(next, yearRange(year));
    else {
      setDraft(custom);
      onChange(next, custom);
    }
  }

  const yearSelect = (value: string, onValue: (year: number) => void, label: string) => (
    <Select value={value} onValueChange={(next) => onValue(Number(next))}>
      <SelectTrigger className="w-full" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {yearOptions.map((item) => (
          <SelectItem key={item} value={String(item)}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <>
      <Field label="Période">
        <Select value={preset} onValueChange={choose}>
          <SelectTrigger className="w-full" aria-label="Période">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {preset === 'pick_month' && (
        <>
          <Field label="Mois">
            <Select value={String(month)} onValueChange={(next) => onChange(preset, monthRange(year, Number(next)))}>
              <SelectTrigger className="w-full" aria-label="Mois">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((name, index) => (
                  <SelectItem key={name} value={String(index + 1)}>
                    {name.charAt(0).toUpperCase() + name.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Année">{yearSelect(String(year), (next) => onChange(preset, monthRange(next, month)), 'Année')}</Field>
        </>
      )}
      {preset === 'pick_year' && <Field label="Année">{yearSelect(String(year), (next) => onChange(preset, yearRange(next)), 'Année')}</Field>}
      {preset === 'custom' && (
        <>
          <Field label="Du" htmlFor={`${idPrefix}-from`}>
            <Input id={`${idPrefix}-from`} type="date" value={draft.from} max={draft.to} onChange={(event) => setDraft({ ...draft, from: event.target.value || draft.from })} />
          </Field>
          <Field label="Au" htmlFor={`${idPrefix}-to`}>
            <Input id={`${idPrefix}-to`} type="date" value={draft.to} min={draft.from} onChange={(event) => setDraft({ ...draft, to: event.target.value || draft.to })} />
          </Field>
          <Button type="button" className="col-span-full w-full" disabled={draft.from > draft.to || (draft.from === custom.from && draft.to === custom.to)} onClick={() => onChange(preset, draft)}>
            Appliquer la période
          </Button>
        </>
      )}
    </>
  );
}
