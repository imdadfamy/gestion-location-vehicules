import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/database.types';

type Db = SupabaseClient<Database>;
type Tone = 'success' | 'info' | 'warning' | 'danger' | 'muted';
export type Contract = Database['public']['Tables']['contracts']['Row'];
export type SignerType = 'client' | 'responsable';

export const CONTRACT_STATUSES: Record<string, { label: string; tone: Tone }> = {
  draft: { label: 'Brouillon', tone: 'muted' },
  pending_signature: { label: 'En attente des signatures', tone: 'warning' },
  signed: { label: 'Signé', tone: 'success' },
  cancelled: { label: 'Annulé', tone: 'muted' },
};

/** Contenu figé dans le contrat à sa création (modèle, entreprise, client, véhicule, location). */
export type ContractContent = {
  template?: { sections?: { title: string; clauses?: string[] }[] };
  company?: Record<string, string | null>;
  client?: Record<string, string | null>;
  vehicle?: Record<string, string | number | null>;
  rental?: Record<string, string | number | null>;
};
export const contentOf = (contract: Contract) => (contract.generated_content ?? {}) as ContractContent;

export function listContracts(db: Db) {
  return db.from('contracts').select('*').order('created_at', { ascending: false });
}

type PendingRental = Database['public']['Tables']['rentals']['Row'] & {
  clients: Database['public']['Tables']['clients']['Row'] | null;
  vehicles: Database['public']['Tables']['vehicles']['Row'] | null;
};

/** Locations en attente qui n'ont pas encore de contrat. */
export async function rentalsWithoutContract(db: Db) {
  const [rentals, contracts] = await Promise.all([
    db.from('rentals').select('*,clients(*),vehicles(*)').eq('status', 'pending').returns<PendingRental[]>(),
    db.from('contracts').select('rental_id'),
  ]);
  const error = rentals.error ?? contracts.error;
  if (error) return { data: null, error };
  const used = new Set((contracts.data ?? []).map((c) => c.rental_id));
  return { data: (rentals.data ?? []).filter((r) => !used.has(r.id)), error: null };
}

/**
 * Crée le contrat à partir de la dernière version du modèle de location actif.
 * Le contenu est figé dans `generated_content` : une modification ultérieure du
 * modèle ne touche jamais un contrat existant (versioning obligatoire).
 */
export async function createContract(db: Db, rental: PendingRental) {
  const already = await db.from('contracts').select('contract_number').eq('rental_id', rental.id).maybeSingle();
  if (already.error) return { data: null, error: already.error };
  if (already.data)
    return {
      data: null,
      error: new Error(`Un contrat existe déjà pour cette location (${already.data.contract_number ?? 'sans numéro'}).`),
    };
  const template = await db
    .from('contract_templates')
    .select('id')
    .eq('template_type', 'rental')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();
  if (template.error) return { data: null, error: template.error };
  const version = await db
    .from('contract_template_versions')
    .select('*')
    .eq('template_id', template.data.id)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();
  if (version.error) return { data: null, error: version.error };
  const company = await db.from('company_settings').select('*').limit(1).maybeSingle();
  if (company.error) return { data: null, error: company.error };
  const content = {
    template: version.data.content,
    company: company.data,
    client: rental.clients,
    vehicle: rental.vehicles,
    rental,
  };
  const sections = ((version.data.content ?? {}) as ContractContent['template'])?.sections ?? [];
  return db
    .from('contracts')
    .insert({
      rental_id: rental.id,
      template_id: version.data.template_id,
      template_version_id: version.data.id,
      status: 'pending_signature',
      generated_content: content as unknown as Json,
      generated_html: sections.map((s) => [s.title, ...(s.clauses ?? [])].join('\n')).join('\n\n'),
    })
    .select()
    .single();
}

export function contractSignatures(db: Db, contractId: string) {
  return db.from('contract_signatures').select('*').eq('contract_id', contractId);
}

/** Enregistre l'image de la signature puis la ligne contract_signatures. */
export async function addSignature(db: Db, contractId: string, signerType: SignerType, signerName: string, image: Blob) {
  const path = `contracts/${contractId}/signatures/${signerType}.png`;
  const upload = await db.storage.from('contract-assets').upload(path, image, { upsert: false, contentType: 'image/png' });
  if (upload.error) return upload.error;
  const saved = await db.from('contract_signatures').insert({
    contract_id: contractId,
    signer_type: signerType,
    signer_name: signerName,
    signature_storage_path: path,
    signer_user_agent: navigator.userAgent,
  });
  return saved.error;
}

/** Archive le PDF final puis passe le contrat à « signé » (il devient immuable côté base). */
export async function archiveSignedPdf(db: Db, contractId: string, fileName: string, pdf: Blob) {
  const path = `contracts/${contractId}/pdf/${fileName}`;
  const upload = await db.storage.from('contract-assets').upload(path, pdf, { upsert: false, contentType: 'application/pdf' });
  if (upload.error) return { data: null, error: upload.error };
  return db
    .from('contracts')
    .update({ final_pdf_storage_path: path, status: 'signed', signed_at: new Date().toISOString() })
    .eq('id', contractId)
    .select()
    .single();
}

export function contractPdfUrl(db: Db, path: string) {
  return db.storage.from('contract-assets').createSignedUrl(path, 60);
}

/** Pièce d'identité et permis du client, joints au PDF du contrat. */
export function identityDocuments(db: Db, clientId: string) {
  return db
    .from('client_documents')
    .select('*')
    .eq('client_id', clientId)
    .in('document_type', ['identity_document', 'driving_license'])
    .order('created_at', { ascending: false });
}

/** Durée affichée dans le contrat (« 3 jours et 9 h »), comme l'écran Angular. */
export function contractDuration(rental: ContractContent['rental']) {
  const a = rental?.departure_date;
  const b = rental?.return_date;
  if (!a || !b) return 'Non renseignée';
  const hours = Math.max(1, Math.ceil((new Date(String(b)).getTime() - new Date(String(a)).getTime()) / 3600000));
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return days ? `${days} jour${days > 1 ? 's' : ''}${rest ? ` et ${rest} h` : ''}` : `${hours} h`;
}

/** Mode de location écrit dans le contrat : avec ou sans chauffeur (supplément par jour). */
export function contractDriver(rental: { with_driver?: unknown; driver_daily_price?: unknown } | undefined | null) {
  return rental?.with_driver ? `Avec chauffeur (supplément de ${contractMoney(rental.driver_daily_price)} par jour)` : 'Sans chauffeur (le locataire conduit)';
}

/** Montant du contrat : « 35 000 FCFA » (espaces simples, compatibles avec le PDF). */
export function contractMoney(value: unknown) {
  return `${Number(value ?? 0).toLocaleString('en-US').replace(/,/g, ' ')} FCFA`;
}
