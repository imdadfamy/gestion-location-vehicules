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
