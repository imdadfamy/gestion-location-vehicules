'use client';

import { useEffect, useRef, useState } from 'react';
import { fillEmpty, scanDocument, scanMessage, type ScanField, type ScanKind } from '@/lib/identity-scan';

/**
 * Lecture automatique d'une pièce ajoutée dans un formulaire (voir `lib/identity-scan.ts`).
 * `values` : les champs du formulaire à l'instant présent ; `setValues` : les remplace.
 * La lecture ne remplit que les champs encore vides au moment où elle se termine : ce que la personne a tapé
 * ou modifié pendant la lecture n'est jamais écrasé, et tout reste modifiable ensuite.
 */
export function useDocumentScan<T extends Partial<Record<ScanField, string>>>(values: T, setValues: (next: T) => void) {
  const latest = useRef(values);
  useEffect(() => {
    latest.current = values;
  });
  const [notes, setNotes] = useState<Partial<Record<ScanKind, string>>>({});
  const [busy, setBusy] = useState<ScanKind | null>(null);

  async function scan(kind: ScanKind, file: File | undefined) {
    if (!file) return setNotes((current) => ({ ...current, [kind]: undefined }));
    setBusy(kind);
    setNotes((current) => ({ ...current, [kind]: 'Lecture de la pièce en cours…' }));
    const { status, proposal } = await scanDocument(file, kind, latest.current);
    const { next, filled } = fillEmpty(latest.current, proposal, kind);
    if (filled.length) setValues(next);
    setNotes((current) => ({ ...current, [kind]: scanMessage(status, filled) }));
    setBusy(null);
  }

  return { scan, notes, busy };
}
