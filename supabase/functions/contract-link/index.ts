// Signature d'un contrat par lien (locataire, sans compte) — docs/business-rules.md, section 9.
//
// Fonction publique (verify_jwt désactivé) : elle se protège elle-même. Chaque appel porte le code secret du lien ; seule
// son empreinte SHA-256 est comparée à la base. Toute la logique d'état est dans les fonctions SQL contract_link_*
// (réservées au service_role) ; cette fonction ne fait que le stockage et la validation des entrées.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

class Refusal extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (value: string | Uint8Array) =>
  hex(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? new TextEncoder().encode(value) : value));

function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function dataUrl(bucket: string, path: string, fallbackType = 'image/png') {
  const file = await admin.storage.from(bucket).download(path);
  if (file.error || !file.data) return null;
  const bytes = new Uint8Array(await file.data.arrayBuffer());
  if (bytes.length > 4_000_000) return null;
  return `data:${file.data.type || fallbackType};base64,${toBase64(bytes)}`;
}

type Link = {
  state: string;
  contract_id: string;
  contract_number: string | null;
  content: Record<string, any>;
  final_pdf_storage_path: string | null;
  signed_at: string | null;
  expires_at: string;
  signatures: { signer_type: string; signer_name: string; signed_at: string; path: string }[];
};

async function load(token: unknown) {
  if (typeof token !== 'string' || !/^[0-9a-f]{48}$/.test(token)) throw new Refusal('Lien invalide.', 404);
  const hash = await sha256(token);
  const { data, error } = await admin.rpc('contract_link_get', { link_hash: hash });
  if (error) throw new Refusal('Lien indisponible.', 500);
  if (!data) throw new Refusal('Lien invalide.', 404);
  return { hash, link: data as Link };
}

const fileNameOf = (link: Link) => `contrat-${String(link.contract_number ?? link.contract_id).replace(/[^A-Za-z0-9-]/g, '')}.pdf`;
const pdfPathOf = (link: Link) => `contracts/${link.contract_id}/pdf/${fileNameOf(link)}`;

/** Le locataire ne reçoit que ce qui est imprimé sur le contrat : jamais les notes internes ni les champs de gestion. */
const pick = (source: Record<string, unknown> | null | undefined, keys: string[]) =>
  Object.fromEntries(keys.filter((key) => source?.[key] !== undefined).map((key) => [key, source![key]]));

function publicContent(content: Record<string, any>) {
  return {
    template: content.template ?? null,
    company: pick(content.company, ['company_name', 'address', 'phone', 'email', 'rccm', 'ifu', 'is_partner', 'logo_storage_path']),
    client: pick(content.client, ['id', 'first_name', 'last_name', 'phone', 'residence', 'address', 'id_document_type', 'id_document_number',
      'driving_license_number', 'driving_license_expiry_date', 'emergency_contact_name', 'emergency_contact_phone']),
    vehicle: pick(content.vehicle, ['make', 'model', 'registration_number', 'color']),
    rental: pick(content.rental, ['departure_date', 'return_date', 'departure_location', 'return_location', 'with_driver',
      'driver_daily_price', 'driving_zone', 'rental_price', 'deposit_amount']),
  };
}

async function view(token: unknown) {
  const { link } = await load(token);
  const base = {
    state: link.state,
    contract_number: link.contract_number,
    content: publicContent(link.content ?? {}),
    signed_at: link.signed_at,
    expires_at: link.expires_at,
    file_name: fileNameOf(link),
  };
  if (link.state !== 'ready' && link.state !== 'finalizing') return { ...base, content: link.state === 'signed' ? base.content : null };

  const company = link.content.company ?? {};
  const logoPath: string | undefined = company.logo_storage_path ?? undefined;
  const logo = logoPath
    ? await dataUrl(String(logoPath).startsWith('partners/') ? 'contract-assets' : 'rental-documents', logoPath, 'image/jpeg')
    : null;

  const signatures: { signer_type: string; signed_at: string; image: string | null }[] = [];
  for (const signature of link.signatures)
    signatures.push({ signer_type: signature.signer_type, signed_at: signature.signed_at, image: await dataUrl('contract-assets', signature.path) });

  const documents: { title: string; image: string }[] = [];
  const clientId = link.content.client?.id;
  if (clientId) {
    const { data } = await admin
      .from('client_documents')
      .select('document_type,storage_path,mime_type')
      .eq('client_id', clientId)
      .in('document_type', ['identity_document', 'driving_license'])
      .order('created_at', { ascending: false });
    for (const document of data ?? []) {
      if (!String(document.mime_type ?? '').startsWith('image/')) continue;
      const image = await dataUrl('rental-documents', document.storage_path, document.mime_type);
      if (image)
        documents.push({
          title: document.document_type === 'identity_document' ? 'PIÈCE D’IDENTITÉ DU LOCATAIRE' : 'PERMIS DE CONDUIRE DU LOCATAIRE',
          image,
        });
    }
  }
  return { ...base, logo, signatures, documents };
}

async function sign(body: Record<string, unknown>, request: Request) {
  const { hash, link } = await load(body.token);
  if (link.state !== 'ready') throw new Refusal('Ce lien ne permet plus de signer.', 409);
  const image = String(body.signature ?? '');
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!match || image.length > 2_000_000) throw new Refusal('Signature invalide.');
  const bytes = Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0));
  if (bytes.length < 200) throw new Refusal('La signature ne peut pas être vide.');

  const client = link.content.client ?? {};
  const name = `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || 'Locataire';
  const path = `contracts/${link.contract_id}/signatures/client.png`;
  const upload = await admin.storage.from('contract-assets').upload(path, bytes, { upsert: true, contentType: 'image/png' });
  if (upload.error) throw new Refusal('Enregistrement impossible.', 500);

  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('cf-connecting-ip');
  const { error } = await admin.rpc('contract_link_record_signature', {
    link_hash: hash,
    signature_path: path,
    signature_name: name,
    signature_hash: await sha256(bytes),
    ip: forwarded ?? null,
    user_agent: request.headers.get('user-agent') ?? '',
  });
  if (error) {
    await admin.storage.from('contract-assets').remove([path]);
    throw new Refusal('Signature refusée : ce lien n’est plus valable.', 409);
  }
  return { ok: true };
}

async function prepareUpload(token: unknown) {
  const { link } = await load(token);
  if (link.state !== 'finalizing') throw new Refusal('Le contrat n’attend pas de PDF.', 409);
  const path = pdfPathOf(link);
  const upload = await admin.storage.from('contract-assets').createSignedUploadUrl(path, { upsert: true });
  if (upload.error) throw new Refusal('Envoi impossible.', 500);
  return { path, token: upload.data.token };
}

async function archive(token: unknown) {
  const { hash, link } = await load(token);
  if (link.state !== 'finalizing') throw new Refusal('Le contrat n’attend pas de PDF.', 409);
  const path = pdfPathOf(link);
  const listed = await admin.storage.from('contract-assets').list(`contracts/${link.contract_id}/pdf`, { search: fileNameOf(link) });
  if (!listed.data?.some((file) => file.name === fileNameOf(link))) throw new Refusal('Le PDF n’a pas été reçu.', 409);
  const { error } = await admin.rpc('contract_link_archive', { link_hash: hash, pdf_path: path });
  if (error) throw new Refusal('Finalisation refusée.', 409);
  return { ok: true };
}

async function download(token: unknown) {
  const { link } = await load(token);
  if (link.state !== 'signed' || !link.final_pdf_storage_path) throw new Refusal('Le contrat n’est pas disponible.', 409);
  const signed = await admin.storage.from('contract-assets').createSignedUrl(link.final_pdf_storage_path, 300, { download: fileNameOf(link) });
  if (signed.error) throw new Refusal('Téléchargement impossible.', 500);
  return { url: signed.data.signedUrl };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await request.json();
    const result =
      body.action === 'view' ? await view(body.token)
      : body.action === 'sign' ? await sign(body, request)
      : body.action === 'prepare-upload' ? await prepareUpload(body.token)
      : body.action === 'archive' ? await archive(body.token)
      : body.action === 'download' ? await download(body.token)
      : (() => { throw new Refusal('Action inconnue.'); })();
    return Response.json(result, { headers: cors });
  } catch (error) {
    const status = error instanceof Refusal ? error.status : 500;
    return Response.json({ error: error instanceof Refusal ? error.message : 'Erreur serveur.' }, { status, headers: cors });
  }
});
