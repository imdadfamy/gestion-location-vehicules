'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COUNTRIES, countryName, findCountry } from '@/lib/countries';
import { cn } from '@/lib/utils';
import { useLang } from './lang-provider';

/**
 * Téléphone avec choix du pays : une liste déroulante (à faire défiler) d'indicatifs, puis le
 * numéro. Le numéro final s'obtient avec `toInternational(dial, saisie)`.
 */
export function PhoneField({
  id,
  country,
  onCountryChange,
  value,
  onChange,
  className,
}: {
  id: string;
  country: string;
  onCountryChange: (iso: string) => void;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const { lang, t } = useLang();
  const current = findCountry(country);
  return (
    <div className="flex gap-2">
      <Select value={country} onValueChange={onCountryChange}>
        <SelectTrigger aria-label={t('Pays')} className={cn('w-[7.5rem] shrink-0', className)}>
          <SelectValue>
            {current.iso} +{current.dial}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {COUNTRIES.map((item) => (
            <SelectItem key={item.iso} value={item.iso}>
              {countryName(item, lang)} (+{item.dial})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('Numéro')}
        maxLength={20}
        className={cn('min-w-0 flex-1', className)}
      />
    </div>
  );
}
