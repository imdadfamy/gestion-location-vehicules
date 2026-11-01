/**
 * Contenu modifiable du site public (accueil et pied de page). Les valeurs par défaut
 * sont celles du site d'origine : tant que rien n'est enregistré en base, le site
 * s'affiche exactement comme avant.
 */

export const ICON_NAMES = [
  'file-signature',
  'shield-check',
  'receipt-text',
  'message-circle',
  'calendar-check',
  'key-round',
  'line-chart',
  'handshake',
  'wrench',
  'badge-check',
  'car',
  'clock',
  'map-pin',
  'star',
  'phone',
] as const;
export type IconName = (typeof ICON_NAMES)[number];

export const ICON_LABELS: Record<IconName, string> = {
  'file-signature': 'Contrat',
  'shield-check': 'Sécurité',
  'receipt-text': 'Prix / facture',
  'message-circle': 'Message',
  'calendar-check': 'Calendrier',
  'key-round': 'Clé',
  'line-chart': 'Revenus',
  handshake: 'Partenariat',
  wrench: 'Entretien',
  'badge-check': 'Garantie',
  car: 'Voiture',
  clock: 'Horloge',
  'map-pin': 'Lieu',
  star: 'Étoile',
  phone: 'Téléphone',
};

export type Item = { icon: IconName; title: string; text: string };
export type Step = { title: string; text: string };
export type Faq = { q: string; a: string };
export type Link = { label: string; href: string };

export type HomeContent = {
  hero: { title: string; subtitle: string; words: string[]; image: string };
  strengths: { eyebrow: string; title: string; items: Item[] };
  catalog: { show: boolean; eyebrow: string; title: string; text: string };
  steps: { show: boolean; eyebrow: string; title: string; items: Item[] };
  faq: { show: boolean; eyebrow: string; title: string; items: Faq[] };
  partner: {
    show: boolean;
    eyebrow: string;
    title: string;
    text: string;
    image: string;
    button: string;
    steps: Step[];
    benefits: Item[];
    faq: Faq[];
  };
  cta: { title: string; text: string };
};

export type FooterContent = {
  tagline: string;
  links: Link[];
  socials: Link[];
  note: string;
};

export const SITE_KEYS = ['home', 'footer'] as const;
export type SiteKey = (typeof SITE_KEYS)[number];

export const DEFAULT_HOME: HomeContent = {
  hero: {
    title: 'Louez votre véhicule en quelques clics',
    subtitle: 'Contrat signé à l’écran, sans frais cachés.',
    words: ['entretenus', 'contrôlés', 'prêts à partir'],
    image: '/hero-banner.jpg',
  },
  strengths: {
    eyebrow: 'Pourquoi FIMA AUTO',
    title: 'Une location simple et sans surprise',
    items: [
      { icon: 'file-signature', title: 'Contrat en ligne', text: 'Signature simple et sécurisée, directement à l’écran.' },
      { icon: 'shield-check', title: 'Véhicules contrôlés', text: 'Inspectés avant chaque location, photos à l’appui.' },
      { icon: 'receipt-text', title: 'Prix clairs', text: 'Tarif, caution et total affichés avant de réserver.' },
      { icon: 'message-circle', title: 'Assistance WhatsApp', text: 'Une équipe disponible pour vous accompagner.' },
    ],
  },
  catalog: { show: true, eyebrow: 'Catalogue', title: 'Nos véhicules', text: 'Des modèles entretenus, prêts à partir.' },
  steps: {
    show: true,
    eyebrow: 'Simplicité',
    title: 'Comment ça marche',
    items: [
      { icon: 'calendar-check', title: 'Réservez', text: 'Choisissez vos dates et votre véhicule.' },
      { icon: 'file-signature', title: 'Signez', text: 'Signez votre contrat en ligne, depuis votre espace.' },
      { icon: 'key-round', title: 'Récupérez', text: 'Inspection de départ, puis partez sereinement.' },
    ],
  },
  faq: {
    show: true,
    eyebrow: 'Besoin d’aide',
    title: 'Questions fréquentes',
    items: [
      { q: 'Quels documents fournir ?', a: 'Une pièce d’identité et un permis de conduire valides.' },
      { q: 'Comment fonctionne la caution ?', a: 'Son montant est affiché avant la réservation. Elle est restituée au retour, déduction faite d’éventuels dommages constatés.' },
      { q: 'Puis-je annuler ?', a: 'Tant que votre réservation est en attente, vous pouvez l’annuler depuis votre espace. Ensuite, contactez l’agence.' },
      { q: 'Le carburant est-il inclus ?', a: 'Le niveau de carburant est relevé à l’inspection de départ et indiqué au contrat.' },
      { q: 'Y a-t-il un âge minimum ?', a: 'Les conditions sont précisées lors de la réservation.' },
      { q: 'Livrez-vous le véhicule ?', a: 'Contactez l’agence pour connaître les options de livraison disponibles selon votre zone.' },
    ],
  },
  partner: {
    show: true,
    eyebrow: 'Devenez partenaire',
    title: 'Rentabilisez votre véhicule inutilisé',
    text: 'Proposez votre véhicule avec vos photos et le prix que vous souhaitez toucher. Nous l’évaluons, le publions et vous reversons votre part à chaque location.',
    image: '/partner-hero.jpg',
    button: 'Devenir partenaire',
    steps: [
      { title: 'Proposez', text: 'Photos, conditions et prix souhaité.' },
      { title: 'On évalue', text: 'Prix et état du véhicule vérifiés.' },
      { title: 'Vous touchez vos revenus', text: 'À chaque location, avec un suivi automatique.' },
    ],
    benefits: [
      { icon: 'line-chart', title: 'Revenu sans effort', text: 'Vous fixez votre prix, on gère le reste.' },
      { icon: 'handshake', title: 'Contrats pris en charge', text: 'Signatures et formalités gérées par nous.' },
      { icon: 'wrench', title: 'Vous gardez le contrôle', text: 'Déclarez une maintenance à tout moment.' },
      { icon: 'badge-check', title: 'Suivi en temps réel', text: 'Vos locations et revenus dans votre espace.' },
    ],
    faq: [
      { q: 'Comment est fixé le prix final ?', a: 'Vous indiquez le prix que vous souhaitez toucher ; nous ajoutons notre marge pour fixer le prix affiché au client.' },
      { q: 'Comment et quand suis-je payé ?', a: 'Vous suivez vos locations et vos revenus directement depuis votre espace partenaire.' },
      { q: 'Quels documents dois-je fournir ?', a: 'Les photos du véhicule et ses informations ; le reste est géré lors de l’évaluation.' },
      { q: 'Puis-je retirer mon véhicule à tout moment ?', a: 'Oui, contactez l’agence pour toute demande de retrait.' },
    ],
  },
  cta: { title: 'Prêt à partir ?', text: 'Créez votre compte en deux minutes et réservez votre véhicule.' },
};

export const DEFAULT_FOOTER: FooterContent = {
  tagline: 'Location de véhicules, mobilités premium.',
  links: [
    { label: 'Véhicules', href: '/vehicules' },
    { label: 'Comment ça marche', href: '/#etapes' },
    { label: 'FAQ', href: '/#faq' },
    { label: 'Devenir partenaire', href: '/#partenaires' },
  ],
  socials: [],
  note: '',
};

/**
 * Fusionne le contenu enregistré avec les valeurs par défaut : une clé absente ou d'un
 * mauvais type retombe sur le défaut, une liste enregistrée remplace la liste par défaut.
 */
export function mergeContent<T>(defaults: T, stored: unknown): T {
  if (Array.isArray(defaults)) return (Array.isArray(stored) ? stored : defaults) as T;
  if (defaults !== null && typeof defaults === 'object') {
    const source = stored !== null && typeof stored === 'object' && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(defaults as Record<string, unknown>)) result[key] = mergeContent(value, source[key]);
    return result as T;
  }
  return (typeof stored === typeof defaults ? stored : defaults) as T;
}

export const homeContent = (stored: unknown) => mergeContent(DEFAULT_HOME, stored);
export const footerContent = (stored: unknown) => mergeContent(DEFAULT_FOOTER, stored);

/** Adresses acceptées pour un lien : interne, https, mailto ou tel (jamais javascript:). */
export function safeHref(value: string) {
  const href = value.trim();
  return /^(\/|#|https?:\/\/|mailto:|tel:)/i.test(href) ? href : '/';
}
