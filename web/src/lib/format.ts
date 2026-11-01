/** « 2026-11-30 » ou « 2026-11-30T08:00:00Z » → « 30/11/2026 » (jour tel qu'enregistré). */
export function frDate(value: string | null | undefined) {
  return value ? value.slice(0, 10).split('-').reverse().join('/') : '—';
}

/** Numéro pour wa.me : « + » explicite = tel quel, sinon indicatif du Bénin ajouté aux numéros locaux. */
export function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D+/g, '');
  return phone.trim().startsWith('+') || digits.length > 10 ? digits : `229${digits}`;
}

/** Saisie de téléphone : chiffres uniquement (comme la directive Angular appDigitsOnly). */
export function digitsOnly(value: string) {
  return value.replace(/\D+/g, '');
}

const dateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
const dateTimeLong = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

/** Date et heure à l'heure locale du poste (« 31/10/2026 14:00 »). */
export function frDateTime(value: string | null | undefined, long = false) {
  return value ? (long ? dateTimeLong : dateTime).format(new Date(value)) : '—';
}
