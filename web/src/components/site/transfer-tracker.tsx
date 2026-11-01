'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { BellRing, CalendarPlus, Car, Check, CircleDot, Copy, Loader2, MapPin, MessageCircle, Pencil, Phone, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { StatusBadge } from '@/components/staff/status-badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  cancelTransfer,
  changeTransfer,
  showPrice,
  subscribeTransferPush,
  TRANSFER_FLOW,
  TRANSFER_STATUSES,
  transferCalendar,
  transferStatus,
  type TransferTracking,
} from '@/lib/data/transfers';
import { frenchError } from '@/lib/errors';
import { whatsappNumber } from '@/lib/format';
import { pushState, subscribeDevice, type PushState } from '@/lib/push';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useLang } from './lang-provider';

const REFRESH_MS = 30000;

/** Valeur d'un champ datetime-local (heure locale) pour une date ISO. */
const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

/** Suivi public d'une demande de transfert : frise des étapes, chauffeur, véhicule, actions du client. */
export function TransferTracker() {
  const params = useSearchParams();
  const { lang, t, locale, href } = useLang();
  const [reference, setReference] = useState(params.get('ref') ?? '');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState<TransferTracking | null>(null);
  // Identifiants saisis : servent à rafraîchir et à agir sans les ressaisir.
  const [creds, setCreds] = useState<{ reference: string; phone: string } | null>(null);

  const load = useCallback(async (current: { reference: string; phone: string }, silent = false) => {
    const { data, error: failure } = await transferStatus(createClient(), current.reference, current.phone);
    if (failure) return silent ? undefined : setError(frenchError(failure));
    if (!data) {
      if (!silent) setError(t('Aucune demande ne correspond à cette référence et à ce numéro de téléphone.'));
      return;
    }
    setError('');
    setFound(data);
  }, [t]);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setFound(null);
    const current = { reference: reference.trim(), phone };
    setCreds(current);
    setLoading(true);
    await load(current);
    setLoading(false);
  }

  // Actualisation automatique tant que la page est ouverte et visible.
  useEffect(() => {
    if (!found || !creds) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load(creds, true);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [found, creds, load]);

  return (
    <section className="mx-auto max-w-xl px-4 py-16">
      <p className="text-sm font-medium tracking-widest text-primary uppercase">{t('Transfert aéroport')}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('Suivre ma demande')}</h1>
      <p className="mt-2 text-muted-foreground">{t('Saisissez la référence reçue à l’envoi de votre demande et le téléphone utilisé.')}</p>

      <form onSubmit={search} className="mt-6 grid gap-4 rounded-2xl border bg-card p-5">
        <div className="grid gap-1.5">
          <Label htmlFor="track-ref">{t('Référence')}</Label>
          <Input id="track-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TR-XXXXXXXX" className="font-mono" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="track-phone">{t('Téléphone')}</Label>
          <Input id="track-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required />
        </div>
        <FormMessage error={error} />
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <Search />} {t('Voir ma demande')}
        </Button>
      </form>

      {found && creds && (
        <TrackingCard
          key={found.reference}
          data={found}
          creds={creds}
          lang={lang}
          locale={locale}
          onChanged={() => load(creds, true)}
          trackingHref={href(`/suivi-transfert?ref=${found.reference}`)}
        />
      )}
    </section>
  );
}

function TrackingCard({
  data,
  creds,
  lang,
  locale,
  onChanged,
  trackingHref,
}: {
  data: TransferTracking;
  creds: { reference: string; phone: string };
  lang: 'fr' | 'en';
  locale: string;
  onChanged: () => void;
  trackingHref: string;
}) {
  const { t } = useLang();
  const status = TRANSFER_STATUSES[data.status] ?? TRANSFER_STATUSES.new;
  const cancelled = data.status === 'cancelled';
  const when = (iso: string, style: 'short' | 'long' = 'short') =>
    new Date(iso).toLocaleString(locale, style === 'long' ? { dateStyle: 'full', timeStyle: 'short' } : { dateStyle: 'short', timeStyle: 'short' });

  // Étapes du parcours avec l'heure de leur première apparition.
  const reached = new Map<string, string>();
  for (const event of data.events) if (!reached.has(event.status)) reached.set(event.status, event.at);
  const currentIndex = TRANSFER_FLOW.indexOf(data.status as (typeof TRANSFER_FLOW)[number]);
  const changes = data.events.filter((event) => event.note === 'client_update');
  const cancelledByClient = data.events.some((event) => event.status === 'cancelled' && event.note === 'client');

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!data.vehicle_photo) return;
    let cancelledLoad = false;
    createClient()
      .storage.from('rental-documents')
      .createSignedUrl(data.vehicle_photo, 600)
      .then(({ data: signed }) => {
        if (!cancelledLoad) setPhotoUrl(signed?.signedUrl ?? null);
      });
    return () => {
      cancelledLoad = true;
    };
  }, [data.vehicle_photo]);

  // Alertes sur le téléphone du client.
  const [push, setPush] = useState<PushState | 'subscribed' | null>(null);
  useEffect(() => {
    pushState().then(setPush);
  }, []);
  const [pushBusy, setPushBusy] = useState(false);
  async function enableUpdates() {
    setPushBusy(true);
    const result = await subscribeDevice();
    if ('error' in result) {
      toast.error(t(result.error));
    } else {
      const { data: ok, error: failure } = await subscribeTransferPush(createClient(), creds.reference, creds.phone, result.device, lang);
      if (failure || !ok) toast.error(t('Activation impossible. Réessayez.'));
      else {
        setPush('subscribed');
        toast.success(t('Mises à jour activées : votre téléphone vous préviendra à chaque étape.'));
      }
    }
    setPushBusy(false);
  }

  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  async function cancel() {
    setCancelBusy(true);
    const { data: ok, error: failure } = await cancelTransfer(createClient(), creds.reference, creds.phone);
    setCancelBusy(false);
    setConfirmCancel(false);
    if (failure || !ok) return toast.error(failure ? frenchError(failure) : t('Cette demande ne peut plus être annulée ici. Contactez l’agence.'));
    toast.success(t('Votre demande a été annulée.'));
    onChanged();
  }

  function downloadCalendar() {
    const file = new Blob([transferCalendar(data, `${t('Transfert aéroport')} FIMA AUTO`)], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = `${data.reference}.ics`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${trackingHref}`);
      toast.success(t('Lien copié.'));
    } catch {
      toast.error(t('Copie impossible : copiez l’adresse du navigateur.'));
    }
  }

  const driverNumber = data.driver_phone ? whatsappNumber(data.driver_phone) : '';
  const canPush = push === 'on' || push === 'off' || push === 'subscribed';

  return (
    <div className="mt-6 grid gap-4">
      <div className="grid gap-3 rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono font-semibold">{data.reference}</span>
          <StatusBadge tone={status.tone}>{t(status.label)}</StatusBadge>
        </div>
        <p className="text-sm text-muted-foreground">{t(status.hint)}</p>

        <ol className="mt-1 grid gap-0" aria-label={t('Étapes de votre transfert')}>
          {(cancelled ? TRANSFER_FLOW.filter((step) => reached.has(step)) : TRANSFER_FLOW).map((step, index, shown) => {
            const done = cancelled ? true : index <= currentIndex;
            const current = !cancelled && index === currentIndex;
            const at = reached.get(step);
            return (
              <li key={step} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full border text-primary-foreground',
                      done ? 'border-primary bg-primary' : 'border-border bg-background text-muted-foreground',
                    )}
                  >
                    {done && !current ? <Check className="size-3.5" /> : <CircleDot className="size-3.5" />}
                  </span>
                  {(index < shown.length - 1 || cancelled) && <span className={cn('w-px grow', cancelled || (done && index < currentIndex) ? 'bg-primary' : 'bg-border')} />}
                </div>
                <div className={cn('pb-4 text-sm', !done && 'text-muted-foreground')}>
                  <p className={cn('font-medium', current && 'text-primary')}>{t(TRANSFER_STATUSES[step].label)}</p>
                  {at && done && <p className="text-xs text-muted-foreground">{when(at)}</p>}
                </div>
              </li>
            );
          })}
          {cancelled && (
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive text-white">
                <X className="size-3.5" />
              </span>
              <div className="text-sm">
                <p className="font-medium text-destructive">{cancelledByClient ? t('Annulée par vous') : t('Annulée')}</p>
                <p className="text-xs text-muted-foreground">{when(data.events.filter((e) => e.status === 'cancelled').at(-1)?.at ?? data.pickup_at)}</p>
              </div>
            </li>
          )}
        </ol>
        {changes.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t('Vous avez modifié votre demande le {date}.', { date: when(changes[changes.length - 1].at) })}
          </p>
        )}
      </div>

      <dl className="grid gap-2 rounded-2xl border bg-card p-5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t('Trajet')}</dt>
          <dd className="text-right">
            {data.route_from} → {data.route_to}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t('Date et heure')}</dt>
          <dd className="text-right">{when(data.pickup_at, 'long')}</dd>
        </div>
        {data.flight_number && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t('Numéro de vol')}</dt>
            <dd>{data.flight_number}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t('Passagers')}</dt>
          <dd>{data.passengers}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t('Prix')}</dt>
          <dd className="font-semibold">{showPrice(data.price === null ? null : String(data.price), lang)}</dd>
        </div>
      </dl>

      {(data.driver_name || data.vehicle_label || data.meeting_point) && !cancelled && (
        <div className="grid gap-4 rounded-2xl border bg-card p-5">
          {data.driver_name && (
            <div>
              <p className="text-xs tracking-widest text-muted-foreground uppercase">{t('Votre chauffeur')}</p>
              <p className="mt-1 text-lg font-semibold">{data.driver_name}</p>
              {data.driver_phone && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <a href={`tel:${data.driver_phone.replace(/[^\d+]/g, '')}`}>
                      <Phone /> {t('Appeler')}
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={`https://wa.me/${driverNumber}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle /> WhatsApp
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}
          {data.vehicle_label && (
            <div className="flex items-center gap-3">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt={data.vehicle_label} className="h-16 w-24 rounded-lg object-cover" />
              ) : (
                <span className="flex h-16 w-24 items-center justify-center rounded-lg bg-muted">
                  <Car className="size-6 text-muted-foreground" />
                </span>
              )}
              <div>
                <p className="text-xs tracking-widest text-muted-foreground uppercase">{t('Véhicule')}</p>
                <p className="font-semibold">{data.vehicle_label}</p>
                {data.vehicle_plate && <p className="font-mono text-sm text-muted-foreground">{data.vehicle_plate}</p>}
              </div>
            </div>
          )}
          {data.meeting_point && (
            <div className="flex gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="font-medium">{t('Point de rendez-vous')}</p>
                <p className="text-muted-foreground">{data.meeting_point}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {!cancelled && data.status !== 'done' && (
        <div className="grid gap-2 rounded-2xl border bg-card p-5">
          {canPush && (
            <Button type="button" variant={push === 'subscribed' ? 'secondary' : 'default'} disabled={pushBusy || push === 'subscribed'} onClick={enableUpdates}>
              {pushBusy ? <Loader2 className="animate-spin" /> : <BellRing />}
              {push === 'subscribed' ? t('Mises à jour activées sur ce téléphone') : t('Recevoir les mises à jour sur ce téléphone')}
            </Button>
          )}
          {push === 'needs-install' && <p className="text-xs text-muted-foreground">{t('Sur iPhone, ajoutez d’abord ce site à l’écran d’accueil (Partager puis « Sur l’écran d’accueil ») pour recevoir les mises à jour.')}</p>}
          {push === 'denied' && <p className="text-xs text-muted-foreground">{t('Les notifications sont bloquées pour ce site dans votre navigateur.')}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={downloadCalendar}>
              <CalendarPlus /> {t('Ajouter au calendrier')}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={copyLink}>
              <Copy /> {t('Copier le lien')}
            </Button>
            {data.can_edit && (
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> {t('Modifier l’heure ou le vol')}
              </Button>
            )}
            {data.can_cancel && (
              <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmCancel(true)}>
                <X /> {t('Annuler ma demande')}
              </Button>
            )}
          </div>
          {!data.can_cancel && data.status !== 'new' && <p className="text-xs text-muted-foreground">{t('Pour annuler un transfert déjà confirmé, contactez l’agence.')}</p>}
        </div>
      )}

      <EditDialog open={editing} onOpenChange={setEditing} data={data} creds={creds} onSaved={onChanged} />
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Annuler cette demande ?')}</AlertDialogTitle>
            <AlertDialogDescription>{t('Votre demande de transfert {ref} sera annulée.', { ref: data.reference })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Garder ma demande')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                cancel();
              }}
              disabled={cancelBusy}
            >
              {cancelBusy && <Loader2 className="animate-spin" />} {t('Oui, annuler')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditDialog({
  open,
  onOpenChange,
  data,
  creds,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: TransferTracking;
  creds: { reference: string; phone: string };
  onSaved: () => void;
}) {
  const { t } = useLang();
  const [when, setWhen] = useState(() => toLocalInput(data.pickup_at));
  const [flight, setFlight] = useState(data.flight_number ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!when || new Date(when).getTime() <= new Date().getTime()) return setError(t('Choisissez une date et une heure à venir.'));
    setSaving(true);
    const { data: ok, error: failure } = await changeTransfer(createClient(), creds.reference, creds.phone, when, flight.trim());
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    if (!ok) return setError(t('Ce transfert ne peut plus être modifié ici. Contactez l’agence.'));
    toast.success(t('Votre demande a été modifiée. L’agence est prévenue.'));
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t('Modifier l’heure ou le vol')}</DialogTitle>
            <DialogDescription>{t('L’agence est prévenue de votre changement.')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-when">{t('Date et heure d’arrivée (ou de prise en charge)')}</Label>
            <Input id="edit-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-flight">{t('Numéro de vol (facultatif)')}</Label>
            <Input id="edit-flight" value={flight} onChange={(e) => setFlight(e.target.value)} maxLength={20} />
          </div>
          <FormMessage error={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('Fermer')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} {t('Enregistrer')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
