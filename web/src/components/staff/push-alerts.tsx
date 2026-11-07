'use client';

import { useEffect, useState } from 'react';
import { BellOff, BellRing, ChevronDown, Loader2, Smartphone } from 'lucide-react';
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

type Kind = 'staff' | 'client' | 'partner';

/** Mode d'emploi, selon l'appareil : les mêmes étapes pour l'équipe, les clients et les partenaires. */
const STEPS: { title: string; steps: string[] }[] = [
  {
    title: 'Sur Android (Chrome)',
    steps: [
      'Ouvrez ce site dans Chrome et connectez-vous.',
      'Touchez « Activer les alertes », puis « Autoriser ».',
      'Facultatif : menu ⋮ de Chrome, puis « Ajouter à l’écran d’accueil » pour avoir une icône comme une application.',
    ],
  },
  {
    title: 'Sur iPhone (iOS 16.4 ou plus)',
    steps: [
      'Ouvrez ce site dans Safari.',
      'Touchez « Partager » (le carré avec une flèche), puis « Sur l’écran d’accueil » et « Ajouter ».',
      'Ouvrez FIMA AUTO depuis la nouvelle icône et connectez-vous.',
      'Touchez « Activer les alertes », puis « Autoriser ».',
    ],
  },
  {
    title: 'Sur ordinateur (Chrome, Edge, Firefox)',
    steps: ['Connectez-vous, touchez « Activer les alertes », puis « Autoriser » quand le navigateur le demande.'],
  },
];

const COPY: Record<Kind, { off: string; on: string }> = {
  staff: {
    off: 'Recevez une notification à chaque nouvelle réservation ou demande de transfert, même application fermée.',
    on: 'Actives : cet appareil reçoit une notification à chaque nouvelle réservation ou demande de transfert, même application fermée.',
  },
  client: {
    off: 'Soyez prévenu dès que votre réservation avance, que votre dossier est prêt à signer ou que l’agence vous écrit, même application fermée.',
    on: 'Actives : ce téléphone vous prévient à chaque nouveauté sur votre réservation, votre contrat ou un message de l’agence.',
  },
  partner: {
    off: 'Soyez prévenu dès que votre véhicule est validé ou refusé, ou qu’il est loué, même application fermée.',
    on: 'Actives : ce téléphone vous prévient quand l’agence décide sur un véhicule ou que l’un d’eux est loué.',
  },
};

/**
 * Activer / désactiver les alertes sur CET appareil : chaque notification du compte est aussi envoyée
 * sur le téléphone. `hideWhenDone` masque la carte quand elle n'a plus rien à proposer (déjà active,
 * ou appareil incompatible), pour ne la montrer qu'aux endroits où elle invite à l'activer.
 */
export function PushAlerts({ kind = 'staff', hideWhenDone = false }: { kind?: Kind; hideWhenDone?: boolean }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    pushState().then(setState);
  }, []);

  async function toggle() {
    setBusy(true);
    const db = createClient();
    const result = state === 'on' ? await disablePush(db) : await enablePush(db);
    setBusy(false);
    if (result.error) toast.error(result.error);
    else toast.success(state === 'on' ? 'Alertes désactivées sur cet appareil.' : 'Alertes activées : vous serez prévenu à chaque notification.');
    setState(await pushState());
  }

  if (!state || (hideWhenDone && (state === 'on' || state === 'unsupported' || state === 'not-configured'))) return null;
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
                ? COPY[kind].on
                : COPY[kind].off
              : MESSAGES[state]}
          </p>
        </div>
        {actionable && (
          <Button variant={state === 'on' ? 'outline' : 'default'} onClick={toggle} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {state === 'on' ? 'Désactiver' : 'Activer les alertes'}
          </Button>
        )}
        <div className="w-full">
          <button
            type="button"
            onClick={() => setHelp((open) => !open)}
            aria-expanded={help || state === 'needs-install'}
            className="flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Comment faire ? <ChevronDown className={`size-4 transition-transform ${help || state === 'needs-install' ? 'rotate-180' : ''}`} />
          </button>
          {(help || state === 'needs-install') && (
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              {STEPS.map((group) => (
                <div key={group.title} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{group.title}</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
                    {group.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
