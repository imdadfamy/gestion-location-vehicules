import { NextResponse } from 'next/server';
import { extractText, getDocumentProxy } from 'unpdf';
import { structureContract } from '@/lib/contract-import';
import { sessionProfile } from '@/lib/session';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PAGES = 40;
const READ_TIMEOUT_MS = 40_000;

// Laisse à la lecture le temps de finir ; au-delà, on répond une erreur claire plutôt que de laisser l'écran tourner.
export const maxDuration = 60;

/**
 * Lit le PDF du contrat d'un partenaire et le découpe en sections et clauses (voir `lib/contract-import.ts`).
 * Réservé au compte partenaire connecté. Le fichier est lu en mémoire sur notre serveur : il n'est ni conservé ni
 * envoyé à un service externe. Le partenaire relit et corrige le résultat avant de l'envoyer pour validation.
 */
export async function POST(request: Request) {
  const profile = await sessionProfile();
  if (!profile || profile.role !== 'partner' || !profile.is_active) {
    return NextResponse.json({ error: 'Réservé aux partenaires connectés.' }, { status: 403 });
  }
  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get('file');
  } catch {
    return NextResponse.json({ error: 'Fichier illisible.' }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ error: 'Aucun fichier reçu.' }, { status: 400 });
  if (file.size === 0 || file.size > MAX_BYTES) return NextResponse.json({ error: 'Le PDF doit faire moins de 5 Mo.' }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Un vrai PDF commence par « %PDF » (le type envoyé par le navigateur ne suffit pas).
  if (String.fromCharCode(...bytes.slice(0, 4)) !== '%PDF') return NextResponse.json({ error: 'Ce fichier n’est pas un PDF.' }, { status: 400 });

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const read = async () => {
      const pdf = await getDocumentProxy(bytes);
      if (pdf.numPages > MAX_PAGES) return null;
      return extractText(pdf, { mergePages: false });
    };
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), READ_TIMEOUT_MS);
    });
    const outcome = await Promise.race([read(), timeout]);
    if (outcome === 'timeout') {
      console.error('partner-contract/extract: lecture trop longue', file.size, 'octets');
      return NextResponse.json({ error: 'La lecture de ce PDF prend trop de temps. Essayez un PDF plus simple (exporté depuis un traitement de texte) ou saisissez les clauses à la main.' }, { status: 408 });
    }
    if (!outcome) return NextResponse.json({ error: `Le PDF dépasse ${MAX_PAGES} pages.` }, { status: 400 });
    const { text, totalPages } = outcome;
    const result = structureContract(text);
    return NextResponse.json({ ...result, pages: totalPages, fileName: file.name.slice(0, 200) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('partner-contract/extract:', error);
    return NextResponse.json({ error: 'Ce PDF n’a pas pu être lu (protégé ou abîmé ?).' }, { status: 422 });
  } finally {
    clearTimeout(timer);
  }
}
