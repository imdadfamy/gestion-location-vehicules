import { EN } from './i18n-en';

/**
 * Langues du site public. Le français est la langue source : les textes du code sont écrits en
 * français et `t('texte français')` renvoie la traduction anglaise (ou le texte lui-même si elle
 * manque). L'anglais est servi sous `/en`.
 */
export type Lang = 'fr' | 'en';

export const localeOf = (lang: Lang) => (lang === 'en' ? 'en-GB' : 'fr-FR');

/** Traduit un texte français ; `{nom}` est remplacé par la valeur de `vars`. */
export function translate(lang: Lang, text: string, vars?: Record<string, string | number>) {
  let out = lang === 'en' ? (EN[text] ?? text) : text;
  if (vars) for (const [key, value] of Object.entries(vars)) out = out.replaceAll(`{${key}}`, String(value));
  return out;
}

/** « 1 jour » / « 3 jours » : `one` et `many` sont les formes françaises, traduites ensuite. */
export function pluralize(lang: Lang, count: number, one: string, many: string) {
  return translate(lang, count > 1 ? many : one);
}

export type Translate = (text: string, vars?: Record<string, string | number>) => string;
export const translator = (lang: Lang): Translate => (text, vars) => translate(lang, text, vars);

/** Pages du site public qui existent aussi sous `/en`. */
const PUBLIC_PATH = /^\/(p\/|suivi-transfert|vehicules)/;

/** Adresse d'une page du site public dans la langue demandée ; les autres adresses (espaces connectés) restent telles quelles. */
export function localHref(lang: Lang, href: string) {
  if (lang !== 'en') return href;
  if (href === '/') return '/en';
  if (href.startsWith('/#') || href.startsWith('/?')) return `/en${href.slice(1)}`;
  if (href.startsWith('/vehicules')) return `/en${href.slice('/vehicules'.length)}`;
  if (PUBLIC_PATH.test(href)) return `/en${href}`;
  return href;
}

/** Adresse équivalente dans l'autre langue (pour le sélecteur de langue). */
export function switchedPath(pathname: string, to: Lang) {
  const bare = pathname === '/en' ? '/' : pathname.startsWith('/en/') ? pathname.slice(3) : pathname;
  return to === 'en' ? (bare === '/' ? '/en' : `/en${bare}`) : bare;
}
