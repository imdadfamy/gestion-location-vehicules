import type { ClientRecord } from './client-portal';

/** Réservation du client avec l'état de son dossier, de son contrat et de ses inspections. */
export type TrackedReservation = {
  id: string;
  status: string;
  created_at: string;
  planned_departure_date: string;
  planned_return_date: string;
  observation: string | null;
  rental_id: string | null;
  client_contract_sent_at: string | null;
  rental_status: string | null;
  contract_status: string | null;
  client_signed: boolean;
  has_departure: boolean;
  has_return: boolean;
  vehicles: { make: string; model: string; registration_number: string } | null;
};

export const TRACK_STEPS = ['Demandée', 'Validée', 'Dossier à signer', 'Contrat signé', 'Véhicule remis', 'Retourné'] as const;

/** Étapes franchies d'une réservation, dans l'ordre de la frise. */
export function reachedSteps(row: TrackedReservation) {
  const validated = row.status === 'validated' || row.status === 'finalized' || !!row.rental_id;
  const started = row.has_departure || ['active', 'overdue', 'completed'].includes(row.rental_status ?? '');
  return [
    true,
    validated,
    validated && (!!row.client_contract_sent_at || !!row.rental_id),
    row.client_signed,
    started && row.client_signed,
    row.has_return || row.rental_status === 'completed',
  ];
}

/** Index de l'étape en cours (la première non franchie), ou la longueur si tout est terminé. */
export const currentStep = (row: TrackedReservation) => {
  const reached = reachedSteps(row);
  const index = reached.indexOf(false);
  return index === -1 ? reached.length : index;
};

/** Ce que le client attend à chaque étape. */
export const STEP_HINTS = [
  'Votre demande est enregistrée.',
  'L’agence vérifie la disponibilité et valide votre demande.',
  'L’agence prépare votre dossier : vous serez invité(e) à le signer.',
  'Signez votre dossier depuis « Contrats ».',
  'À la remise des clés, faites l’inspection de départ.',
  'À la restitution, faites l’inspection de retour.',
];

// ── Dossier du client : ce qu'il faut pour signer ──
type Check = { label: string; step: number; ok: (client: Partial<ClientRecord>, documentTypes: Set<string | null>) => boolean };

/** Pas du profil guidé : 0 identité, 1 pièce d'identité, 2 permis, 3 contact d'urgence. */
export const PROFILE_STEPS = ['Identité', 'Pièce d’identité', 'Permis de conduire', 'Contact d’urgence'] as const;

const filled = (value: string | null | undefined) => !!value?.trim();

export const REQUIRED: Check[] = [
  { label: 'prénom', step: 0, ok: (c) => filled(c.first_name) },
  { label: 'nom', step: 0, ok: (c) => filled(c.last_name) },
  { label: 'téléphone', step: 0, ok: (c) => filled(c.phone) },
  { label: 'type de pièce', step: 1, ok: (c) => filled(c.id_document_type) },
  { label: 'numéro de pièce', step: 1, ok: (c) => filled(c.id_document_number) },
  { label: 'adresse', step: 1, ok: (c) => filled(c.address) },
  { label: 'résidence', step: 1, ok: (c) => filled(c.residence) },
  { label: 'photo de la pièce d’identité', step: 1, ok: (_c, docs) => docs.has('identity_document') },
  { label: 'numéro de permis', step: 2, ok: (c) => filled(c.driving_license_number) },
  { label: 'expiration du permis', step: 2, ok: (c) => !!c.driving_license_expiry_date },
  { label: 'photo du permis', step: 2, ok: (_c, docs) => docs.has('driving_license') },
  { label: 'contact d’urgence', step: 3, ok: (c) => filled(c.emergency_contact_name) },
  { label: 'numéro d’urgence', step: 3, ok: (c) => filled(c.emergency_contact_phone) },
];

/** Informations obligatoires encore manquantes avant la signature, avec le pas du profil qui les contient. */
export function missingItems(client: Partial<ClientRecord>, documentTypes: Set<string | null>) {
  return REQUIRED.filter((check) => !check.ok(client, documentTypes)).map(({ label, step }) => ({ label, step }));
}

// ── Prochaines actions et rappels ──
export type NextAction = { key: string; tone: 'primary' | 'info' | 'muted'; title: string; text: string; href: string; cta: string };

const name = (row: TrackedReservation) => `${row.vehicles?.make ?? ''} ${row.vehicles?.model ?? ''}`.trim() || 'votre véhicule';
const DAY = 86400000;

export function nextActions(rows: TrackedReservation[], missing: { label: string }[], hasRecord: boolean, now = Date.now()): NextAction[] {
  const live = rows.filter((row) => row.status !== 'cancelled');
  const actions: NextAction[] = [];

  for (const row of live) {
    if (row.status === 'validated' && row.client_contract_sent_at && !row.rental_id)
      actions.push({ key: `dossier-${row.id}`, tone: 'primary', title: 'Signez votre dossier de location', text: `L’agence a préparé votre dossier pour ${name(row)}. Vérifiez-le puis signez à l’écran.`, href: '/client/contracts', cta: 'Signer mon dossier' });
    else if (row.rental_id && !row.client_signed && row.contract_status !== 'signed')
      actions.push({ key: `contract-${row.id}`, tone: 'primary', title: 'Votre contrat attend votre signature', text: `Contrat de ${name(row)}.`, href: '/client/contracts', cta: 'Signer mon contrat' });
  }

  if (missing.length && (live.length || hasRecord)) {
    const first = missing.slice(0, 4).map((item) => item.label).join(', ');
    actions.push({
      key: 'profile',
      tone: live.some((row) => row.client_contract_sent_at) ? 'primary' : 'info',
      title: 'Complétez votre profil',
      text: `Il manque ${missing.length} information${missing.length > 1 ? 's' : ''} pour signer : ${first}${missing.length > 4 ? '…' : ''}.`,
      href: '/client/account',
      cta: 'Compléter mon profil',
    });
  }

  for (const row of live) {
    if (!row.rental_id || !row.client_signed) continue;
    const departure = new Date(row.planned_departure_date).getTime();
    const end = new Date(row.planned_return_date).getTime();
    if (!row.has_departure && departure - now < DAY && row.rental_status !== 'completed')
      actions.push({ key: `departure-${row.id}`, tone: 'primary', title: 'Faites l’inspection de départ', text: `À la remise de ${name(row)}, photographiez le véhicule et notez le kilométrage.`, href: '/client/inspections', cta: 'Inspection de départ' });
    if (row.has_departure && !row.has_return && end - now < DAY)
      actions.push({ key: `return-${row.id}`, tone: 'primary', title: 'Faites l’inspection de retour', text: `Au retour de ${name(row)}, refaites les photos et le relevé du kilométrage.`, href: '/client/inspections', cta: 'Inspection de retour' });
  }

  for (const row of live.filter((item) => item.status === 'pending'))
    actions.push({ key: `wait-${row.id}`, tone: 'muted', title: 'En attente de validation', text: `Votre demande pour ${name(row)} est en cours d’étude par l’agence.`, href: '/client/reservations', cta: 'Voir le suivi' });

  if (!actions.length)
    actions.push({ key: 'book', tone: 'info', title: 'Aucune action en attente', text: 'Tout est à jour. Besoin d’un véhicule ?', href: '/client/vehicles', cta: 'Voir les véhicules' });
  return actions;
}

const dayLabel = (diff: number) => (diff <= 0 ? 'aujourd’hui' : diff < DAY ? 'dans moins de 24 h' : diff < 2 * DAY ? 'demain' : `dans ${Math.ceil(diff / DAY)} jours`);
const hour = (ms: number) => new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Rappels affichés dans l'espace : départ et retour proches, retard. */
export function reminders(rows: TrackedReservation[], now = Date.now()) {
  const list: { key: string; tone: 'info' | 'danger'; text: string }[] = [];
  for (const row of rows.filter((item) => item.status !== 'cancelled' && item.status !== 'pending')) {
    const departure = new Date(row.planned_departure_date).getTime();
    const end = new Date(row.planned_return_date).getTime();
    if (!row.has_departure && departure > now && departure - now < 3 * DAY)
      list.push({ key: `d-${row.id}`, tone: 'info', text: `Départ ${dayLabel(departure - now)} à ${hour(departure)} : ${name(row)}.` });
    if (row.has_departure && !row.has_return) {
      if (end < now) list.push({ key: `late-${row.id}`, tone: 'danger', text: `Le retour de ${name(row)} était prévu le ${new Date(end).toLocaleDateString('fr-FR')} : contactez l’agence.` });
      else if (end - now < 3 * DAY) list.push({ key: `r-${row.id}`, tone: 'info', text: `Retour ${dayLabel(end - now)} à ${hour(end)} : ${name(row)}.` });
    }
  }
  return list;
}
