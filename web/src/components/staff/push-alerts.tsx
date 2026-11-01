'use client';

import { useEffect, useState } from 'react';
import { BellOff, BellRing, Loader2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { disablePush, enablePush, pushState, type PushState } from '@/lib/push';
import { createClient } from '@/lib/supabase/client';

const MESSAGES: Record<Exclude<PushState, 'off' | 'on'>, string> = {
  unsupported: 'Ce navigateur ne gère pas les alertes. Utilisez Chrome, Edge ou Firefox récent, ou installez le site sur votre téléphone.',
  'needs-install': 'Sur iPhone : touchez « Partager » puis « Sur l’écran d’accueil », ouvrez FIMA AUTO depuis l’icône, puis revenez ici pour activer les alertes (iOS 16.4 ou plus).',
  'not-configured': 'Les alertes ne sont pas encore configurées sur ce site (clé manquante).',
  denied: 'Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur, puis rechargez la page.',
};

/** Activer / désactiver les alertes de nouvelle réservation ou demande de transfert sur CET appareil. */
export function PushAlerts() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pushState().then(setState);
  }, []);

  async function toggle() {
    setBusy(true);
    const db = createClient();
    const result = state === 'on' ? await disablePush(db) : await enablePush(db);
    setBusy(false);
    if (result.error) toast.error(result.error);
    else toast.success(state === 'on' ? 'Alertes désactivées sur cet appareil.' : 'Alertes activées : vous serez prévenu à chaque nouvelle demande.');
    setState(await pushState());
  }

  if (!state) return null;
  const actionable = state === 'on' || state === 'off';
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {state === 'on' ? <BellRing className="size-5" /> : actionable ? <Smartphone className="size-5" /> : <BellOff className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Alertes sur ce téléphone</p>
          <p className="text-sm text-muted-foreground">
            {actionable
              ? state === 'on'
                ? 'Actives : cet appareil reçoit une notification à chaque nouvelle réservation ou demande de transfert, même application fermée.'
                : 'Recevez une notification à chaque nouvelle réservation ou demande de transfert, même application fermée.'
              : MESSAGES[state]}
          </p>
        </div>
        {actionable && (
          <Button variant={state === 'on' ? 'outline' : 'default'} onClick={toggle} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {state === 'on' ? 'Désactiver' : 'Activer les alertes'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
