/**
 * Contenu modifiable du site public. La page d'accueil est une suite de « sections »
 * (blocs) que l'on peut ajouter, masquer et réordonner depuis le back-office. Les
 * valeurs par défaut sont celles du site d'origine : tant que rien n'est enregistré
 * en base, le site s'affiche exactement comme avant.
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
export type Testimonial = { name: string; role: string; quote: string };
export type Stat = { value: string; label: string };
export type GalleryImage = { url: string; caption: string };
/** Catégories de véhicule pour lesquelles un trajet peut avoir un prix propre. */
export const TRANSFER_CATEGORIES = ['Citadine', 'Berline', 'SUV'] as const;
/**
 * Trajet de transfert aéroport. `price` est le prix de base (toute catégorie) ; `prices`
 * donne, si besoin, un prix par catégorie. Aucun prix = tarif donné sur devis.
 */
export type TransferRoute = { from: string; to: string; price: string; prices?: Record<string, string> };

export type BlockData = {
  hero: { title: string; subtitle: string; words: string[]; image: string };
  strengths: { eyebrow: string; title: string; items: Item[] };
  catalog: { eyebrow: string; title: string; text: string; count: number };
  transfer: { eyebrow: string; title: string; text: string; steps: Item[]; routes: TransferRoute[]; button: string };
  steps: { eyebrow: string; title: string; items: Item[] };
  faq: { eyebrow: string; title: string; items: Faq[] };
  partner: {
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
  text_image: {
    eyebrow: string;
    title: string;
    text: string;
    image: string;
    imageSide: 'left' | 'right';
    buttonLabel: string;
    buttonHref: string;
  };
  gallery: { eyebrow: string; title: string; images: GalleryImage[] };
  announcement: { text: string; linkLabel: string; linkHref: string; tone: 'info' | 'promo' };
  testimonials: { eyebrow: string; title: string; items: Testimonial[] };
  stats: { eyebrow: string; title: string; items: Stat[] };
  video: { eyebrow: string; title: string; url: string; caption: string };
  text: { title: string; text: string };
};

export type BlockType = keyof BlockData;
export type Block<T extends BlockType = BlockType> = { [K in T]: { id: string; type: K; show: boolean; data: BlockData[K] } }[T];

export const BLOCK_TYPES = [
  'hero',
  'strengths',
  'catalog',
  'transfer',
  'steps',
  'faq',
  'partner',
  'cta',
  'text_image',
  'gallery',
  'announcement',
  'testimonials',
  'stats',
  'video',
  'text',
] as const satisfies readonly BlockType[];

/** Libellé, description et unicité de chaque type de section. */
export const BLOCK_META: Record<BlockType, { label: string; description: string; unique?: boolean }> = {
  hero: { label: 'Bannière d’accueil', description: 'Grand titre, image de fond et recherche de véhicule.', unique: true },
  strengths: { label: 'Atouts', description: 'Quatre arguments sur fond sombre, avec pictogrammes.' },
  catalog: { label: 'Catalogue de véhicules', description: 'Le catalogue complet : dates, filtres, fiche du véhicule.', unique: true },
  transfer: { label: 'Transfert aéroport', description: 'Le service de transfert : trajets à prix fixe, étapes et demande par WhatsApp.', unique: true },
  steps: { label: 'Étapes', description: 'Une procédure en étapes numérotées.' },
  faq: { label: 'Questions fréquentes', description: 'Liste de questions et réponses dépliables.' },
  partner: { label: 'Bloc partenaires', description: 'Présentation du programme partenaire.', unique: true },
  cta: { label: 'Appel à l’action', description: 'Bandeau final : créer un compte, se connecter, WhatsApp.' },
  text_image: { label: 'Texte + image', description: 'Un texte à côté d’une image, avec un bouton facultatif.' },
  gallery: { label: 'Galerie photos', description: 'Une grille de photos avec légendes.' },
  announcement: { label: 'Bandeau d’annonce', description: 'Un message court (promotion, information).' },
  testimonials: { label: 'Témoignages', description: 'Avis de clients.' },
  stats: { label: 'Chiffres clés', description: 'Quelques chiffres mis en avant.' },
  video: { label: 'Vidéo', description: 'Une vidéo YouTube ou un fichier vidéo.' },
  text: { label: 'Texte libre', description: 'Un titre et des paragraphes.' },
};

export const DEFAULT_DATA: BlockData = {
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
  catalog: { eyebrow: 'Catalogue', title: 'Nos véhicules', text: 'Choisissez vos dates pour voir les véhicules réellement disponibles. La connexion n’est demandée qu’au moment de réserver.', count: 6 },
  transfer: {
    eyebrow: 'Transfert aéroport',
    title: 'Un chauffeur vous attend à l’arrivée',
    text: 'Arrivée ou départ, pas de recherche de véhicule, pas de stress : un tarif annoncé selon le trajet et le véhicule, confirmé par l’agence avant le transfert.',
    steps: [
      { icon: 'calendar-check', title: 'Réservez votre créneau', text: 'Indiquez le trajet, la date et l’heure de votre vol.' },
      { icon: 'badge-check', title: 'Recevez la confirmation', text: 'Chauffeur, véhicule et numéro de vol pris en compte.' },
      { icon: 'car', title: 'Votre chauffeur vous attend', text: 'À l’arrivée, avec une pancarte à votre nom.' },
    ],
    routes: [
      { from: 'Aéroport de Cotonou', to: 'Cotonou centre', price: '5 000 – 12 000', prices: { Citadine: '5 000 – 7 000', Berline: '7 000 – 9 000', SUV: '9 000 – 12 000' } },
      { from: 'Aéroport de Cotonou', to: 'Abomey-Calavi', price: '8 000 – 17 000', prices: { Citadine: '8 000 – 10 000', Berline: '10 000 – 13 000', SUV: '13 000 – 17 000' } },
      { from: 'Aéroport de Cotonou', to: 'Porto-Novo', price: '20 000 – 40 000', prices: { Citadine: '20 000 – 25 000', Berline: '25 000 – 30 000', SUV: '30 000 – 40 000' } },
    ],
    button: 'Prévenir l’agence sur WhatsApp',
  },
  steps: {
    eyebrow: 'Simplicité',
    title: 'Comment ça marche',
    items: [
      { icon: 'calendar-check', title: 'Réservez', text: 'Choisissez vos dates et votre véhicule.' },
      { icon: 'file-signature', title: 'Signez', text: 'Signez votre contrat en ligne, depuis votre espace.' },
      { icon: 'key-round', title: 'Récupérez', text: 'Inspection de départ, puis partez sereinement.' },
    ],
  },
  faq: {
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
  text_image: {
    eyebrow: 'À propos',
    title: 'Un titre accrocheur',
    text: 'Présentez ici votre entreprise, un service ou une offre en quelques lignes.',
    image: '/hero-banner.jpg',
    imageSide: 'right',
    buttonLabel: '',
    buttonHref: '/vehicules',
  },
  gallery: { eyebrow: 'Galerie', title: 'En images', images: [] },
  announcement: { text: 'Information importante pour nos clients.', linkLabel: '', linkHref: '/vehicules', tone: 'info' },
  testimonials: {
    eyebrow: 'Avis clients',
    title: 'Ils nous font confiance',
    items: [{ name: 'Nom du client', role: 'Client', quote: 'Un service rapide et des véhicules en parfait état.' }],
  },
  stats: {
    eyebrow: 'En chiffres',
    title: 'FIMA AUTO',
    items: [
      { value: '100%', label: 'Contrats signés en ligne' },
      { value: '24/7', label: 'Réservation en ligne' },
    ],
  },
  video: { eyebrow: 'Vidéo', title: 'Découvrez-nous', url: '', caption: '' },
  text: { title: 'Titre de la section', text: 'Votre texte ici.\n\nSéparez les paragraphes par une ligne vide.' },
};

export const defaultData = <T extends BlockType>(type: T): BlockData[T] => structuredClone(DEFAULT_DATA[type]);

/** Nouvelle section avec un identifiant unique (à n'appeler que dans le navigateur). */
export function newBlock<T extends BlockType>(type: T): Block<T> {
  return { id: crypto.randomUUID(), type, show: true, data: defaultData(type) } as Block<T>;
}

/** Sections de l'accueil d'origine, avec des identifiants fixes. */
export const DEFAULT_HOME_BLOCKS: Block[] = (['hero', 'strengths', 'catalog', 'transfer', 'steps', 'faq', 'partner', 'cta'] as const).map(
  (type) => ({ id: type, type, show: true, data: defaultData(type) }) as Block,
);

export type HomeContent = { blocks: Block[] };

export type FooterContent = {
  tagline: string;
  links: Link[];
  socials: Link[];
  note: string;
};

export const DEFAULT_FOOTER: FooterContent = {
  tagline: 'Location de véhicules, mobilités premium.',
  links: [
    { label: 'Véhicules', href: '/#vehicules' },
    { label: 'Comment ça marche', href: '/#etapes' },
    { label: 'FAQ', href: '/#faq' },
    { label: 'Devenir partenaire', href: '/#partenaires' },
  ],
  socials: [],
  note: '',
};

export type MenuContent = { links: Link[] };

export const DEFAULT_MENU: MenuContent = {
  links: [
    { label: 'Véhicules', href: '/#vehicules' },
    { label: 'Transfert aéroport', href: '/#transfert' },
    { label: 'Comment ça marche', href: '/#etapes' },
    { label: 'Partenaires', href: '/#partenaires' },
    { label: 'Contact', href: '/#contact' },
  ],
};

export type PageContent = { title: string; description: string; blocks: Block[] };
export const DEFAULT_PAGE: PageContent = { title: '', description: '', blocks: [] };

export type Announcement = {
  show: boolean;
  text: string;
  linkLabel: string;
  linkHref: string;
  tone: 'info' | 'promo';
  /** Dates facultatives (heure locale, « AAAA-MM-JJTHH:MM »). */
  startsAt: string;
  endsAt: string;
};
export type SettingsContent = { title: string; description: string; announcement: Announcement };

export const DEFAULT_SETTINGS: SettingsContent = {
  title: 'FIMA AUTO – Location de véhicules',
  description: 'FIMA AUTO – Location de véhicules : réservation en ligne, contrat signé à l’écran et suivi de location.',
  announcement: { show: false, text: '', linkLabel: '', linkHref: '/vehicules', tone: 'promo', startsAt: '', endsAt: '' },
};

/** Adresses réservées : une page ne peut pas les prendre. */
const RESERVED_SLUGS = ['admin', 'api', 'app', 'apercu', 'client', 'invite', 'login', 'partner', 'p', 'suivi-transfert', 'en', 'vehicules'];
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const isValidSlug = (slug: string) => SLUG_PATTERN.test(slug) && slug.length <= 60 && !RESERVED_SLUGS.includes(slug);
export const pageKey = (slug: string) => `page:${slug}`;
export const slugOfKey = (key: string) => (key.startsWith('page:') ? key.slice(5) : null);

/** Adresse à partir d'un titre : minuscules, sans accents, tirets. */
export function slugify(title: string) {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

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

/** Sections enregistrées, nettoyées ; `fallback` si rien d'exploitable n'est enregistré. */
export function normalizeBlocks(stored: unknown, fallback: Block[] = []): Block[] {
  const list = stored && typeof stored === 'object' ? (stored as { blocks?: unknown }).blocks : undefined;
  if (!Array.isArray(list)) return fallback;
  return list
    .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === 'object' && (BLOCK_TYPES as readonly string[]).includes(String((raw as { type?: unknown }).type)))
    .map((raw, index) => {
      const type = raw.type as BlockType;
      return {
        id: typeof raw.id === 'string' && raw.id ? raw.id : `${type}-${index}`,
        type,
        show: raw.show !== false,
        data: mergeContent(defaultData(type), raw.data),
      } as Block;
    });
}

export const homeContent = (stored: unknown): HomeContent => ({ blocks: normalizeBlocks(stored, DEFAULT_HOME_BLOCKS) });
export const footerContent = (stored: unknown) => mergeContent(DEFAULT_FOOTER, stored);
export const pageContent = (stored: unknown): PageContent => ({
  ...mergeContent({ title: '', description: '' }, stored),
  blocks: normalizeBlocks(stored, []),
});
export const settingsContent = (stored: unknown) => mergeContent(DEFAULT_SETTINGS, stored);
export const menuContent = (stored: unknown) => mergeContent(DEFAULT_MENU, stored);

/** Adresses acceptées pour un lien : interne, https, mailto ou tel (jamais javascript:). */
export function safeHref(value: string) {
  const href = value.trim();
  return /^(\/|#|https?:\/\/|mailto:|tel:)/i.test(href) ? href : '/';
}

/** Adresse d'intégration YouTube (« watch », « youtu.be » ou « embed »), ou null. */
export function youtubeEmbed(url: string) {
  const match = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}` : null;
}
