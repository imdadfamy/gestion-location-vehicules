/**
 * Indicatifs téléphoniques pour le choix du pays d'un numéro. `iso` identifie le pays (plusieurs
 * pays partagent un indicatif : +1, +7…), `dial` est l'indicatif sans « + ».
 */
export type Country = { iso: string; dial: string; fr: string; en: string };

export const DEFAULT_COUNTRY = 'BJ';

export const COUNTRIES: Country[] = [
  { iso: 'BJ', dial: '229', fr: 'Bénin', en: 'Benin' },
  { iso: 'DZ', dial: '213', fr: 'Algérie', en: 'Algeria' },
  { iso: 'DE', dial: '49', fr: 'Allemagne', en: 'Germany' },
  { iso: 'AO', dial: '244', fr: 'Angola', en: 'Angola' },
  { iso: 'SA', dial: '966', fr: 'Arabie saoudite', en: 'Saudi Arabia' },
  { iso: 'AR', dial: '54', fr: 'Argentine', en: 'Argentina' },
  { iso: 'AU', dial: '61', fr: 'Australie', en: 'Australia' },
  { iso: 'AT', dial: '43', fr: 'Autriche', en: 'Austria' },
  { iso: 'BE', dial: '32', fr: 'Belgique', en: 'Belgium' },
  { iso: 'BR', dial: '55', fr: 'Brésil', en: 'Brazil' },
  { iso: 'BF', dial: '226', fr: 'Burkina Faso', en: 'Burkina Faso' },
  { iso: 'BI', dial: '257', fr: 'Burundi', en: 'Burundi' },
  { iso: 'CM', dial: '237', fr: 'Cameroun', en: 'Cameroon' },
  { iso: 'CA', dial: '1', fr: 'Canada', en: 'Canada' },
  { iso: 'CV', dial: '238', fr: 'Cap-Vert', en: 'Cape Verde' },
  { iso: 'CF', dial: '236', fr: 'Centrafrique', en: 'Central African Republic' },
  { iso: 'CL', dial: '56', fr: 'Chili', en: 'Chile' },
  { iso: 'CN', dial: '86', fr: 'Chine', en: 'China' },
  { iso: 'CO', dial: '57', fr: 'Colombie', en: 'Colombia' },
  { iso: 'KM', dial: '269', fr: 'Comores', en: 'Comoros' },
  { iso: 'CG', dial: '242', fr: 'Congo', en: 'Congo' },
  { iso: 'CD', dial: '243', fr: 'Congo (RDC)', en: 'DR Congo' },
  { iso: 'KR', dial: '82', fr: 'Corée du Sud', en: 'South Korea' },
  { iso: 'CI', dial: '225', fr: 'Côte d’Ivoire', en: 'Côte d’Ivoire' },
  { iso: 'DK', dial: '45', fr: 'Danemark', en: 'Denmark' },
  { iso: 'DJ', dial: '253', fr: 'Djibouti', en: 'Djibouti' },
  { iso: 'EG', dial: '20', fr: 'Égypte', en: 'Egypt' },
  { iso: 'AE', dial: '971', fr: 'Émirats arabes unis', en: 'United Arab Emirates' },
  { iso: 'ES', dial: '34', fr: 'Espagne', en: 'Spain' },
  { iso: 'US', dial: '1', fr: 'États-Unis', en: 'United States' },
  { iso: 'ET', dial: '251', fr: 'Éthiopie', en: 'Ethiopia' },
  { iso: 'FR', dial: '33', fr: 'France', en: 'France' },
  { iso: 'GA', dial: '241', fr: 'Gabon', en: 'Gabon' },
  { iso: 'GM', dial: '220', fr: 'Gambie', en: 'Gambia' },
  { iso: 'GH', dial: '233', fr: 'Ghana', en: 'Ghana' },
  { iso: 'GR', dial: '30', fr: 'Grèce', en: 'Greece' },
  { iso: 'GN', dial: '224', fr: 'Guinée', en: 'Guinea' },
  { iso: 'GQ', dial: '240', fr: 'Guinée équatoriale', en: 'Equatorial Guinea' },
  { iso: 'GW', dial: '245', fr: 'Guinée-Bissau', en: 'Guinea-Bissau' },
  { iso: 'HT', dial: '509', fr: 'Haïti', en: 'Haiti' },
  { iso: 'IN', dial: '91', fr: 'Inde', en: 'India' },
  { iso: 'IE', dial: '353', fr: 'Irlande', en: 'Ireland' },
  { iso: 'IL', dial: '972', fr: 'Israël', en: 'Israel' },
  { iso: 'IT', dial: '39', fr: 'Italie', en: 'Italy' },
  { iso: 'JP', dial: '81', fr: 'Japon', en: 'Japan' },
  { iso: 'KE', dial: '254', fr: 'Kenya', en: 'Kenya' },
  { iso: 'LB', dial: '961', fr: 'Liban', en: 'Lebanon' },
  { iso: 'LR', dial: '231', fr: 'Libéria', en: 'Liberia' },
  { iso: 'LU', dial: '352', fr: 'Luxembourg', en: 'Luxembourg' },
  { iso: 'MG', dial: '261', fr: 'Madagascar', en: 'Madagascar' },
  { iso: 'ML', dial: '223', fr: 'Mali', en: 'Mali' },
  { iso: 'MA', dial: '212', fr: 'Maroc', en: 'Morocco' },
  { iso: 'MU', dial: '230', fr: 'Maurice', en: 'Mauritius' },
  { iso: 'MR', dial: '222', fr: 'Mauritanie', en: 'Mauritania' },
  { iso: 'MX', dial: '52', fr: 'Mexique', en: 'Mexico' },
  { iso: 'NE', dial: '227', fr: 'Niger', en: 'Niger' },
  { iso: 'NG', dial: '234', fr: 'Nigéria', en: 'Nigeria' },
  { iso: 'NO', dial: '47', fr: 'Norvège', en: 'Norway' },
  { iso: 'NZ', dial: '64', fr: 'Nouvelle-Zélande', en: 'New Zealand' },
  { iso: 'NL', dial: '31', fr: 'Pays-Bas', en: 'Netherlands' },
  { iso: 'PL', dial: '48', fr: 'Pologne', en: 'Poland' },
  { iso: 'PT', dial: '351', fr: 'Portugal', en: 'Portugal' },
  { iso: 'QA', dial: '974', fr: 'Qatar', en: 'Qatar' },
  { iso: 'GB', dial: '44', fr: 'Royaume-Uni', en: 'United Kingdom' },
  { iso: 'RU', dial: '7', fr: 'Russie', en: 'Russia' },
  { iso: 'RW', dial: '250', fr: 'Rwanda', en: 'Rwanda' },
  { iso: 'SN', dial: '221', fr: 'Sénégal', en: 'Senegal' },
  { iso: 'SL', dial: '232', fr: 'Sierra Leone', en: 'Sierra Leone' },
  { iso: 'SE', dial: '46', fr: 'Suède', en: 'Sweden' },
  { iso: 'CH', dial: '41', fr: 'Suisse', en: 'Switzerland' },
  { iso: 'TD', dial: '235', fr: 'Tchad', en: 'Chad' },
  { iso: 'TG', dial: '228', fr: 'Togo', en: 'Togo' },
  { iso: 'TN', dial: '216', fr: 'Tunisie', en: 'Tunisia' },
  { iso: 'TR', dial: '90', fr: 'Turquie', en: 'Turkey' },
  { iso: 'ZA', dial: '27', fr: 'Afrique du Sud', en: 'South Africa' },
];

export const countryName = (country: Country, lang: 'fr' | 'en') => country[lang];
export const findCountry = (iso: string) => COUNTRIES.find((country) => country.iso === iso) ?? COUNTRIES[0];

/** Pays dont les numéros gardent le « 0 » de tête à l'international (Bénin et Côte d'Ivoire depuis leur passage à 10 chiffres). */
const KEEP_LEADING_ZERO = ['229', '225'];

/**
 * Numéro international « +<indicatif><numéro> » à partir de l'indicatif choisi et de la saisie locale :
 * espaces et symboles retirés, « 0 » de tête supprimé (sauf Bénin / Côte d'Ivoire), saisie déjà
 * internationale (« +33… » ou « 00… ») reprise telle quelle.
 */
export function toInternational(dial: string, input: string) {
  const trimmed = input.trim();
  if (trimmed.startsWith('+')) return `+${trimmed.replace(/\D/g, '')}`;
  let digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('0') && !KEEP_LEADING_ZERO.includes(dial)) digits = digits.slice(1);
  return `+${dial}${digits}`;
}

/** Nombre de chiffres du numéro local saisi (pour vérifier qu'il n'est pas vide ou trop court). */
export const localDigits = (input: string) => input.replace(/\D/g, '').length;
