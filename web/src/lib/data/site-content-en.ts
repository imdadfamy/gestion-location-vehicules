import {
  DEFAULT_DATA,
  DEFAULT_FOOTER,
  DEFAULT_MENU,
  DEFAULT_SETTINGS,
  type Block,
  type BlockData,
  type FooterContent,
  type MenuContent,
  type SettingsContent,
} from './site-content';

/**
 * Version anglaise des textes par défaut du site. Le contenu enregistré depuis « Site web »
 * est en français : tant qu'un texte n'a pas été personnalisé (identique au défaut français),
 * il est remplacé par son équivalent anglais ; un texte personnalisé reste tel quel.
 */
export const DEFAULT_DATA_EN: BlockData = {
  hero: {
    title: 'Rent your vehicle in a few clicks',
    subtitle: 'Contract signed on screen, no hidden fees.',
    words: ['well maintained', 'inspected', 'ready to go'],
    image: '/hero-banner.jpg',
  },
  strengths: {
    eyebrow: 'Why FIMA AUTO',
    title: 'Simple rental, no surprises',
    items: [
      { icon: 'file-signature', title: 'Online contract', text: 'Simple, secure signature, right on screen.' },
      { icon: 'shield-check', title: 'Inspected vehicles', text: 'Checked before every rental, with photos.' },
      { icon: 'receipt-text', title: 'Clear prices', text: 'Rate, deposit and total shown before you book.' },
      { icon: 'message-circle', title: 'WhatsApp support', text: 'A team available to help you.' },
    ],
  },
  catalog: {
    eyebrow: 'Catalogue',
    title: 'Our vehicles',
    text: 'Choose your dates to see the vehicles that are actually available. You only sign in when you book.',
    count: 6,
  },
  transfer: {
    eyebrow: 'Airport transfer',
    title: 'A driver waits for you on arrival',
    text: 'Arriving or leaving, no vehicle to search for, no stress: a rate announced by route and vehicle, confirmed by the agency before the transfer.',
    steps: [
      { icon: 'calendar-check', title: 'Book your slot', text: 'Tell us the route, the date and your flight time.' },
      { icon: 'badge-check', title: 'Get your confirmation', text: 'Driver, vehicle and flight number taken into account.' },
      { icon: 'car', title: 'Your driver is waiting', text: 'On arrival, with a sign bearing your name.' },
    ],
    routes: [
      { from: 'Cotonou Airport', to: 'Cotonou city centre', price: '5 000 – 12 000', prices: { Citadine: '5 000 – 7 000', Berline: '7 000 – 9 000', SUV: '9 000 – 12 000' } },
      { from: 'Cotonou Airport', to: 'Abomey-Calavi', price: '8 000 – 17 000', prices: { Citadine: '8 000 – 10 000', Berline: '10 000 – 13 000', SUV: '13 000 – 17 000' } },
      { from: 'Cotonou Airport', to: 'Porto-Novo', price: '20 000 – 40 000', prices: { Citadine: '20 000 – 25 000', Berline: '25 000 – 30 000', SUV: '30 000 – 40 000' } },
    ],
    button: 'Notify the agency on WhatsApp',
    faq: [
      { q: 'What happens if my flight is delayed?', a: 'Enter your flight number in the request: the agency follows the actual arrival time and adjusts the pick-up. In case of a major change, let us know on WhatsApp with your reference.' },
      { q: 'How do I cancel or change my transfer?', a: 'Contact the agency on WhatsApp as soon as possible, quoting your reference. You can follow the status of your request at any time with your reference and phone number.' },
      { q: 'How will I recognise my driver?', a: 'Your driver waits for you on arrival with a sign bearing your name. Their name and the vehicle are given in the agency’s confirmation.' },
    ],
  },
  steps: {
    eyebrow: 'Simplicity',
    title: 'How it works',
    items: [
      { icon: 'calendar-check', title: 'Book', text: 'Choose your dates and your vehicle.' },
      { icon: 'file-signature', title: 'Sign', text: 'Sign your contract online, from your account.' },
      { icon: 'key-round', title: 'Pick up', text: 'Departure inspection, then drive away with peace of mind.' },
    ],
  },
  faq: {
    eyebrow: 'Need help',
    title: 'Frequently asked questions',
    items: [
      { q: 'Which documents do I need?', a: 'A valid ID and a valid driving licence.' },
      { q: 'How does the deposit work?', a: 'Its amount is shown before booking. It is returned at the end of the rental, minus any damage noted.' },
      { q: 'Can I cancel?', a: 'As long as your booking is pending, you can cancel it from your account. After that, contact the agency.' },
      { q: 'Is fuel included?', a: 'The fuel level is recorded at the departure inspection and stated in the contract.' },
      { q: 'Is there a minimum age?', a: 'The conditions are given when you book.' },
      { q: 'Do you deliver the vehicle?', a: 'Contact the agency to find out which delivery options are available in your area.' },
    ],
  },
  partner: {
    eyebrow: 'Become a partner',
    title: 'Make your unused vehicle pay',
    text: 'Offer your vehicle with your photos and the price you want to receive. We assess it, publish it and pay you your share on every rental.',
    image: '/partner-hero.jpg',
    button: 'Become a partner',
    steps: [
      { title: 'Offer', text: 'Photos, conditions and desired price.' },
      { title: 'We assess', text: 'Price and condition of the vehicle checked.' },
      { title: 'You earn income', text: 'On every rental, with automatic tracking.' },
    ],
    benefits: [
      { icon: 'line-chart', title: 'Effortless income', text: 'You set your price, we handle the rest.' },
      { icon: 'handshake', title: 'Contracts handled for you', text: 'Signatures and formalities handled by us.' },
      { icon: 'wrench', title: 'You stay in control', text: 'Declare maintenance at any time.' },
      { icon: 'badge-check', title: 'Real-time tracking', text: 'Your rentals and income in your account.' },
    ],
    faq: [
      { q: 'How is the final price set?', a: 'You state the price you want to receive; we add our margin to set the price shown to the customer.' },
      { q: 'How and when am I paid?', a: 'You follow your rentals and income directly from your partner account.' },
      { q: 'Which documents must I provide?', a: 'The vehicle photos and details; the rest is handled during the assessment.' },
      { q: 'Can I withdraw my vehicle at any time?', a: 'Yes, contact the agency for any withdrawal request.' },
    ],
  },
  cta: { title: 'Ready to go?', text: 'Create your account in two minutes and book your vehicle.' },
  text_image: {
    eyebrow: 'About',
    title: 'A catchy title',
    text: 'Present your company, a service or an offer here in a few lines.',
    image: '/hero-banner.jpg',
    imageSide: 'right',
    buttonLabel: '',
    buttonHref: '/vehicules',
  },
  gallery: { eyebrow: 'Gallery', title: 'In pictures', images: [] },
  announcement: { text: 'Important information for our customers.', linkLabel: '', linkHref: '/vehicules', tone: 'info' },
  testimonials: {
    eyebrow: 'Customer reviews',
    title: 'They trust us',
    items: [{ name: 'Customer name', role: 'Customer', quote: 'Fast service and vehicles in perfect condition.' }],
  },
  partner_logos: { eyebrow: 'They drive with us', title: 'Our partners', threshold: 5 },
  stats: {
    eyebrow: 'In numbers',
    title: 'FIMA AUTO',
    items: [
      { value: '100%', label: 'Contracts signed online' },
      { value: '24/7', label: 'Online booking' },
    ],
  },
  video: { eyebrow: 'Video', title: 'Get to know us', url: '', caption: '' },
  text: { title: 'Section title', text: 'Your text here.\n\nSeparate paragraphs with a blank line.' },
};

export const DEFAULT_MENU_EN: MenuContent = {
  links: [
    { label: 'Vehicles', href: '/#vehicules' },
    { label: 'Airport transfer', href: '/#transfert' },
    { label: 'How it works', href: '/#etapes' },
    { label: 'Partners', href: '/#partenaires' },
    { label: 'Contact', href: '/#contact' },
  ],
};

export const DEFAULT_FOOTER_EN: FooterContent = {
  tagline: 'Vehicle rental, premium mobility.',
  links: [
    { label: 'Vehicles', href: '/#vehicules' },
    { label: 'How it works', href: '/#etapes' },
    { label: 'FAQ', href: '/#faq' },
    { label: 'Become a partner', href: '/#partenaires' },
  ],
  socials: [],
  note: '',
};

export const DEFAULT_SETTINGS_EN: Pick<SettingsContent, 'title' | 'description'> = {
  title: 'FIMA AUTO – Vehicle rental',
  description: 'FIMA AUTO – Vehicle rental: online booking, contract signed on screen and rental tracking.',
};

/**
 * Remplace par l'anglais chaque texte resté identique au défaut français ; parcourt `value`,
 * `fr` et `en` en parallèle (même structure, listes comparées par position).
 */
function swap<T>(value: T, fr: unknown, en: unknown): T {
  if (typeof value === 'string') return (typeof fr === 'string' && value === fr && typeof en === 'string' ? en : value) as T;
  if (Array.isArray(value))
    return value.map((item, index) => swap(item, Array.isArray(fr) ? fr[index] : undefined, Array.isArray(en) ? en[index] : undefined)) as T;
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const frObject = (fr ?? {}) as Record<string, unknown>;
    const enObject = (en ?? {}) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(source).map(([key, item]) => [key, swap(item, frObject[key], enObject[key])])) as T;
  }
  return value;
}

export const englishBlocks = (blocks: Block[]) =>
  blocks.map((block) => ({ ...block, data: swap(block.data, DEFAULT_DATA[block.type], DEFAULT_DATA_EN[block.type]) }) as Block);
export const englishMenu = (menu: MenuContent) => swap(menu, DEFAULT_MENU, DEFAULT_MENU_EN);
export const englishFooter = (footer: FooterContent) => swap(footer, DEFAULT_FOOTER, DEFAULT_FOOTER_EN);
export const englishSettings = <T extends SettingsContent>(settings: T): T => ({
  ...settings,
  title: settings.title === DEFAULT_SETTINGS.title ? DEFAULT_SETTINGS_EN.title : settings.title,
  description: settings.description === DEFAULT_SETTINGS.description ? DEFAULT_SETTINGS_EN.description : settings.description,
});
