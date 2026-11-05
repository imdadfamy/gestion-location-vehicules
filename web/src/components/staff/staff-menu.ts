import {
  Bell,
  Building2,
  Car,
  ClipboardCheck,
  CreditCard,
  FileSignature,
  FileText,
  Globe,
  Handshake,
  History,
  KeyRound,
  LayoutDashboard,
  LineChart,
  Megaphone,
  PiggyBank,
  type LucideIcon,
  Settings,
  ShieldAlert,
  UserCircle,
  Users,
  CalendarRange,
  Plane,
  Wrench,
} from 'lucide-react';

export type MenuItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Module de permission requis pour le Responsable (absent : visible par tout le personnel). */
  module?: string;
  /** Réservé au Super Admin. */
  adminOnly?: boolean;
};

/** Menu du back-office, dans l'ordre de l'interface Angular. */
export const MENU: { label: string; items: MenuItem[] }[] = [
  {
    label: 'Menu principal',
    items: [
      { title: 'Tableau de bord', href: '/app', icon: LayoutDashboard },
      { title: 'Véhicules', href: '/app/vehicles', icon: Car, module: 'vehicles' },
      { title: 'Clients', href: '/app/clients', icon: Users, module: 'clients' },
      { title: 'Réservations', href: '/app/reservations', icon: CalendarRange, module: 'reservations' },
      { title: 'Transferts', href: '/app/transfers', icon: Plane, module: 'reservations' },
      { title: 'Locations', href: '/app/rentals', icon: KeyRound, module: 'rentals' },
      { title: 'Contrats', href: '/app/contracts', icon: FileSignature, module: 'contracts' },
      { title: 'Paiements', href: '/app/payments', icon: CreditCard, module: 'payments' },
      { title: 'Inspections', href: '/app/inspections', icon: ClipboardCheck, module: 'inspections' },
      { title: 'Maintenance', href: '/app/maintenance', icon: Wrench, module: 'maintenance' },
      { title: 'Incidents', href: '/app/incidents', icon: ShieldAlert, module: 'incidents' },
      { title: 'Partenaires', href: '/app/partners', icon: Handshake, module: 'partners' },
      { title: 'Site web', href: '/app/website', icon: Globe, module: 'website' },
    ],
  },
  {
    label: 'Pilotage',
    items: [
      { title: 'Mes informations', href: '/app/my-profile', icon: UserCircle },
      { title: 'Notifications', href: '/app/notifications', icon: Bell, module: 'notifications' },
      { title: 'Analyses', href: '/app/analytics', icon: LineChart, module: 'reports' },
      { title: 'Marketing', href: '/app/marketing', icon: Megaphone, module: 'marketing' },
      { title: 'Rentabilité du parc', href: '/app/fleet', icon: PiggyBank, module: 'fleet_finance' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { title: 'Paramètres', href: '/app/settings', icon: Building2, adminOnly: true },
      { title: 'Modèles de contrat', href: '/app/contract-templates', icon: FileText, adminOnly: true },
      { title: 'Journal', href: '/app/activity-logs', icon: History, adminOnly: true },
      { title: 'Utilisateurs', href: '/app/users', icon: Settings, adminOnly: true },
    ],
  },
];

export const ALL_ITEMS = MENU.flatMap((group) => group.items);

/** Entrée du menu correspondant à une adresse (la plus spécifique). */
export function itemFor(pathname: string) {
  return ALL_ITEMS.filter((item) => pathname === item.href || pathname.startsWith(item.href + '/')).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
}
