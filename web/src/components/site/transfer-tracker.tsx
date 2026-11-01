'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showPrice, TRANSFER_STATUSES, transferStatus } from '@/lib/data/transfers';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { useLang } from './lang-provider';

type Found = NonNullable<Awaited<ReturnType<typeof transferStatus>>['data']>[number];

/** Suivi public d'une demande de transfert : la référence ET le téléphone sont demandés. */
export function TransferTracker() {
  const params = useSearchParams();
  const { lang, t, locale } = useLang();
  const [reference, setReference] = useState(params.get('ref') ?? '');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState<Found | null>(null);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setFound(null);
    setLoading(true);
    const { data, error: failure } = await transferStatus(createClient(), reference, phone);
    setLoading(false);
    if (failure) return setError(frenchError(failure));
    if (!data?.length) return setError(t('Aucune demande ne correspond à cette référence et à ce numéro de téléphone.'));
    setFound(data[0]);
  }

  const status = found ? (TRANSFER_STATUSES[found.status] ?? TRANSFER_STATUSES.new) : null;

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

      {found && status && (
        <div className="mt-6 grid gap-3 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono font-semibold">{found.reference}</span>
            <StatusBadge tone={status.tone}>{t(status.label)}</StatusBadge>
          </div>
          <p className="text-sm text-muted-foreground">{t(status.hint)}</p>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t('Trajet')}</dt>
              <dd className="text-right">
                {found.route_from} → {found.route_to}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t('Date et heure')}</dt>
              <dd>{new Date(found.pickup_at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}</dd>
            </div>
            {found.vehicle_label && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{t('Véhicule')}</dt>
                <dd>{found.vehicle_label}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t('Prix')}</dt>
              <dd className="font-semibold">{showPrice(found.price === null ? null : String(found.price), lang)}</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
