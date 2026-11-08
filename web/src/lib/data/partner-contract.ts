import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContractSection } from '@/lib/contract-import';
import type { Database, Json } from '@/lib/database.types';

type Db = SupabaseClient<Database>;
export type PartnerTemplate = Database['public']['Tables']['partner_contract_templates']['Row'];

export const TEMPLATE_STATUSES: Record<string, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'muted'; hint: string }> = {
  pending_review: { label: 'En attente de validation', tone: 'warning', hint: 'L’équipe relit votre contrat. Vos contrats utilisent encore le modèle précédent.' },
  approved: { label: 'Validé', tone: 'success', hint: 'Utilisé pour vos nouvelles locations.' },
  rejected: { label: 'Refusé', tone: 'danger', hint: 'Corrigez-le et renvoyez une nouvelle version.' },
  archived: { label: 'Remplacé', tone: 'muted', hint: 'Remplacé par une version plus récente. Les contrats déjà signés ne changent pas.' },
};

export const sectionsOf = (template: Pick<PartnerTemplate, 'content'>): ContractSection[] =>
  ((template.content as { sections?: ContractSection[] } | null)?.sections ?? []).map((section) => ({ title: section.title, clauses: section.clauses ?? [] }));

/** Versions du contrat du partenaire (la plus récente d'abord). L'équipe voit celles de tous les partenaires. */
export function listTemplates(db: Db) {
  return db.from('partner_contract_templates').select('*').order('created_at', { ascending: false });
}

/** Envoie une nouvelle version pour validation (le numéro de version est attribué par la base). */
export function submitTemplate(db: Db, partnerId: string, sections: ContractSection[], fileName: string) {
  return db
    .from('partner_contract_templates')
    .insert({ partner_id: partnerId, content: { sections } as unknown as Json, source_file_name: fileName || null })
    .select()
    .single();
}

/** Lecture d'un PDF par le serveur : renvoie les sections repérées. */
export async function importPdf(file: File) {
  const body = new FormData();
  body.set('file', file);
  let response: Response;
  try {
    response = await fetch('/api/partner-contract/extract', { method: 'POST', body, signal: AbortSignal.timeout(75_000) });
  } catch {
    return { data: null, error: 'L’envoi ou la lecture du PDF a échoué (connexion lente ou fichier trop lourd). Réessayez, ou saisissez les clauses à la main.' };
  }
  const payload = (await response.json().catch(() => ({}))) as { error?: string; sections?: ContractSection[]; warnings?: string[]; pages?: number; fileName?: string };
  if (!response.ok) return { data: null, error: payload.error ?? 'Lecture impossible.' };
  return { data: { sections: payload.sections ?? [], warnings: payload.warnings ?? [], pages: payload.pages ?? 0, fileName: payload.fileName ?? file.name }, error: null };
}

/** Logo du partenaire : un fichier par envoi (un contrat déjà créé garde son logo), chemin enregistré sur sa fiche. */
export async function uploadLogo(db: Db, partnerId: string, file: File) {
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `partners/${partnerId}/logo-${Date.now()}.${extension}`;
  const upload = await db.storage.from('contract-assets').upload(path, file, { upsert: false, contentType: file.type });
  if (upload.error) return upload.error;
  const saved = await db.from('partners').update({ logo_path: path }).eq('id', partnerId);
  return saved.error;
}

export async function logoUrl(db: Db, path: string | null | undefined) {
  if (!path) return null;
  return (await db.storage.from('contract-assets').createSignedUrl(path, 300)).data?.signedUrl ?? null;
}

/** Décision de l'équipe : valide ou refuse une version (le motif est obligatoire pour un refus). */
export function reviewTemplate(db: Db, id: string, approve: boolean, note: string) {
  return db.rpc('review_partner_contract_template', { target_id: id, approve, note: note || undefined });
}

/** Accord (ou retrait de l'accord) du partenaire pour afficher son logo sur le site public. */
export function setLogoPublicConsent(db: Db, partnerId: string, consent: boolean) {
  return db.from('partners').update({ logo_public_consent: consent }).eq('id', partnerId);
}
