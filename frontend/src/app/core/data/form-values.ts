/**
 * Les champs de formulaire laissés vides valent '' : PostgreSQL refuse '' pour une
 * date ou un nombre (« valeur invalide »). On envoie null à la place, ce qui laisse
 * la base appliquer ses règles (valeur par défaut, champ obligatoire).
 */
export function blankToNull<T extends Record<string, any>>(values: T): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(values))
    result[key] = typeof value === 'string' && value.trim() === '' ? null : value;
  return result as T;
}

/**
 * Date ISO → valeur d'un champ « datetime-local », à l'heure locale du poste.
 * (`toISOString()` donnerait l'heure UTC : une heure de moins au Bénin, et chaque
 * enregistrement sans retouche reculait la date d'une heure.)
 */
export function toLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
