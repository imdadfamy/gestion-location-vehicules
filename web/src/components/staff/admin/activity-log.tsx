'use client';

import { useEffect, useState } from 'react';
import { Loader2, RotateCcw, Search } from 'lucide-react';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  activityPage,
  changesOf,
  detailOf,
  LOG_MODULES,
  logMoney,
  PAGE_SIZE,
  resolveReferences,
  valuesOf,
  type LogEntry,
} from '@/lib/data/activity-logs';
import { staffNames } from '@/lib/data/rentals';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type Refs = { clients: Record<string, string>; vehicles: Record<string, string> };
const DOT: Record<string, string> = { INSERT: 'bg-emerald-500', UPDATE: 'bg-sky-500', DELETE: 'bg-red-500' };
const VERB: Record<string, string> = { INSERT: 'a créé', UPDATE: 'a modifié', DELETE: 'a supprimé' };
const dayKey = (value: string) => new Date(value).toLocaleDateString('en-CA');

function dayLabel(key: string) {
  const today = new Date().toLocaleDateString('en-CA');
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
  if (key === today) return 'Aujourd’hui';
  if (key === yesterday) return 'Hier';
  const label = new Date(`${key}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Objet de l'action, en clair (texte seulement : aucune donnée n'est injectée comme HTML). */
function subject(entry: LogEntry, refs: Refs): { before: string; strong?: string; after?: string } {
  const v = valuesOf(entry);
  const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));
  switch (entry.entity_type) {
    case 'clients':
      return { before: 'le client', strong: [v.first_name, v.last_name].filter(Boolean).join(' ') || 'sans nom' };
    case 'vehicles':
      return { before: 'le véhicule', strong: text(v.registration_number) || [v.make, v.model].filter(Boolean).join(' ') || 'sans immatriculation' };
    case 'rentals':
      return {
        before: 'la location de',
        strong: refs.clients[text(v.client_id)] ?? 'un client',
        after: `(${refs.vehicles[text(v.vehicle_id)] ?? 'véhicule'})`,
      };
    case 'contracts':
      return { before: 'le contrat', strong: text(v.contract_number) };
    case 'payments':
      return { before: 'un paiement de', strong: logMoney(v.amount) };
    case 'deposits':
      return { before: 'une caution de', strong: logMoney(v.amount) };
    case 'vehicle_inspections':
      return {
        before: v.inspection_type === 'departure' ? 'l’inspection de départ' : v.inspection_type === 'return' ? 'l’inspection de retour' : 'une inspection',
      };
    case 'vehicle_maintenance':
      return { before: `la maintenance (${text(v.maintenance_type) || 'type non précisé'}) du véhicule`, strong: refs.vehicles[text(v.vehicle_id)] ?? '' };
    case 'incidents':
      return { before: `l’incident (${text(v.incident_type) || 'type non précisé'}) sur`, strong: refs.vehicles[text(v.vehicle_id)] ?? 'un véhicule' };
    case 'profiles':
      return { before: 'le compte de', strong: text(v.full_name) || text(v.email) || 'un utilisateur' };
    case 'contract_templates':
      return { before: 'le modèle de contrat', strong: text(v.name) };
    case 'contract_template_versions':
      return { before: 'une nouvelle version de modèle de contrat' };
    case 'contract_signatures':
      return { before: v.signer_type === 'client' ? 'la signature du locataire' : 'la signature du responsable' };
    default:
      return { before: 'un élément' };
  }
}

export function ActivityLog() {
  const [rows, setRows] = useState<LogEntry[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [refs, setRefs] = useState<Refs>({ clients: {}, vehicles: {} });
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filters, setFilters] = useState({ query: '', module: 'all', action: 'all', user: 'all', from: '', to: '' });

  /** Charge une page du journal puis les noms cités ; renvoie l'état à appliquer. */
  async function fetchPage(from: number, known: Refs) {
    const db = createClient();
    const { data, error: failure } = await activityPage(db, from);
    if (failure) return { error: frenchError(failure) };
    const page = data ?? [];
    const [people, references] = await Promise.all([staffNames(db, page.map((entry) => entry.user_id)), resolveReferences(db, page, known)]);
    return { page, people, references };
  }

  function apply(current: LogEntry[], result: Awaited<ReturnType<typeof fetchPage>>) {
    if ('error' in result) return setError(result.error ?? '');
    setRows([...current, ...result.page]);
    setHasMore(result.page.length === PAGE_SIZE);
    setNames((known) => ({ ...known, ...result.people }));
    setRefs(result.references);
  }

  useEffect(() => {
    // Premier chargement ; la suite passe par « Charger plus ».
    fetchPage(0, { clients: {}, vehicles: {} }).then((result) => apply([], result));
    // Une seule fois, au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userLabel = (id: string | null) => (id ? (names[id] ?? 'Utilisateur interne') : 'Système');
  const sentence = (entry: LogEntry) => {
    const part = subject(entry, refs);
    return `${userLabel(entry.user_id)} ${VERB[entry.action] ?? 'a modifié'} ${part.before} ${part.strong ?? ''} ${part.after ?? ''}`;
  };

  const term = filters.query.trim().toLowerCase();
  const visible = (rows ?? []).filter((entry) => {
    if (filters.module !== 'all' && entry.entity_type !== filters.module) return false;
    if (filters.action !== 'all' && entry.action !== filters.action) return false;
    if (filters.user !== 'all' && entry.user_id !== filters.user) return false;
    const day = dayKey(entry.created_at);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    return !term || `${LOG_MODULES[entry.entity_type ?? ''] ?? 'Autre'} ${sentence(entry)}`.toLowerCase().includes(term);
  });
  const groups = new Map<string, LogEntry[]>();
  for (const entry of visible) groups.set(dayKey(entry.created_at), [...(groups.get(dayKey(entry.created_at)) ?? []), entry]);
  const users = [...new Set((rows ?? []).map((entry) => entry.user_id).filter((id): id is string => !!id))]
    .map((id) => ({ id, label: userLabel(id) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  const set = (key: keyof typeof filters) => (value: string) => setFilters({ ...filters, [key]: value });

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5">
      <div>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">Traçabilité</p>
        <h2 className="text-2xl font-semibold tracking-tight">Journal d’activité</h2>
        <p className="text-sm text-muted-foreground">Qui a fait quoi, et quand.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={filters.query} onChange={(event) => set('query')(event.target.value)} placeholder="Rechercher" aria-label="Rechercher" className="pl-9" />
        </div>
        <Select value={filters.module} onValueChange={set('module')}>
          <SelectTrigger className="w-full" aria-label="Module">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les modules</SelectItem>
            {Object.entries(LOG_MODULES).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.action} onValueChange={set('action')}>
          <SelectTrigger className="w-full" aria-label="Action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les actions</SelectItem>
            <SelectItem value="INSERT">Créations</SelectItem>
            <SelectItem value="UPDATE">Modifications</SelectItem>
            <SelectItem value="DELETE">Suppressions</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.user} onValueChange={set('user')}>
          <SelectTrigger className="w-full" aria-label="Utilisateur">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les utilisateurs</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Field label="Du" htmlFor="log-from">
          <Input id="log-from" type="date" value={filters.from} onChange={(event) => set('from')(event.target.value)} />
        </Field>
        <Field label="Au" htmlFor="log-to">
          <Input id="log-to" type="date" value={filters.to} onChange={(event) => set('to')(event.target.value)} />
        </Field>
        <Button
          variant="outline"
          className="self-end"
          onClick={() => {
            setFilters({ query: '', module: 'all', action: 'all', user: 'all', from: '', to: '' });
            setExpanded(null);
          }}
        >
          <RotateCcw /> Réinitialiser
        </Button>
      </div>

      <FormMessage error={error} />

      {!rows ? (
        !error && <Skeleton className="h-96 rounded-xl" />
      ) : !visible.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Aucune activité ne correspond aux filtres.</p>
      ) : (
        <div className="grid gap-5">
          {[...groups].map(([key, entries]) => (
            <section key={key} className="grid gap-2">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{dayLabel(key)}</h3>
              <ol className="grid gap-1 border-l pl-4">
                {entries.map((entry) => {
                  const part = subject(entry, refs);
                  const changes = changesOf(entry);
                  return (
                    <li key={entry.id} className="relative py-1.5 text-sm">
                      <span className={cn('absolute top-3 -left-[21px] size-2.5 rounded-full ring-4 ring-background', DOT[entry.action] ?? 'bg-muted-foreground')} />
                      <p>
                        <strong>{userLabel(entry.user_id)}</strong> {VERB[entry.action] ?? 'a modifié'} {part.before}{' '}
                        {part.strong && <strong>{part.strong}</strong>} {part.after}
                      </p>
                      {changes.length > 0 && (
                        <ul className="mt-1 grid gap-0.5 text-xs text-muted-foreground">
                          {changes.map((change) => (
                            <li key={change}>{change}</li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="tabular-nums">
                          {new Date(entry.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button type="button" className="-my-2 min-h-11 text-primary hover:underline" onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
                          {expanded === entry.id ? 'Masquer les détails' : 'Plus de détails'}
                        </button>
                      </div>
                      {expanded === entry.id && <p className="mt-1 rounded-md bg-muted/60 p-2 text-xs">{detailOf(entry)}</p>}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {hasMore && (
            <Button
              variant="outline"
              className="justify-self-center"
              disabled={loadingMore}
              onClick={async () => {
                setLoadingMore(true);
                apply(rows, await fetchPage(rows.length, refs));
                setLoadingMore(false);
              }}
            >
              {loadingMore && <Loader2 className="animate-spin" />} Charger plus
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
