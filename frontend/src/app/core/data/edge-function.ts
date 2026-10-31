/**
 * Sur une réponse non-2xx, `functions.invoke` ne donne qu'un message générique ; nos
 * Edge Functions renvoient pourtant `{ error: "<message en français>" }`. On le récupère
 * pour l'afficher tel quel.
 */
export async function edgeFunctionError(result: { data: any; error: any }): Promise<Error | null> {
  if (result.data?.error) return new Error(result.data.error);
  if (!result.error) return null;
  try {
    const body = await result.error.context?.json?.();
    if (body?.error) return new Error(body.error);
  } catch {
    // Corps absent ou non JSON : on garde l'erreur d'origine.
  }
  return result.error;
}
