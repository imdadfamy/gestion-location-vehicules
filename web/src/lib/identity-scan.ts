/**
 * Lecture automatique d'une pièce d'identité ou d'un permis (photo) pour préremplir les champs.
 *
 * Règles :
 *  - la lecture ne fait que PROPOSER : seuls les champs encore VIDES sont remplis, un champ déjà saisi n'est jamais écrasé,
 *    et tout reste modifiable ou effaçable à la main ;
 *  - si tous les champs concernés sont déjà remplis avant l'ajout de la pièce, il n'y a aucune lecture ;
 *  - la lecture se fait dans le navigateur (tesseract.js) : l'image n'est envoyée à aucun service ; seuls les fichiers de
 *    langue du lecteur sont téléchargés la première fois ;
 *  - une lecture qui échoue ne bloque jamais : on saisit à la main.
 */

/** `any` : « autre pièce » (passeport, deuxième pièce…), lue à la fois comme identité et comme permis. */
export type ScanKind = 'identity' | 'license' | 'any';
export type ScanField = 'first_name' | 'last_name' | 'id_document_number' | 'driving_license_number' | 'driving_license_expiry_date';
export type ScanProposal = Partial<Record<ScanField, string>>;
export type ScanStatus = 'ok' | 'empty' | 'unsupported' | 'skipped' | 'failed';

const IDENTITY_FIELDS: { key: ScanField; label: string }[] = [
  { key: 'first_name', label: 'prénom' },
  { key: 'last_name', label: 'nom' },
  { key: 'id_document_number', label: 'n° de pièce' },
];
const LICENSE_FIELDS: { key: ScanField; label: string }[] = [
  { key: 'driving_license_number', label: 'n° de permis' },
  { key: 'driving_license_expiry_date', label: 'date d’expiration' },
];

/** Champs que chaque type de pièce peut remplir, avec leur libellé pour le message à l'utilisateur. */
// « Autre pièce » peut remplir tout ce que remplissent la pièce d'identité et le permis.
export const SCAN_FIELDS: Record<ScanKind, { key: ScanField; label: string }[]> = {
  identity: IDENTITY_FIELDS,
  license: LICENSE_FIELDS,
  any: [...IDENTITY_FIELDS, ...LICENSE_FIELDS],
};

const MAX_BYTES = 12 * 1024 * 1024;
const letters = (value: string) => value.replace(/[^\p{L} '\-]/gu, ' ').replace(/\s+/g, ' ').trim();
const properCase = (value: string) => value.toLowerCase().replace(/(^|[ '\-])(\p{L})/gu, (_m, sep: string, c: string) => sep + c.toUpperCase());

/** Ligne de zone lisible par machine (passeport, carte) : lettres, chiffres et « < ». */
const isMrz = (line: string) => /^[A-Z0-9<]{25,}$/.test(line.replace(/\s+/g, ''));

/** Valeur qui ressemble à un numéro (au moins 5 caractères dont un chiffre) dans un texte. */
const numberIn = (text: string) => {
  const found = text.match(/([A-Z]{0,4}[-\/ ]?\d[A-Z0-9\-\/]{3,}(?:[ \-\/][A-Z0-9]{2,}){0,2})/i)?.[1];
  const value = found?.replace(/\s+/g, ' ').trim().toUpperCase() ?? '';
  return value.replace(/[^A-Z0-9]/g, '').length >= 5 ? value : '';
};

/** Numéro placé après un libellé (même ligne, sinon ligne suivante). */
function numberAfter(lines: string[], label: RegExp) {
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(label);
    if (!match) continue;
    const value = numberIn(lines[i].slice((match.index ?? 0) + match[0].length)) || numberIn(lines[i + 1] ?? '');
    if (value) return value;
  }
  return '';
}

/** Prénom, nom et numéro à partir du texte lu sur une pièce d'identité. */
export function parseIdentityText(text: string): ScanProposal {
  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const result: ScanProposal = {};

  // Valeur après le libellé, sur la même ligne (« NOM : ADJOVI ») ou sur la ligne suivante (libellé seul).
  const after = (label: RegExp) => {
    for (let i = 0; i < lines.length; i += 1) {
      const match = lines[i].match(label);
      if (!match) continue;
      const inline = lines[i].slice((match.index ?? 0) + match[0].length).replace(/^[\s:\-./]+/, '').trim();
      if (inline.length >= 2) return inline;
      const next = lines[i + 1];
      if (next && !/^(?:nom|pr[ée]noms?|surname|given|date|sexe|n[°o])\b/i.test(next)) return next;
    }
    return '';
  };

  const last = letters(after(/\b(?:NOM|SURNAME|NAME)(?:\s*\/\s*[A-Za-z ]+)?\b(?!\s*[A-Za-z]*\s*(?:DU|DE)\b)/i));
  const first = letters(after(/\b(?:PR[ÉE]NOMS?|GIVEN\s*NAMES?|FIRST\s*NAMES?)(?:\s*\/\s*[A-Za-z ]+)?\b/i));
  if (last) result.last_name = properCase(last);
  if (first) result.first_name = properCase(first.split(/\s+/).slice(0, 3).join(' '));

  // Un permis n'est pas une pièce d'identité : ses lignes sont ignorées pour le numéro de pièce.
  const idLines = lines.filter((line) => !/permis|licen[cs]e|driving/i.test(line));
  const id = numberAfter(idLines, /(?:\bN[°ºo]|\bnum[ée]ro|\bNPI|\bpassport\s*no|\bid\s*no)(?![a-zà-ÿ])/i);
  if (id) result.id_document_number = id;

  // Zone lisible par machine : plus fiable que le texte imprimé quand elle est bien lue.
  const mrz = lines.map((line) => line.replace(/\s+/g, '')).filter(isMrz);
  if (mrz.length >= 2) {
    const names = mrz.find((line) => line.includes('<<'));
    if (names) {
      const body = names.replace(/^[A-Z]<?[A-Z]{3}/, '');
      const [surname, given] = body.split('<<');
      if (!result.last_name && surname) result.last_name = properCase(surname.replace(/</g, ' ').trim());
      if (!result.first_name && given) result.first_name = properCase(given.replace(/</g, ' ').trim().split(/\s+/)[0] ?? '');
    }
    const numbered = mrz.find((line) => /^[A-Z0-9<]{9}[0-9<][A-Z]{3}/.test(line));
    if (!result.id_document_number && numbered) result.id_document_number = numbered.slice(0, 9).replace(/</g, '');
  }
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value)) as ScanProposal;
}

const toIso = (day: number, month: number, year: number) => {
  const full = year < 100 ? 2000 + year : year;
  const date = new Date(Date.UTC(full, month - 1, day));
  if (date.getUTCFullYear() !== full || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return date.toISOString().slice(0, 10);
};

/** Numéro et date d'expiration à partir du texte lu sur un permis de conduire. */
export function parseLicenseText(text: string, today = new Date()): ScanProposal {
  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const result: ScanProposal = {};

  // D'abord les lignes qui parlent du permis, puis toute ligne avec un « N° ».
  const number = (label: RegExp) => numberAfter(lines.filter((line) => /permis|licen[cs]e|driving/i.test(line) || /^\s*N[°ºo]/i.test(line)), label) || numberAfter(lines, label);
  const licenseNumber = number(/(?:\bN[°ºo]|\bnum[ée]ro|\blicen[cs]e\s*(?:no|number)|\bpermis\s*n)(?![a-zà-ÿ])/i);
  if (licenseNumber) result.driving_license_number = licenseNumber;
  const dates: { iso: string; labeled: boolean }[] = [];
  for (const line of lines) {
    for (const found of line.matchAll(/\b(\d{1,2})\s*[./\-]\s*(\d{1,2})\s*[./\-]\s*(\d{2}|\d{4})\b/g)) {
      const iso = toIso(Number(found[1]), Number(found[2]), Number(found[3]));
      if (iso) dates.push({ iso, labeled: /expir|valid|valable|exp\b|4b|jusqu/i.test(line) });
    }
  }
  const labeled = dates.filter((item) => item.labeled).map((item) => item.iso).sort().pop();
  // Sans libellé lisible : la date la plus lointaine, si elle est à venir (une date d'expiration l'est presque toujours).
  const latest = dates.map((item) => item.iso).sort().pop();
  const expiry = labeled ?? (latest && latest >= today.toISOString().slice(0, 10) ? latest : '');
  if (expiry) result.driving_license_expiry_date = expiry;
  return result;
}

/** Vrai quand au moins un des champs de cette pièce est encore vide (sinon la lecture est inutile). */
export const needsScan = (current: Partial<Record<ScanField, string>>, kind: ScanKind) =>
  SCAN_FIELDS[kind].some(({ key }) => !String(current[key] ?? '').trim());

/**
 * Remplit uniquement les champs vides. Renvoie les nouvelles valeurs et la liste de ce qui a été rempli.
 * Un champ déjà saisi (même modifié à la main avant la lecture) n'est jamais remplacé.
 */
export function fillEmpty<T extends Partial<Record<ScanField, string>>>(current: T, proposal: ScanProposal, kind: ScanKind) {
  const next = { ...current };
  const filled: string[] = [];
  for (const { key, label } of SCAN_FIELDS[kind]) {
    const value = proposal[key];
    if (value && !String(current[key] ?? '').trim()) {
      (next as Record<string, string>)[key] = value;
      filled.push(label);
    }
  }
  return { next, filled };
}

/** Message affiché sous le champ de dépôt de la pièce. */
export function scanMessage(status: ScanStatus, filled: string[]) {
  if (status === 'ok') return `Lecture terminée : ${filled.join(', ')} proposé(s). Vérifiez et corrigez si besoin.`;
  if (status === 'empty') return 'Lecture terminée, mais rien n’a pu être repéré : saisissez les informations à la main.';
  if (status === 'unsupported') return 'Les PDF ne sont pas lus automatiquement : saisissez les informations à la main.';
  if (status === 'skipped') return 'Les champs sont déjà remplis : la pièce est simplement conservée.';
  return 'La lecture automatique a échoué : saisissez les informations à la main.';
}

/**
 * Lit la photo. `current` sert à ne rien faire quand tous les champs concernés sont déjà remplis.
 * Ne lève jamais d'erreur : un échec revient en `failed`.
 */
export async function scanDocument(file: File, kind: ScanKind, current: Partial<Record<ScanField, string>>): Promise<{ status: ScanStatus; proposal: ScanProposal }> {
  if (!needsScan(current, kind)) return { status: 'skipped', proposal: {} };
  if (!file.type.startsWith('image/') || file.size > MAX_BYTES) return { status: 'unsupported', proposal: {} };
  try {
    // Chargé à la demande : la reconnaissance de texte est lourde et rarement utilisée.
    const { recognize } = await import('tesseract.js');
    const { data } = await recognize(file, 'fra+eng');
    const proposal =
      kind === 'identity'
        ? parseIdentityText(data.text)
        : kind === 'license'
          ? parseLicenseText(data.text)
          : // Autre pièce : le permis n'est lu que si le texte parle d'un permis (sinon le numéro d'une carte serait pris pour un n° de permis).
            { ...(/permis|licen[cs]e|driving/i.test(data.text) ? parseLicenseText(data.text) : {}), ...parseIdentityText(data.text) };
    return { status: Object.keys(proposal).length ? 'ok' : 'empty', proposal };
  } catch {
    return { status: 'failed', proposal: {} };
  }
}
