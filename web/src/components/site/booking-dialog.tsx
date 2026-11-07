'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, MessageCircle } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { AcquisitionField } from '@/components/site/acquisition-field';
import { PhoneField } from '@/components/site/phone-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { COUNTRIES, DEFAULT_COUNTRY, countryFromLanguage, findCountry, localDigits, toInternational } from '@/lib/countries';
import { createBookingRequest } from '@/lib/data/booking-requests';
import { formatMoney, rentalDays, whatsappLink, type CatalogVehicle } from '@/lib/data/public-catalog';
import { frenchError } from '@/lib/errors';
import { dailyPriceFor, parseTiers } from '@/lib/pricing';
import { createClient } from '@/lib/supabase/client';
import { useLang } from './lang-provider';

const formatLocal = (value: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

/**
 * Réservation sans compte : le visiteur laisse son nom et son téléphone, la demande est enregistrée (l'équipe et, pour un
 * véhicule de partenaire, le partenaire sont prévenus), puis WhatsApp s'ouvre avec un message prérempli vers le bon numéro :
 * celui du partenaire propriétaire du véhicule, sinon celui de l'agence. Créer un compte reste proposé, en option.
 */
export function BookingDialog({
  vehicle,
  departure,
  returnDate,
  withDriver,
  agencyPhone,
  onClose,
  accountHref,
}: {
  vehicle: CatalogVehicle | null;
  departure: string;
  returnDate: string;
  withDriver: boolean;
  /** Numéro WhatsApp de l'agence, utilisé quand le véhicule n'a pas de numéro de partenaire. */
  agencyPhone?: string | null;
  onClose: () => void;
  /** Adresse de l'espace client pour qui préfère réserver avec un compte. */
  accountHref: string;
}) {
  const { t, plural, locale } = useLang();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [notes, setNotes] = useState('');
  const [acquisition, setAcquisition] = useState({ source: '', detail: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ reference: string; link: string | null } | null>(null);
  const countryChosen = useRef(false);

  // Pays par défaut : celui du visiteur (adresse IP), à défaut la région de sa langue. Un choix déjà fait n'est jamais écrasé.
  useEffect(() => {
    if (!vehicle) return;
    let cancelled = false;
    fetch('/api/geo')
      .then((response) => response.json())
      .catch(() => ({ country: null }))
      .then(({ country: detected }: { country: string | null }) => {
        const iso = (detected && COUNTRIES.some((item) => item.iso === detected) ? detected : null) ?? countryFromLanguage(navigator.languages);
        if (!cancelled && iso && !countryChosen.current) setCountry(iso);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicle]);

  if (!vehicle) return <Dialog open={false} />;

  const days = rentalDays(departure, returnDate);
  const driverPrice = Number(vehicle.driver_daily_price ?? 0);
  const { price: dayPrice } = dailyPriceFor(vehicle.rental_price, parseTiers(vehicle.price_tiers), days);
  const total = dayPrice * days + (withDriver ? driverPrice * days : 0);
  const vehicleName = `${vehicle.make} ${vehicle.model}`;
  const period = `${t('du {from} au {to}', { from: formatLocal(departure, locale), to: formatLocal(returnDate, locale) })}`;

  function close() {
    onClose();
    // La fenêtre se referme avant de revenir à son état initial (pas de saut visible).
    setTimeout(() => {
      setDone(null);
      setError('');
    }, 200);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!vehicle) return;
    setError('');
    if (name.trim().length < 2) return setError(t('Indiquez votre nom.'));
    if (localDigits(phone) < 6) return setError(t('Indiquez un numéro de téléphone valide.'));
    setSending(true);
    const { data, error: failure } = await createBookingRequest(createClient(), {
      vehicleId: vehicle.id,
      departure,
      returnDate,
      withDriver,
      name: name.trim(),
      phone: toInternational(findCountry(country).dial, phone),
      notes: notes.trim(),
      acquisitionSource: acquisition.source,
      acquisitionDetail: acquisition.detail,
    });
    setSending(false);
    if (failure || !data) return setError(failure ? frenchError(failure) : t('Votre demande n’a pas pu être envoyée. Réessayez ou contactez l’agence.'));

    const partnerNumber = data.whatsapp_phone;
    const greeting = partnerNumber ? t('Bonjour,') : t('Bonjour FIMA AUTO,');
    const message = [
      `${greeting} ${t('je souhaite réserver {name}', { name: vehicleName })}${withDriver ? ` ${t('avec chauffeur')}` : ''} ${period}.`,
      `${t('Total estimé')} : ${formatMoney(total, locale)}.`,
      `${t('Nom')} : ${name.trim()}.`,
      `${t('Référence')} : ${data.reference}.`,
    ].join('\n');
    const link = whatsappLink(partnerNumber ?? agencyPhone, message);
    setDone({ reference: data.reference, link });
    // Ouverture automatique ; si le navigateur la bloque, le bouton de confirmation reste disponible.
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  }

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        {done ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-600" /> {t('Demande enregistrée')}
              </DialogTitle>
              <DialogDescription>
                {done.link
                  ? t('Terminez votre réservation sur WhatsApp : la conversation s’ouvre avec votre demande déjà écrite. Il suffit de l’envoyer.')
                  : t('Nous vous contacterons au numéro indiqué pour confirmer votre réservation.')}
              </DialogDescription>
            </DialogHeader>
            <p className="rounded-lg bg-muted px-3 py-2 text-sm">
              {vehicleName} · {period}
              <br />
              {t('Référence')} : <strong>{done.reference}</strong>
            </p>
            {done.link && (
              <Button asChild size="lg">
                <a href={done.link} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> {t('Ouvrir WhatsApp')}
                </a>
              </Button>
            )}
            <Button variant="ghost" onClick={close}>
              {t('Fermer')}
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('Réserver {name}', { name: vehicleName })}</DialogTitle>
              <DialogDescription>
                {period} · {days} {plural(days, 'jour', 'jours')} · {t('Total estimé')} {formatMoney(total, locale)}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} noValidate className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="booking-name">{t('Votre nom')}</Label>
                <Input id="booking-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={120} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="booking-phone">{t('Votre téléphone')}</Label>
                <PhoneField
                  id="booking-phone"
                  country={country}
                  onCountryChange={(iso) => {
                    countryChosen.current = true;
                    setCountry(iso);
                  }}
                  value={phone}
                  onChange={setPhone}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="booking-notes">{t('Un message pour le loueur (facultatif)')}</Label>
                <Textarea id="booking-notes" rows={2} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </div>
              <AcquisitionField
                idPrefix="booking"
                source={acquisition.source}
                detail={acquisition.detail}
                onSourceChange={(source) => setAcquisition({ source, detail: '' })}
                onDetailChange={(detail) => setAcquisition((current) => ({ ...current, detail }))}
              />
              <FormMessage error={error} />
              <Button type="submit" size="lg" disabled={sending}>
                {sending ? <Loader2 className="animate-spin" /> : <MessageCircle />} {t('Continuer sur WhatsApp')}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {t('Pas besoin de compte.')}{' '}
                <Link href={accountHref} className="font-medium text-primary underline underline-offset-4">
                  {t('Je préfère réserver avec un compte')}
                </Link>
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
