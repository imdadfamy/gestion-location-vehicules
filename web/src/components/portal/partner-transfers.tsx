'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Luggage, Plane, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { StatusBadge } from '@/components/staff/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { listPartnerTransfers, PARTNER_RESPONSES, respondToTransfer, type PartnerTransfer } from '@/lib/data/booking-requests';
import { TRANSFER_STATUSES } from '@/lib/data/transfers';
import { frenchError } from '@/lib/errors';
import { frDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';

/** Un transfert attend la réponse du partenaire tant qu'il n'est ni terminé, ni annulé, ni passé. */
export const waitsForAnswer = (item: PartnerTransfer, now = Date.now()) =>
  !item.partner_response && ['new', 'confirmed', 'assigned'].includes(item.status) && new Date(item.pickup_at).getTime() > now;

/**
 * Transferts (par exemple aéroport → destination) qui concernent un véhicule du partenaire. L'équipe les gère ; le
 * partenaire dit seulement si son véhicule est libre. Il ne voit ni le client, ni son téléphone, ni le prix.
 */
export function PartnerTransfers({ onChange }: { onChange?: () => void }) {
  const [rows, setRows] = useState<PartnerTransfer[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    listPartnerTransfers(createClient()).then(({ data, error: failure }) => {
      setRows(data ?? []);
      setNow(Date.now());
      setError(failure ? frenchError(failure) : '');
    });
  }, []);

  async function answer(item: PartnerTransfer, available: boolean) {
    setBusy(item.id);
    const { error: failure } = await respondToTransfer(createClient(), item.id, available);
    setBusy(null);
    if (failure) return toast.error(frenchError(failure));
    setRows((current) => (current ?? []).map((row) => (row.id === item.id ? { ...row, partner_response: available ? 'available' : 'unavailable', partner_responded_at: new Date().toISOString() } : row)));
    toast.success(available ? 'Merci : l’équipe sait que votre véhicule est disponible.' : 'Merci : l’équipe cherchera un autre véhicule.');
    onChange?.();
  }

  if (!rows) return error ? <FormMessage error={error} /> : <Skeleton className="h-48 rounded-xl" />;

  return (
    <div className="grid gap-4">
      <FormMessage error={error} />
      <p className="text-sm text-muted-foreground">
        Ces transferts sont gérés par l’équipe : elle a besoin de savoir si votre véhicule est libre à l’heure indiquée. Répondez en un clic ; vous gardez ici la trace de chaque demande.
      </p>
      {!rows.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Plane className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucun transfert ne concerne vos véhicules pour le moment.</p>
          </CardContent>
        </Card>
      ) : (
        rows.map((item) => {
          const status = TRANSFER_STATUSES[item.status] ?? TRANSFER_STATUSES.new;
          const response = item.partner_response ? PARTNER_RESPONSES[item.partner_response] : null;
          const open = waitsForAnswer(item, now);
          return (
            <Card key={item.id} className={open ? 'border-primary/40' : undefined}>
              <CardContent className="grid gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {item.route_from} → {item.route_to}
                    </p>
                    <p className="text-sm text-muted-foreground tabular-nums">Prise en charge : {frDateTime(item.pickup_at)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    {response && <StatusBadge tone={response.tone}>Votre réponse : {response.label}</StatusBadge>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>{item.vehicle_label ?? 'Votre véhicule'}</span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" /> {item.passengers} passager{item.passengers > 1 ? 's' : ''}
                  </span>
                  {item.luggage !== null && (
                    <span className="inline-flex items-center gap-1">
                      <Luggage className="size-3.5" /> {item.luggage} bagage{item.luggage > 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="font-mono text-xs">{item.reference}</span>
                </div>
                {['new', 'confirmed', 'assigned'].includes(item.status) && new Date(item.pickup_at).getTime() > now && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant={item.partner_response === 'available' ? 'default' : 'outline'} disabled={busy === item.id} onClick={() => answer(item, true)}>
                      {busy === item.id ? <Loader2 className="animate-spin" /> : <Check />} Mon véhicule est disponible
                    </Button>
                    <Button size="sm" variant={item.partner_response === 'unavailable' ? 'destructive' : 'outline'} disabled={busy === item.id} onClick={() => answer(item, false)}>
                      <X /> Indisponible
                    </Button>
                    {item.partner_response && <span className="text-xs text-muted-foreground">Vous pouvez changer votre réponse tant que le transfert n’a pas eu lieu.</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
