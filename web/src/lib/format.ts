/** « 2026-11-30 » ou « 2026-11-30T08:00:00Z » → « 30/11/2026 » (jour tel qu'enregistré). */
export function frDate(value: string | null | undefined) {
  return value ? value.slice(0, 10).split('-').reverse().join('/') : '—';
}

/** Saisie de téléphone : chiffres uniquement (comme la directive Angular appDigitsOnly). */
export function digitsOnly(value: string) {
  return value.replace(/\D+/g, '');
}
