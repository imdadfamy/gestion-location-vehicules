/**
 * Transforme le texte d'un contrat PDF (une chaîne par page) en sections et clauses, prêtes à être relues par le
 * partenaire. Aucune IA ni service externe : des règles simples (titres numérotés ou en majuscules, paragraphes
 * recomposés, en-têtes et pieds de page répétés retirés). Le résultat est toujours relu et corrigé par le partenaire,
 * puis validé par l'équipe avant d'être utilisé.
 *
 * Les parties « à remplir » du contrat d'origine (nom, véhicule, dates, prix, lignes de points, signatures) sont écartées :
 * la plateforme les génère elle-même dans chaque contrat. Fichier sans dépendance (utilisable côté serveur et dans les tests).
 */

export type ContractSection = { title: string; clauses: string[] };
export type ImportResult = { sections: ContractSection[]; warnings: string[]; characters: number };

const MAX_SECTIONS = 80;
const MAX_CLAUSES = 200;
const MAX_CLAUSE = 3500;

const normalize = (line: string) => line.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();

const PAGE_NUMBER = /^(page\s*)?\d+\s*(\/|sur|of)?\s*\d*$/i;
/** Ligne « à remplir » ou zone de signature du contrat d'origine. */
const FILL_IN = /(\.{4,}|_{3,}|…{2,}|-{6,})|^(fait\s+à|signature|lu\s+et\s+approuvé|le\s+locataire\s*:|le\s+loueur\s*:|cachet)/i;
const NUMBERED = /^(\d{1,2}(\.\d{1,2})*|[IVXL]{1,6}|[A-Z])\s*[.)\-–:]\s+\S/;
const BULLET = /^[-•–*▪●○]\s+\S/;
const KEYWORD_HEADING = /^(article|titre|chapitre|section|clause)\s+[\dIVXLC]+/i;

function isHeading(line: string) {
  if (line.length > 90 || line.length < 3) return false;
  if (KEYWORD_HEADING.test(line)) return true;
  const letters = line.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
  const upper = line.replace(/[^A-ZÀ-ÖØ-Þ]/g, '');
  if (letters.length >= 4 && upper.length / letters.length >= 0.75 && !/[.;]$/.test(line)) return true;
  // « 3. Assurance » : numéroté, court, sans phrase.
  return NUMBERED.test(line) && !/[.;:!?]$/.test(line) && line.split(/\s+/).length <= 9;
}

const startsClause = (line: string) => NUMBERED.test(line) || BULLET.test(line);

function splitLong(text: string): string[] {
  if (text.length <= MAX_CLAUSE) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > MAX_CLAUSE) {
    const cut = rest.lastIndexOf('. ', MAX_CLAUSE);
    const at = cut > MAX_CLAUSE / 2 ? cut + 1 : MAX_CLAUSE;
    parts.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export function structureContract(pages: string[]): ImportResult {
  const warnings: string[] = [];
  const cleaned = pages.map((page) => page.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()));

  // En-têtes et pieds de page : une même ligne (chiffres mis à part) sur la plupart des pages.
  const repeated = new Set<string>();
  if (cleaned.length >= 2) {
    const counts = new Map<string, number>();
    for (const lines of cleaned) for (const key of new Set(lines.filter(Boolean).map(normalize))) counts.set(key, (counts.get(key) ?? 0) + 1);
    const threshold = Math.max(2, Math.ceil(cleaned.length * 0.6));
    for (const [key, count] of counts) if (count >= threshold) repeated.add(key);
  }

  const lines = cleaned
    .flat()
    .filter((line) => line && !PAGE_NUMBER.test(line) && !repeated.has(normalize(line)));
  const characters = lines.join(' ').length;
  if (characters < 300) {
    warnings.push('Très peu de texte a pu être lu : ce PDF est peut-être une photo ou un scan. Utilisez un PDF créé depuis un traitement de texte, ou saisissez les clauses à la main.');
  }

  const sections: ContractSection[] = [];
  let current: ContractSection | null = null;
  let paragraph = '';
  let dropped = 0;

  const flush = () => {
    if (!paragraph) return;
    if (!current) {
      current = { title: 'Conditions générales', clauses: [] };
      sections.push(current);
    }
    current.clauses.push(...splitLong(paragraph.trim()));
    paragraph = '';
  };

  for (const line of lines) {
    if (FILL_IN.test(line)) {
      dropped += 1;
      continue;
    }
    if (isHeading(line)) {
      flush();
      // Deux titres de suite : le premier (titre du document) est écarté s'il n'a pas de contenu.
      if (current && !(current as ContractSection).clauses.length) sections.pop();
      current = { title: line.replace(/\s*[:.]$/, ''), clauses: [] };
      sections.push(current);
      continue;
    }
    if (!paragraph) {
      paragraph = line;
      continue;
    }
    const previousEnds = /[.!?:;]$/.test(paragraph);
    if (startsClause(line) || (previousEnds && /^[A-ZÀ-ÖØ-Þ0-9]/.test(line))) {
      flush();
      paragraph = line;
    } else if (/[a-zà-ÿ]-$/.test(paragraph) && /^[a-zà-ÿ]/.test(line)) {
      paragraph = paragraph.slice(0, -1) + line;
    } else {
      paragraph += ' ' + line;
    }
  }
  flush();

  const filled = sections.filter((section) => section.clauses.length);
  if (dropped) warnings.push(`${dropped} ligne(s) à remplir ou zone(s) de signature ont été écartées : la plateforme génère elle-même les parties du contrat, le véhicule, la durée, le prix et les signatures.`);
  if (filled.length > MAX_SECTIONS) warnings.push(`Seules les ${MAX_SECTIONS} premières sections ont été gardées.`);
  const limited = filled.slice(0, MAX_SECTIONS).map((section) => {
    if (section.clauses.length > MAX_CLAUSES) warnings.push(`La section « ${section.title} » a été raccourcie à ${MAX_CLAUSES} clauses.`);
    return { title: section.title.slice(0, 200), clauses: section.clauses.slice(0, MAX_CLAUSES) };
  });
  if (!limited.length && characters >= 300) warnings.push('Aucune clause n’a pu être repérée automatiquement. Ajoutez-les à la main.');
  return { sections: limited, warnings, characters };
}
