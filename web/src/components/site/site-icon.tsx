import {
  BadgeCheck,
  CalendarCheck,
  Car,
  Clock,
  FileSignature,
  Handshake,
  KeyRound,
  LineChart,
  type LucideIcon,
  MapPin,
  MessageCircle,
  Phone,
  ReceiptText,
  ShieldCheck,
  Star,
  Wrench,
} from 'lucide-react';
import type { IconName } from '@/lib/data/site-content';

const ICONS: Record<IconName, LucideIcon> = {
  'file-signature': FileSignature,
  'shield-check': ShieldCheck,
  'receipt-text': ReceiptText,
  'message-circle': MessageCircle,
  'calendar-check': CalendarCheck,
  'key-round': KeyRound,
  'line-chart': LineChart,
  handshake: Handshake,
  wrench: Wrench,
  'badge-check': BadgeCheck,
  car: Car,
  clock: Clock,
  'map-pin': MapPin,
  star: Star,
  phone: Phone,
};

/** Pictogramme choisi dans l'éditeur du site (étoile si le nom est inconnu). */
export function SiteIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name as IconName] ?? Star;
  return <Icon className={className} aria-hidden />;
}
