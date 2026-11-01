'use client';

import { MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { whatsappLink } from '@/lib/data/public-catalog';

export type AgencyContact = { phone?: string | null; whatsapp?: string | null };

const telLink = (phone?: string | null) => {
  const digits = String(phone ?? '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
};

/** Boutons d'appel et de message WhatsApp vers l'agence (rien si aucun numéro n'est renseigné). */
export function ContactButtons({ contact, message }: { contact: AgencyContact; message?: string }) {
  const tel = telLink(contact.phone || contact.whatsapp);
  const whatsapp = whatsappLink(contact.whatsapp || contact.phone, message ?? 'Bonjour FIMA AUTO, j’ai une question sur ma location.');
  if (!tel && !whatsapp) return <p className="text-sm text-muted-foreground">Les coordonnées de l’agence ne sont pas encore renseignées.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {tel && (
        <Button asChild variant="outline">
          <a href={tel}>
            <Phone /> Appeler {contact.phone || contact.whatsapp}
          </a>
        </Button>
      )}
      {whatsapp && (
        <Button asChild variant="outline">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle /> WhatsApp
          </a>
        </Button>
      )}
    </div>
  );
}

/** Bouton « Contacter l'agence » de la barre de navigation. */
export function ContactAgency({ contact }: { contact: AgencyContact }) {
  if (!contact.phone && !contact.whatsapp) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Contacter l’agence">
          <Phone /> <span className="hidden lg:inline">Contacter l’agence</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-72 gap-3">
        <p className="text-sm font-medium">Une question sur votre location ?</p>
        <ContactButtons contact={contact} />
      </PopoverContent>
    </Popover>
  );
}
