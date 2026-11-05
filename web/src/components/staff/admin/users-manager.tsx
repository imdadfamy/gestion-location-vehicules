'use client';

import { useEffect, useState } from 'react';
import { Loader2, MailPlus, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
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
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Profile } from '@/lib/auth';
import { manageUsers } from '@/lib/data/accounts';
import { frenchError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';

type Permissions = Record<string, Record<string, boolean>>;
type Editor = { mode: 'invite'; full_name: string; email: string } | { mode: 'edit'; user: Profile; is_active: boolean };
type Confirm = { kind: 'delete' | 'client-access'; user: Profile };

const ACTIONS: Record<string, string> = { view: 'Voir', create: 'Créer', update: 'Modifier', delete: 'Supprimer', validate: 'Valider' };
const MODULES: Record<string, string> = {
  vehicles: 'Véhicules',
  clients: 'Clients',
  reservations: 'Réservations',
  rentals: 'Locations',
  contracts: 'Contrats',
  payments: 'Paiements',
  deposits: 'Cautions',
  inspections: 'Inspections',
  maintenance: 'Maintenance',
  incidents: 'Incidents',
  documents: 'Documents',
  notifications: 'Notifications',
  reports: 'Rapports',
  contract_templates: 'Modèles de contrat',
  activity_logs: 'Journal',
  partners: 'Partenaires',
  website: 'Site web',
  marketing: 'Marketing',
  fleet_finance: 'Rentabilité du parc',
};
const actionKeys = Object.keys(ACTIONS);
const moduleKeys = Object.keys(MODULES);
const nameOf = (user: Profile) => user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Sans nom';

/** Matrice moduleKey × action ; les permissions sont appliquées côté base par la RLS. */
function PermissionMatrix({ value, onChange }: { value: Permissions; onChange: (next: Permissions) => void }) {
  const allowed = (moduleKey: string, action: string) => value[moduleKey]?.[action] === true;
  const set = (moduleKey: string, action: string, on: boolean) => {
    const next = structuredClone(value);
    next[moduleKey] ??= {};
    if (on) next[moduleKey][action] = true;
    else delete next[moduleKey][action];
    if (!Object.keys(next[moduleKey]).length) delete next[moduleKey];
    onChange(next);
  };
  const rowFull = (moduleKey: string) => actionKeys.every((action) => allowed(moduleKey, action));
  const columnFull = (action: string) => moduleKeys.every((moduleKey) => allowed(moduleKey, action));
  const all = moduleKeys.every(rowFull);
  const fill = (on: boolean, modules = moduleKeys, actions = actionKeys) => {
    const next = structuredClone(value);
    for (const moduleKey of modules) {
      next[moduleKey] ??= {};
      for (const action of actions) {
        if (on) next[moduleKey][action] = true;
        else delete next[moduleKey][action];
      }
      if (!Object.keys(next[moduleKey]).length) delete next[moduleKey];
    }
    onChange(next);
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Permissions</h3>
        <Button variant="outline" size="sm" onClick={() => fill(!all)}>
          {all ? 'Tout décocher' : 'Tout cocher'}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-3">Module</TableHead>
              {actionKeys.map((action) => (
                <TableHead key={action} className="text-center">
                  <label className="inline-flex cursor-pointer flex-col items-center gap-1 text-xs">
                    <Checkbox checked={columnFull(action)} onCheckedChange={(on) => fill(on === true, moduleKeys, [action])} aria-label={`Tout « ${ACTIONS[action]} »`} />
                    {ACTIONS[action]}
                  </label>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {moduleKeys.map((moduleKey) => (
              <TableRow key={moduleKey}>
                <TableCell className="pl-3">
                  <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox checked={rowFull(moduleKey)} onCheckedChange={(on) => fill(on === true, [moduleKey])} aria-label={`Tout le module ${MODULES[moduleKey]}`} />
                    {MODULES[moduleKey]}
                  </label>
                </TableCell>
                {actionKeys.map((action) => (
                  <TableCell key={action} className="text-center">
                    <Checkbox
                      checked={allowed(moduleKey, action)}
                      onCheckedChange={(on) => set(moduleKey, action, on === true)}
                      aria-label={`${MODULES[moduleKey]} : ${ACTIONS[action]}`}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function UsersManager({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [permissions, setPermissions] = useState<Permissions>({});
  const [formError, setFormError] = useState('');
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    return createClient()
      .from('profiles')
      .select('*')
      .in('role', ['super_admin', 'responsable', 'client'])
      .order('created_at')
      .then(({ data, error: failure }) => {
        setUsers(data ?? []);
        setError(failure ? frenchError(failure) : '');
      });
  }

  useEffect(() => {
    load();
  }, []);

  function open(next: Editor) {
    setEditor(next);
    setFormError('');
    setPermissions(next.mode === 'edit' ? structuredClone((next.user.permissions ?? {}) as Permissions) : {});
  }

  async function submit() {
    if (!editor) return;
    setFormError('');
    if (editor.mode === 'invite' && (!editor.full_name.trim() || !/^\S+@\S+\.\S+$/.test(editor.email.trim())))
      return setFormError('Nom complet et e-mail valides sont requis.');
    setSaving(true);
    const { error: failure } = await manageUsers(
      createClient(),
      editor.mode === 'invite'
        ? {
            action: 'invite',
            full_name: editor.full_name.trim(),
            email: editor.email.trim(),
            permissions,
            // Le lien d'invitation ouvre la page où la personne choisit son mot de passe.
            redirect_to: `${window.location.origin}/invite`,
          }
        : { action: 'update', user_id: editor.user.id, is_active: editor.is_active, permissions },
    );
    setSaving(false);
    if (failure) return setFormError(frenchError(failure));
    toast.success(editor.mode === 'invite' ? 'Invitation envoyée.' : 'Utilisateur mis à jour.');
    setEditor(null);
    load();
  }

  async function confirmed() {
    if (!confirm) return;
    const { kind, user } = confirm;
    setConfirm(null);
    setError('');
    setSaving(true);
    const enable = !user.is_active;
    const { error: failure } = await manageUsers(
      createClient(),
      kind === 'delete' ? { action: 'delete', user_id: user.id } : { action: 'update_client_access', user_id: user.id, is_active: enable },
    );
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    toast.success(kind === 'delete' ? 'Compte supprimé.' : enable ? 'Accès client rétabli.' : 'Accès client retiré. Les historiques sont conservés.');
    load();
  }

  const internal = (users ?? []).filter((user) => user.role === 'super_admin' || user.role === 'responsable');
  const clients = (users ?? []).filter((user) => user.role === 'client');

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Administration</p>
          <h2 className="text-2xl font-semibold tracking-tight">Utilisateurs</h2>
          <p className="text-sm text-muted-foreground">Gérez les comptes internes et les accès au portail client.</p>
        </div>
        <Button onClick={() => open({ mode: 'invite', full_name: '', email: '' })}>
          <MailPlus /> Inviter un Responsable
        </Button>
      </div>

      <FormMessage error={error} />

      {!users ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : (
        <>
          <section className="grid gap-3">
            <div>
              <h3 className="font-medium">Équipe interne ({internal.length})</h3>
              <p className="text-xs text-muted-foreground">Super Admin et Responsables avec permissions configurables.</p>
            </div>
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Utilisateur</TableHead>
                    <TableHead className="hidden sm:table-cell">Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {internal.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="pl-4 whitespace-normal">
                        <div className="font-medium">{nameOf(user)}</div>
                        <span className="text-xs break-all text-muted-foreground">{user.email}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <StatusBadge tone={user.role === 'super_admin' ? 'info' : 'muted'}>
                          {user.role === 'super_admin' ? 'Super Admin' : 'Responsable'}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={user.is_active ? 'success' : 'muted'}>{user.is_active ? 'Actif' : 'Désactivé'}</StatusBadge>
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        {user.role === 'responsable' && (
                          <div className="flex justify-end gap-1">
                            <Button variant="outline" size="sm" onClick={() => open({ mode: 'edit', user, is_active: user.is_active })}>
                              <Settings2 /> Gérer
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              aria-label={`Supprimer le compte de ${nameOf(user)}`}
                              disabled={saving}
                              onClick={() => setConfirm({ kind: 'delete', user })}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </section>

          <section className="grid gap-3">
            <div>
              <h3 className="font-medium">Clients ({clients.length})</h3>
              <p className="text-xs text-muted-foreground">Accès au portail client uniquement. Les clients ne reçoivent aucune permission interne.</p>
            </div>
            <Card className="py-0">
              {!clients.length ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">Aucun compte client.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Client</TableHead>
                      <TableHead>Accès portail</TableHead>
                      <TableHead className="pr-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="pl-4 whitespace-normal">
                          <div className="font-medium">{nameOf(user)}</div>
                          <span className="text-xs break-all text-muted-foreground">{user.email}</span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={user.is_active ? 'success' : 'muted'}>{user.is_active ? 'Autorisé' : 'Retiré'}</StatusBadge>
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="outline" size="sm" disabled={saving} onClick={() => setConfirm({ kind: 'client-access', user })}>
                              {user.is_active ? 'Retirer l’accès' : 'Donner l’accès'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              aria-label={`Supprimer le compte de ${nameOf(user)}`}
                              disabled={saving}
                              onClick={() => setConfirm({ kind: 'delete', user })}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </section>
        </>
      )}

      <Sheet open={!!editor} onOpenChange={(value) => !value && setEditor(null)}>
        <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
          {editor && (
            <>
              <SheetHeader className="border-b">
                <SheetTitle>{editor.mode === 'invite' ? 'Inviter un Responsable' : `Gérer ${nameOf(editor.user)}`}</SheetTitle>
                <SheetDescription>
                  {editor.mode === 'invite'
                    ? 'Un e-mail d’invitation lui permettra de choisir son mot de passe.'
                    : 'Les permissions prennent effet côté base (RLS) dès l’enregistrement.'}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-5 p-4">
                {editor.mode === 'invite' ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nom complet" required htmlFor="invite-name">
                      <Input id="invite-name" value={editor.full_name} onChange={(event) => setEditor({ ...editor, full_name: event.target.value })} />
                    </Field>
                    <Field label="E-mail professionnel" required htmlFor="invite-email">
                      <Input
                        id="invite-email"
                        type="email"
                        value={editor.email}
                        onChange={(event) => setEditor({ ...editor, email: event.target.value })}
                      />
                    </Field>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="user-active"
                      checked={editor.is_active}
                      disabled={editor.user.id === currentUserId}
                      onCheckedChange={(on) => setEditor({ ...editor, is_active: on })}
                    />
                    <Label htmlFor="user-active">Compte actif</Label>
                  </div>
                )}
                <PermissionMatrix value={permissions} onChange={setPermissions} />
                <FormMessage error={formError} />
              </div>
              <SheetFooter className="mt-auto flex-row border-t">
                <Button onClick={submit} disabled={saving}>
                  {saving && <Loader2 className="animate-spin" />} {editor.mode === 'invite' ? 'Envoyer l’invitation' : 'Enregistrer'}
                </Button>
                <Button variant="ghost" onClick={() => setEditor(null)}>
                  Annuler
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirm} onOpenChange={(value) => !value && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === 'delete'
                ? `Supprimer définitivement le compte de ${confirm && nameOf(confirm.user)} ?`
                : confirm?.user.is_active
                  ? `Retirer l’accès au portail à ${confirm && nameOf(confirm.user)} ?`
                  : `Donner l’accès au portail à ${confirm && nameOf(confirm.user)} ?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === 'delete'
                ? 'Cette action est irréversible. Son historique (locations, contrats, paiements…) est conservé, mais ne sera plus attribué nommément à cette personne.'
                : 'Les historiques du client sont conservés.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction variant={confirm?.kind === 'delete' ? 'destructive' : 'default'} onClick={confirmed}>
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
