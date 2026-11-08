/**
 * Lecture automatique d'une pièce d'identité ou d'un permis (photo ou PDF) pour préremplir les champs.
 *
 * Règles :
 *  - la lecture ne fait que PROPOSER : seuls les champs encore VIDES sont remplis, un champ déjà saisi n'est jamais écrasé,
 *    et tout reste modifiable ou effaçable à la main ;
 *  - si tous les champs concernés sont déjà remplis avant l'ajout de la pièce, il n'y a aucune lecture ;
 *  - la lecture se fait dans le navigateur (tesseract.js) : l'image n'est envoyée à aucun service ; seuls les fichiers de
 *    langue du lecteur sont téléchargés la première fois ;
 *  - une photo est d'abord nettoyée (agrandie, passée en niveaux de gris, contraste renforcé) ; si des champs manquent
 *    encore, une deuxième lecture est faite sur une version noir et blanc, et les deux résultats sont fusionnés ;
 *  - un PDF est lu pour son texte quand il en contient (PDF créé par ordinateur), sinon ses pages sont transformées
 *    en images puis lues comme des photos ;
 *  - une lecture qui échoue ou dure trop longtemps ne bloque jamais : on saisit à la main.
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
const SCAN_TIMEOUT_MS = 150_000;
const PDF_PAGES = 2;

const letters = (value: string) =>
  value
    .replace(/[^\p{L} '\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[ '\-]+|[ '\-]+$/g, '');
const properCase = (value: string) => value.toLowerCase().replace(/(^|[ '\-])(\p{L})/gu, (_m, sep: string, c: string) => sep + c.toUpperCase());

/** Texte sans accents, de même longueur (un caractère pour un caractère) : sert à repérer les libellés (« Prénoms » = « PRENOMS »). */
const plain = (value: string) => value.replace(/[À-ÿ]/g, (c) => c.normalize('NFD')[0] ?? c);

const linesOf = (text: string) =>
  text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/** Ligne de zone lisible par machine (passeport, carte) : lettres, chiffres et « < ». */
const isMrz = (line: string) => /^[A-Z0-9<]{25,}$/.test(line.replace(/\s+/g, ''));

const DATE_TOKEN = /^\d{1,2}\s*[./\-]\s*\d{1,2}\s*[./\-]\s*\d{2,4}$/;

/** Valeur qui ressemble à un numéro (au moins 5 caractères dont un chiffre) dans un texte. */
const numberIn = (text: string) => {
  const found = text.match(/([A-Z]{0,4}[-\/ ]?\d[A-Z0-9\-\/]{3,}(?:[ \-\/][A-Z0-9]{2,}){0,2})/i)?.[1];
  const value = (found?.replace(/\s+/g, ' ').trim().toUpperCase() ?? '').replace(/^NO\s+/, '');
  if (DATE_TOKEN.test(value)) return '';
  return value.replace(/[^A-Z0-9]/g, '').length >= 5 ? value : '';
};

/** Numéro placé après un libellé (même ligne, sinon ligne suivante). */
function numberAfter(lines: string[], label: RegExp) {
  for (let i = 0; i < lines.length; i += 1) {
    const match = plain(lines[i]).match(label);
    if (!match) continue;
    const value = numberIn(lines[i].slice((match.index ?? 0) + match[0].length)) || numberIn(lines[i + 1] ?? '');
    if (value) return value;
  }
  return '';
}

/** Dernier recours : le premier long « mot » avec des chiffres qui n'est pas une date (ex. NPI à 10 chiffres). */
function looseNumber(lines: string[]) {
  for (const line of lines) {
    for (const token of line.split(/[\s:|]+/)) {
      if (DATE_TOKEN.test(token)) continue;
      const value = token.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const digits = value.replace(/\D/g, '').length;
      if (value.length >= 8 && value.length <= 16 && digits >= 6 && digits >= value.length - 4) return value;
    }
  }
  return '';
}

/** Mots qui commencent un autre champ : la valeur d'un champ s'arrête avant eux quand tout est sur une même ligne. */
const NEXT_LABEL = /\s+(?:PRENOMS?|NOM|NOMS|DATE|NE\(?E?\)?\s+LE|NAISSANCE|SEXE|TAILLE|NATIONALITE|PROFESSION|SIGNATURE|N[°º]|NPI|GIVEN|SURNAME|NAME)\b/i;

/** Prénom, nom et numéro à partir du texte lu sur une pièce d'identité. */
export function parseIdentityText(text: string): ScanProposal {
  const lines = linesOf(text);
  const result: ScanProposal = {};

  // Valeur après le libellé, sur la même ligne (« NOM : ADJOVI ») ou sur la ligne suivante (libellé seul).
  const after = (label: RegExp) => {
    for (let i = 0; i < lines.length; i += 1) {
      const match = plain(lines[i]).match(label);
      if (!match) continue;
      const rest = lines[i].slice((match.index ?? 0) + match[0].length).replace(/^[\s:\-./|]+/, '');
      const cut = plain(rest).search(NEXT_LABEL);
      const inline = (cut > 0 ? rest.slice(0, cut) : rest).trim();
      if (letters(inline).length >= 2) return inline;
      const next = lines[i + 1];
      if (next && !/^(?:nom|pr[ée]noms?|surname|given|date|sexe|n[°o])\b/i.test(plain(next)) && letters(next).length >= 2) return next;
    }
    return '';
  };

  const last = letters(after(/\b(?:N[O0]M(?:S)?(?:\s+DE\s+FAMILLE)?|SURNAME|FAMILY\s*NAME|LAST\s*NAME)(?:\s*\/\s*[A-Za-z ]+)?\b(?!\s*(?:DU|DE\s+LA|DE\s+JEUNE|D['’]USAGE)\b)/i));
  const first = letters(after(/\b(?:PR[EF]NOMS?|GIVEN\s*NAMES?|FIRST\s*NAMES?)(?:\s*\/\s*[A-Za-z ]+)?\b/i));
  if (last) result.last_name = properCase(last);
  if (first) result.first_name = properCase(first.split(/\s+/).slice(0, 3).join(' '));

  // Un permis n'est pas une pièce d'identité : ses lignes sont ignorées pour le numéro de pièce.
  const idLines = lines.filter((line) => !/permis|licen[cs]e|driving/i.test(plain(line)) && !isMrz(line));
  const id =
    numberAfter(idLines, /(?:\bN[°ºo]|\bnum[ée]ro|\bNPI\b|\bCIP\b|\bpassport\s*(?:no|number)|\bid\s*no|\bdocument\s*(?:no|number)|\bcarte\s*n)(?![a-z])/i) ||
    looseNumber(idLines);
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
  const lines = linesOf(text);
  const result: ScanProposal = {};

  // D'abord les lignes qui parlent du permis, puis toute ligne avec un « N° ».
  const number = (label: RegExp) => numberAfter(lines.filter((line) => /permis|licen[cs]e|driving/i.test(plain(line)) || /^\s*N[°ºo]/i.test(line)), label) || numberAfter(lines, label);
  const licenseNumber = number(/(?:\bN[°ºo]|\bnum[ée]ro|\blicen[cs]e\s*(?:no|number)|\bpermis\s*n)(?![a-z])/i);
  if (licenseNumber) result.driving_license_number = licenseNumber;
  const dates: { iso: string; labeled: boolean }[] = [];
  for (const line of lines) {
    for (const found of line.matchAll(/\b(\d{1,2})\s*[./\-]\s*(\d{1,2})\s*[./\-]\s*(\d{2}|\d{4})\b/g)) {
      const iso = toIso(Number(found[1]), Number(found[2]), Number(found[3]));
      if (iso) dates.push({ iso, labeled: /expir|valid|valable|exp\b|4b|jusqu/i.test(plain(line)) });
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
  if (status === 'empty') return 'Lecture terminée, mais rien n’a pu être repéré : saisissez les informations à la main. Une photo bien cadrée, nette et sans reflet aide beaucoup.';
  if (status === 'unsupported') return 'Ce fichier n’est pas lu automatiquement (photo ou PDF de moins de 12 Mo attendu) : saisissez les informations à la main.';
  if (status === 'skipped') return 'Les champs sont déjà remplis : la pièce est simplement conservée.';
  return 'La lecture automatique a échoué : saisissez les informations à la main.';
}

/** Propose des valeurs à partir d'un texte lu, selon le type de pièce. */
function proposalOf(text: string, kind: ScanKind): ScanProposal {
  if (kind === 'identity') return parseIdentityText(text);
  if (kind === 'license') return parseLicenseText(text);
  // Autre pièce : le permis n'est lu que si le texte parle d'un permis (sinon le numéro d'une carte serait pris pour un n° de permis).
  return { ...(/permis|licen[cs]e|driving/i.test(plain(text)) ? parseLicenseText(text) : {}), ...parseIdentityText(text) };
}

/** Fusionne deux propositions : la première gagne, la seconde ne fait que combler les champs manquants. */
const merge = (first: ScanProposal, second: ScanProposal): ScanProposal => ({ ...second, ...first });

// --- Préparation de l'image (navigateur) -------------------------------------------------------------------------------

const canvasToBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));

/** Image agrandie (ou réduite) à une taille adaptée à la lecture, orientation corrigée, fond blanc. */
function drawScaled(source: ImageBitmap | HTMLCanvasElement, width: number, height: number) {
  const longSide = Math.max(width, height);
  const scale = longSide < 1700 ? 1700 / longSide : longSide > 2600 ? 2600 / longSide : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return { canvas, context };
}

/** Niveaux de gris avec contraste étiré (1 % des pixels les plus sombres et les plus clairs sont écartés). */
function grayscale(context: CanvasRenderingContext2D, width: number, height: number) {
  const image = context.getImageData(0, 0, width, height);
  const gray = new Uint8ClampedArray(width * height);
  const histogram = new Uint32Array(256);
  for (let i = 0, p = 0; i < image.data.length; i += 4, p += 1) {
    const value = Math.round(image.data[i] * 0.299 + image.data[i + 1] * 0.587 + image.data[i + 2] * 0.114);
    gray[p] = value;
    histogram[value] += 1;
  }
  const total = gray.length;
  let low = 0;
  let high = 255;
  for (let sum = 0; low < 255; low += 1) if ((sum += histogram[low]) > total * 0.01) break;
  for (let sum = 0; high > 0; high -= 1) if ((sum += histogram[high]) > total * 0.01) break;
  const range = Math.max(1, high - low);
  for (let p = 0; p < gray.length; p += 1) gray[p] = Math.max(0, Math.min(255, ((gray[p] - low) * 255) / range));
  return gray;
}

/** Noir et blanc local : chaque pixel est comparé à la moyenne de son voisinage (efface les fonds de sécurité et les ombres). */
function binarize(gray: Uint8ClampedArray, width: number, height: number) {
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let row = 0;
    for (let x = 0; x < width; x += 1) {
      row += gray[y * width + x];
      integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + row;
    }
  }
  const radius = Math.max(12, Math.round(Math.max(width, height) / 40));
  const out = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const sum = integral[y1 * (width + 1) + x1] - integral[y0 * (width + 1) + x1] - integral[y1 * (width + 1) + x0] + integral[y0 * (width + 1) + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      out[y * width + x] = gray[y * width + x] < mean * 0.88 ? 0 : 255;
    }
  }
  return out;
}

function putGray(context: CanvasRenderingContext2D, gray: Uint8ClampedArray, width: number, height: number) {
  const image = context.createImageData(width, height);
  for (let p = 0, i = 0; p < gray.length; p += 1, i += 4) {
    image.data[i] = image.data[i + 1] = image.data[i + 2] = gray[p];
    image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

type Variants = { enhanced: Blob; binary: () => Promise<Blob | null> };

/** Deux versions d'une image : nettoyée (niveaux de gris) tout de suite, noir et blanc à la demande. */
async function variantsOf(source: Blob | HTMLCanvasElement): Promise<Variants | null> {
  let bitmap: ImageBitmap | null = null;
  let width: number;
  let height: number;
  let drawable: ImageBitmap | HTMLCanvasElement;
  if (source instanceof HTMLCanvasElement) {
    drawable = source;
    width = source.width;
    height = source.height;
  } else {
    bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
    drawable = bitmap;
    width = bitmap.width;
    height = bitmap.height;
  }
  const scaled = drawScaled(drawable, width, height);
  bitmap?.close();
  if (!scaled) return null;
  const { canvas, context } = scaled;
  const gray = grayscale(context, canvas.width, canvas.height);
  putGray(context, gray, canvas.width, canvas.height);
  const enhanced = await canvasToBlob(canvas);
  if (!enhanced) return null;
  return {
    enhanced,
    binary: async () => {
      putGray(context, binarize(gray, canvas.width, canvas.height), canvas.width, canvas.height);
      return canvasToBlob(canvas);
    },
  };
}

// --- PDF ---------------------------------------------------------------------------------------------------------------

/** Fait échouer une opération qui ne se termine pas (le rendu d'une page peut rester bloqué dans un onglet en arrière-plan). */
const within = <T,>(promise: Promise<T>, ms: number) =>
  Promise.race([promise, new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

/** Image RGBA brute (extraite d'un PDF) → canvas. */
function canvasOfPixels(data: Uint8Array, width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.putImageData(new ImageData(Uint8ClampedArray.from(data.subarray(0, width * height * 4)), width, height), 0, 0);
  return canvas;
}

/** Texte intégré d'un PDF créé par ordinateur, et ses premières pages en images pour les PDF scannés. */
async function openPdf(file: File) {
  const { getDocumentProxy, extractText, extractImages } = await import('unpdf');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocumentProxy(bytes.slice());
  const pageCount = Math.min(pdf.numPages, PDF_PAGES);
  let text = '';
  try {
    text = (await extractText(pdf, { mergePages: true })).text;
  } catch {
    text = '';
  }
  const pages = async () => {
    const canvases: HTMLCanvasElement[] = [];
    for (let number = 1; number <= pageCount; number += 1) {
      // Un PDF scanné contient la photo de la pièce : on la prend telle quelle (plus net et plus rapide qu'un rendu de la page).
      try {
        const images = (await within(extractImages(bytes.slice(), number), 30_000)).filter((image) => image.width >= 200 && image.height >= 120);
        const biggest = images.sort((a, b) => b.width * b.height - a.width * a.height)[0];
        const canvas = biggest && canvasOfPixels(biggest.data, biggest.width, biggest.height);
        if (canvas) {
          canvases.push(canvas);
          continue;
        }
      } catch {
        // Pas d'image exploitable : on essaie de dessiner la page.
      }
      try {
        const page = await pdf.getPage(number);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(4, Math.max(1.5, 2200 / Math.max(base.width, base.height))) });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const context = canvas.getContext('2d');
        if (!context) continue;
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await within(page.render({ canvasContext: context, viewport, canvas }).promise, 20_000);
        canvases.push(canvas);
      } catch {
        // Page illisible : on passe à la suivante.
      }
    }
    return canvases;
  };
  return { text, pages };
}

// --- Lecture -----------------------------------------------------------------------------------------------------------

const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

async function readDocument(file: File, kind: ScanKind, wanted: ScanField[]): Promise<ScanProposal> {
  const complete = (proposal: ScanProposal) => wanted.every((key) => proposal[key]);
  let proposal: ScanProposal = {};
  let sources: (Blob | HTMLCanvasElement)[];

  if (isPdf(file)) {
    const pdf = await openPdf(file);
    // PDF créé par ordinateur : son texte suffit, sans lecture d'image.
    if (pdf.text.replace(/\s+/g, '').length >= 40) {
      proposal = proposalOf(pdf.text, kind);
      if (complete(proposal)) return proposal;
    }
    sources = await pdf.pages();
  } else {
    sources = [file];
  }

  // Chargé à la demande : la reconnaissance de texte est lourde et rarement utilisée.
  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker('fra+eng');
  try {
    for (const source of sources) {
      const variants = await variantsOf(source);
      if (!variants) continue;
      const first = await worker.recognize(variants.enhanced);
      proposal = merge(proposal, proposalOf(first.data.text, kind));
      if (complete(proposal)) continue;
      // Il manque des champs : seconde lecture sur une version noir et blanc, en cherchant les textes éparpillés (cartes).
      const binary = await variants.binary();
      if (!binary) continue;
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      const second = await worker.recognize(binary);
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
      proposal = merge(proposal, proposalOf(second.data.text, kind));
      // Les deux textes réunis aident quand le libellé et sa valeur sont dans des passes différentes.
      if (!complete(proposal)) proposal = merge(proposal, proposalOf(`${first.data.text}\n${second.data.text}`, kind));
    }
  } finally {
    await worker.terminate();
  }
  return proposal;
}

/**
 * Lit la photo ou le PDF. `current` sert à ne rien faire quand tous les champs concernés sont déjà remplis.
 * Ne lève jamais d'erreur : un échec (ou une lecture trop longue) revient en `failed`.
 */
export async function scanDocument(file: File, kind: ScanKind, current: Partial<Record<ScanField, string>>): Promise<{ status: ScanStatus; proposal: ScanProposal }> {
  if (!needsScan(current, kind)) return { status: 'skipped', proposal: {} };
  if (!(file.type.startsWith('image/') || isPdf(file)) || file.size > MAX_BYTES) return { status: 'unsupported', proposal: {} };
  const wanted = SCAN_FIELDS[kind].filter(({ key }) => !String(current[key] ?? '').trim()).map(({ key }) => key);
  try {
    const proposal = await Promise.race([
      readDocument(file, kind, wanted),
      new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), SCAN_TIMEOUT_MS)),
    ]);
    return { status: Object.keys(proposal).length ? 'ok' : 'empty', proposal };
  } catch {
    return { status: 'failed', proposal: {} };
  }
}
