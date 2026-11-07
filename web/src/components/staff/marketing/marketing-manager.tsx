'use client';

import { useEffect, useMemo, useState } from 'react';
import { Car, FileText, Loader2, Megaphone, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { FormMessage } from '@/components/auth/form-message';
import { Field } from '@/components/staff/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  CHANNELS,
  deleteCampaign,
  deleteExpense,
  discardReceipt,
  EMPTY_CAMPAIGN,
  EMPTY_EXPENSE,
  listCampaigns,
  listExpenses,
  loanValue,
  receiptUrl,
  saveCampaign,
  saveExpense,
  toExpenseForm,
  totalsBy,
  uploadReceipt,
  validateExpense,
  type Campaign,
  type CampaignForm,
  type Expense,
  type ExpenseForm,
} from '@/lib/data/marketing';
import { formatMoney } from '@/lib/data/public-catalog';
import { frenchError } from '@/lib/errors';
import { frDate } from '@/lib/format';
import { prepareImage } from '@/lib/image-compress';
import { createClient } from '@/lib/supabase/client';
import { vehicleOptions } from '@/lib/data/reservations';

type VehicleChoice = { id: string; label: string; price: number };
export type MarketingPermissions = { create: boolean; update: boolean; delete: boolean };

/** Barre proportionnelle au plus grand total. */
function Bar({ name, value, max }: { name: string; value: number; max: number }) {
  return (
    <li className="grid gap-1 py-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate">{name}</span>
        <strong className="shrink-0 tabular-nums">{formatMoney(value)}</strong>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${max ? Math.max(4, (value / max) * 100) : 0}%` }} />
      </div>
    </li>
  );
}

export function MarketingManager({ permissions, userId }: { permissions: MarketingPermissions; userId: string | null }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [vehicles, setVehicles] = useState<VehicleChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Période par défaut : du 1er janvier à aujourd'hui, comme l'écran Rapports.
  const [from, setFrom] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [channel, setChannel] = useState('all');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [editing, setEditing] = useState<ExpenseForm | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [campaignForm, setCampaignForm] = useState<CampaignForm | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null);

  function load() {
    const db = createClient();
    return Promise.all([listExpenses(db), listCampaigns(db), vehicleOptions(db), db.from('vehicles').select('id,rental_price')]).then(
      ([expenseRows, campaignRows, cars, prices]) => {
        setExpenses(expenseRows.data ?? []);
        setCampaigns(campaignRows.data ?? []);
        const priceOf = new Map((prices.data ?? []).map((row) => [row.id, Number(row.rental_price ?? 0)]));
        setVehicles((cars.data ?? []).map((car) => ({ id: car.id, label: `${car.registration_number} — ${car.make} ${car.model}`, price: priceOf.get(car.id) ?? 0 })));
        const failure = expenseRows.error ?? campaignRows.error ?? cars.error ?? prices.error;
        setError(failure ? frenchError(failure) : '');
        setLoading(false);
      },
    );
  }

  useEffect(() => {
    load();
  }, []);

  const campaignName = (id: string | null) => campaigns.find((campaign) => campaign.id === id)?.name;
  const visible = useMemo(
    () =>
      expenses.filter(
        (expense) =>
          (!from || expense.spent_on >= from) &&
          (!to || expense.spent_on <= to) &&
          (channel === 'all' || expense.channel === channel) &&
          (campaignFilter === 'all' || (campaignFilter === 'none' ? !expense.campaign_id : expense.campaign_id === campaignFilter)),
      ),
    [expenses, from, to, channel, campaignFilter],
  );
  const total = visible.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const inKind = visible.filter((expense) => expense.in_kind).reduce((sum, expense) => sum + Number(expense.amount), 0);
  const byChannel = totalsBy(visible, (expense) => CHANNELS[expense.channel] ?? expense.channel);
  const spentOnCampaign = (id: string) => expenses.filter((expense) => expense.campaign_id === id).reduce((sum, expense) => sum + Number(expense.amount), 0);

  async function openReceipt(path: string) {
    const { data, error: failure } = await receiptUrl(createClient(), path);
    if (failure || !data) return toast.error('Justificatif introuvable.');
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function remove() {
    if (!deleting) return;
    const failure = await deleteExpense(createClient(), deleting);
    setDeleting(null);
    if (failure) return toast.error(frenchError(failure));
    toast.success('Dépense supprimée.');
    load();
  }

  async function removeCampaign() {
    if (!deletingCampaign) return;
    const { error: failure } = await deleteCampaign(createClient(), deletingCampaign.id);
    setDeletingCampaign(null);
    if (failure) return toast.error(frenchError(failure));
    toast.success('Campagne supprimée. Ses dépenses sont conservées, sans campagne.');
    load();
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Pilotage</p>
          <h2 className="text-2xl font-semibold tracking-tight">Marketing</h2>
          <p className="text-sm text-muted-foreground">
            Publicité, influenceurs, affiches, événements : tout ce que vous dépensez pour vous faire connaître. Ces dépenses sont déduites du résultat net dans Rapports.
          </p>
        </div>
        {permissions.create && (
          <Button onClick={() => setEditing(EMPTY_EXPENSE())}>
            <Plus /> Nouvelle dépense
          </Button>
        )}
      </div>

      <FormMessage error={error} />

      <Tabs defaultValue="expenses">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="expenses">Dépenses</TabsTrigger>
          <TabsTrigger value="campaigns">Campagnes ({campaigns.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="mt-4 grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Du" htmlFor="mk-from">
              <Input id="mk-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </Field>
            <Field label="Au" htmlFor="mk-to">
              <Input id="mk-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </Field>
            <Field label="Canal">
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="w-full" aria-label="Canal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les canaux</SelectItem>
                  {Object.entries(CHANNELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Campagne">
              <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                <SelectTrigger className="w-full" aria-label="Campagne">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les campagnes</SelectItem>
                  <SelectItem value="none">Sans campagne</SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
            <div className="grid grid-cols-2 gap-3">
              <Card className="gap-0 py-4">
                <CardContent className="px-4">
                  <p className="text-xs text-muted-foreground">Total des dépenses</p>
                  <p className="text-xl font-semibold tabular-nums">{formatMoney(total)}</p>
                </CardContent>
              </Card>
              <Card className="gap-0 py-4">
                <CardContent className="px-4">
                  <p className="text-xs text-muted-foreground">Nombre de dépenses</p>
                  <p className="text-xl font-semibold tabular-nums">{visible.length}</p>
                </CardContent>
              </Card>
              <Card className="gap-0 py-4">
                <CardContent className="px-4">
                  <p className="text-xs text-muted-foreground">Argent dépensé</p>
                  <p className="text-xl font-semibold tabular-nums">{formatMoney(total - inKind)}</p>
                </CardContent>
              </Card>
              <Card className="gap-0 py-4">
                <CardContent className="px-4">
                  <p className="text-xs text-muted-foreground">Véhicules prêtés (valeur)</p>
                  <p className="text-xl font-semibold tabular-nums">{formatMoney(inKind)}</p>
                </CardContent>
              </Card>
            </div>
            <Card className="gap-0 py-4">
              <CardContent className="px-4">
                <p className="mb-1 text-xs text-muted-foreground">Par canal</p>
                {byChannel.length ? (
                  <ul className="divide-y">
                    {byChannel.map(([name, value]) => (
                      <Bar key={name} name={name} value={value} max={byChannel[0][1]} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune dépense sur cette période.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="py-0">
            {loading ? (
              <div className="grid grid-cols-1 gap-3 p-4 [&>*]:min-w-0">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : !visible.length ? (
              <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
                <Megaphone className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Aucune dépense avec ces filtres.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Date</TableHead>
                    <TableHead>Dépense</TableHead>
                    <TableHead className="hidden md:table-cell">Canal</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="pl-4 text-xs whitespace-nowrap tabular-nums">{frDate(expense.spent_on)}</TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="font-medium">{expense.label}</div>
                        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          {expense.influencer_name && <span>{expense.influencer_name}</span>}
                          {campaignName(expense.campaign_id) && <Badge variant="secondary">{campaignName(expense.campaign_id)}</Badge>}
                          {expense.in_kind && (
                            <Badge variant="outline" className="gap-1">
                              <Car className="size-3" /> En nature{expense.loan_days ? ` · ${expense.loan_days} j` : ''}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground md:hidden">{CHANNELS[expense.channel]}</span>
                      </TableCell>
                      <TableCell className="hidden text-sm md:table-cell">{CHANNELS[expense.channel] ?? expense.channel}</TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">{formatMoney(expense.amount)}</TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1">
                          {expense.receipt_path && (
                            <Button variant="ghost" size="icon" aria-label="Voir le justificatif" onClick={() => openReceipt(expense.receipt_path!)}>
                              <FileText />
                            </Button>
                          )}
                          {permissions.update && (
                            <Button variant="ghost" size="icon" aria-label="Modifier" onClick={() => setEditing(toExpenseForm(expense))}>
                              <Pencil />
                            </Button>
                          )}
                          {permissions.delete && (
                            <Button variant="ghost" size="icon" aria-label="Supprimer" className="text-destructive" onClick={() => setDeleting(expense)}>
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4 grid gap-4">
          {permissions.create && (
            <Button className="justify-self-start" variant="outline" onClick={() => setCampaignForm({ ...EMPTY_CAMPAIGN })}>
              <Plus /> Nouvelle campagne
            </Button>
          )}
          {!campaigns.length ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Aucune campagne. Regroupez plusieurs dépenses sous un nom (« Lancement transfert aéroport », « Tabaski ») pour mesurer ce que chacune a coûté.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {campaigns.map((campaign) => {
                const spent = spentOnCampaign(campaign.id);
                const budget = Number(campaign.budget ?? 0);
                const over = budget > 0 && spent > budget;
                return (
                  <Card key={campaign.id} className="gap-3 py-4">
                    <CardContent className="grid gap-3 px-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{campaign.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {campaign.starts_on ? frDate(campaign.starts_on) : '…'} → {campaign.ends_on ? frDate(campaign.ends_on) : '…'}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {permissions.update && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Modifier la campagne"
                              onClick={() =>
                                setCampaignForm({
                                  id: campaign.id,
                                  name: campaign.name,
                                  starts_on: campaign.starts_on ?? '',
                                  ends_on: campaign.ends_on ?? '',
                                  budget: campaign.budget === null ? '' : String(campaign.budget),
                                  notes: campaign.notes ?? '',
                                })
                              }
                            >
                              <Pencil />
                            </Button>
                          )}
                          {permissions.delete && (
                            <Button variant="ghost" size="icon" aria-label="Supprimer la campagne" className="text-destructive" onClick={() => setDeletingCampaign(campaign)}>
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="text-muted-foreground">Dépensé</span>
                          <strong className={over ? 'text-destructive tabular-nums' : 'tabular-nums'}>{formatMoney(spent)}</strong>
                        </div>
                        {budget > 0 && (
                          <>
                            <div className="mt-1 h-1.5 rounded-full bg-muted">
                              <div className={over ? 'h-full rounded-full bg-destructive' : 'h-full rounded-full bg-primary'} style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }} />
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Budget prévu {formatMoney(budget)} · {over ? `dépassé de ${formatMoney(spent - budget)}` : `reste ${formatMoney(budget - spent)}`}
                            </p>
                          </>
                        )}
                      </div>
                      {campaign.notes && <p className="text-xs text-muted-foreground">{campaign.notes}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ExpenseSheet
        form={editing}
        campaigns={campaigns}
        vehicles={vehicles}
        userId={userId}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          toast.success('Dépense enregistrée.');
          load();
        }}
      />
      <CampaignDialog
        form={campaignForm}
        userId={userId}
        onClose={() => setCampaignForm(null)}
        onSaved={() => {
          setCampaignForm(null);
          toast.success('Campagne enregistrée.');
          load();
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette dépense ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleting?.label} » ({deleting ? formatMoney(deleting.amount) : ''}) sera retirée du résultat net. La suppression est tracée dans le journal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Garder</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!deletingCampaign} onOpenChange={(open) => !open && setDeletingCampaign(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette campagne ?</AlertDialogTitle>
            <AlertDialogDescription>Les dépenses rattachées à « {deletingCampaign?.name} » sont conservées, mais ne seront plus dans une campagne.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Garder</AlertDialogCancel>
            <AlertDialogAction onClick={removeCampaign}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ExpenseSheet({
  form: initial,
  campaigns,
  vehicles,
  userId,
  onClose,
  onSaved,
}: {
  form: ExpenseForm | null;
  campaigns: Campaign[];
  vehicles: VehicleChoice[];
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Le formulaire est recréé à chaque ouverture (clé = nouvelle dépense ou identifiant).
  return (
    <Sheet open={!!initial} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        {initial && <ExpenseFormBody key={initial.id ?? 'new'} initial={initial} campaigns={campaigns} vehicles={vehicles} userId={userId} onClose={onClose} onSaved={onSaved} />}
      </SheetContent>
    </Sheet>
  );
}

function ExpenseFormBody({
  initial,
  campaigns,
  vehicles,
  userId,
  onClose,
  onSaved,
}: {
  initial: ExpenseForm;
  campaigns: Campaign[];
  vehicles: VehicleChoice[];
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploaded, setUploaded] = useState<string | null>(null);
  const set = <K extends keyof ExpenseForm>(key: K, value: ExpenseForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  /** Valeur de location des jours prêtés, recalculée quand le véhicule ou le nombre de jours change. */
  function loan(vehicleId: string, days: string) {
    const car = vehicles.find((vehicle) => vehicle.id === vehicleId);
    return car && Number(days) >= 1 ? String(loanValue(car.price, Number(days))) : null;
  }

  async function pickReceipt(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const prepared = file.type.startsWith('image/') ? await prepareImage(file) : file;
    const { path, error: failure } = await uploadReceipt(createClient(), prepared);
    setUploading(false);
    if (failure || !path) return setError(frenchError(failure));
    // Un justificatif envoyé puis remplacé avant l'enregistrement est retiré tout de suite.
    if (uploaded) await discardReceipt(createClient(), uploaded);
    setUploaded(path);
    set('receipt_path', path);
  }

  async function close() {
    if (uploaded && uploaded !== initial.receipt_path) await discardReceipt(createClient(), uploaded);
    onClose();
  }

  async function save() {
    setError('');
    const problem = validateExpense(form);
    if (problem) return setError(problem);
    setSaving(true);
    const db = createClient();
    const { error: failure } = await saveExpense(db, form, userId);
    if (failure) {
      setSaving(false);
      return setError(frenchError(failure));
    }
    // L'ancien justificatif n'a plus d'objet une fois remplacé ou retiré.
    if (initial.receipt_path && initial.receipt_path !== form.receipt_path) await discardReceipt(db, initial.receipt_path);
    setSaving(false);
    onSaved();
  }

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>{form.id ? 'Modifier la dépense' : 'Nouvelle dépense'}</SheetTitle>
        <SheetDescription>Elle sera déduite du résultat net de sa période, dans Rapports.</SheetDescription>
      </SheetHeader>
      <div className="grid grid-cols-1 gap-4 p-4 [&>*]:min-w-0">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" required htmlFor="mk-date">
            <Input id="mk-date" type="date" value={form.spent_on} onChange={(event) => set('spent_on', event.target.value)} />
          </Field>
          <Field label="Canal" required>
            <Select value={form.channel} onValueChange={(value) => set('channel', value)}>
              <SelectTrigger className="w-full" aria-label="Canal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CHANNELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Libellé" required htmlFor="mk-label">
          <Input id="mk-label" value={form.label} onChange={(event) => set('label', event.target.value)} placeholder="Ex. Sponsorisation Facebook, vidéo Instagram…" maxLength={200} />
        </Field>
        {form.channel === 'influencer' && (
          <Field label="Influenceur (nom ou agence)" htmlFor="mk-influencer">
            <Input id="mk-influencer" value={form.influencer_name} onChange={(event) => set('influencer_name', event.target.value)} maxLength={120} />
          </Field>
        )}

        <div className="grid gap-3 rounded-lg border p-3">
          <label className="flex items-center justify-between gap-3 text-sm font-medium">
            Véhicule prêté (dépense en nature)
            <Switch
              checked={form.in_kind}
              onCheckedChange={(on) => {
                set('in_kind', on);
                if (!on) setForm((current) => ({ ...current, in_kind: false, vehicle_id: 'none', loan_days: '' }));
              }}
            />
          </label>
          {form.in_kind && (
            <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
              <Field label="Véhicule">
                <Select
                  value={form.vehicle_id}
                  onValueChange={(value) => {
                    const amount = loan(value, form.loan_days);
                    setForm((current) => ({ ...current, vehicle_id: value, ...(amount !== null ? { amount } : {}) }));
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="Véhicule prêté">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">À choisir</SelectItem>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Jours" htmlFor="mk-days">
                <Input
                  id="mk-days"
                  type="number"
                  min={1}
                  max={365}
                  inputMode="numeric"
                  value={form.loan_days}
                  onChange={(event) => {
                    const amount = loan(form.vehicle_id, event.target.value);
                    setForm((current) => ({ ...current, loan_days: event.target.value, ...(amount !== null ? { amount } : {}) }));
                  }}
                />
              </Field>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Le montant ci-dessous prend la valeur de location normale des jours prêtés (prix journalier × jours). Vous pouvez le corriger.
              </p>
            </div>
          )}
        </div>

        <Field label={form.in_kind ? 'Valeur estimée (FCFA)' : 'Montant (FCFA)'} required htmlFor="mk-amount">
          <Input id="mk-amount" type="number" min={0} inputMode="numeric" value={form.amount} onChange={(event) => set('amount', event.target.value)} />
        </Field>
        <Field label="Campagne">
          <Select value={form.campaign_id} onValueChange={(value) => set('campaign_id', value)}>
            <SelectTrigger className="w-full" aria-label="Campagne">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucune</SelectItem>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Notes" htmlFor="mk-notes">
          <Textarea id="mk-notes" rows={3} value={form.notes} onChange={(event) => set('notes', event.target.value)} maxLength={1000} />
        </Field>

        <div className="grid gap-2">
          <p className="text-sm font-medium">Justificatif (facture, reçu — photo ou PDF)</p>
          {form.receipt_path ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <FileText className="size-4" /> Justificatif joint
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => set('receipt_path', null)}>
                <X /> Retirer
              </Button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground hover:bg-muted/50">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {uploading ? 'Envoi…' : 'Ajouter un justificatif'}
              <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(event) => pickReceipt(event.target.files?.[0])} disabled={uploading} />
            </label>
          )}
        </div>
        <FormMessage error={error} />
      </div>
      <SheetFooter className="border-t">
        <Button variant="outline" onClick={close}>
          Annuler
        </Button>
        <Button onClick={save} disabled={saving || uploading}>
          {saving && <Loader2 className="animate-spin" />} Enregistrer
        </Button>
      </SheetFooter>
    </>
  );
}

function CampaignDialog({ form: initial, userId, onClose, onSaved }: { form: CampaignForm | null; userId: string | null; onClose: () => void; onSaved: () => void }) {
  return (
    <Dialog open={!!initial} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{initial && <CampaignFormBody key={initial.id ?? 'new'} initial={initial} userId={userId} onClose={onClose} onSaved={onSaved} />}</DialogContent>
    </Dialog>
  );
}

function CampaignFormBody({ initial, userId, onClose, onSaved }: { initial: CampaignForm; userId: string | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof CampaignForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (form.name.trim().length < 2) return setError('Donnez un nom à la campagne.');
    if (form.budget.trim() !== '' && !(Number(form.budget) >= 0)) return setError('Le budget doit être un nombre positif.');
    if (form.starts_on && form.ends_on && form.ends_on < form.starts_on) return setError('La fin ne peut pas précéder le début.');
    setSaving(true);
    const { error: failure } = await saveCampaign(createClient(), form, userId);
    setSaving(false);
    if (failure) return setError(frenchError(failure));
    onSaved();
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{form.id ? 'Modifier la campagne' : 'Nouvelle campagne'}</DialogTitle>
        <DialogDescription>Regroupez des dépenses sous un même nom pour voir ce qu’elle a coûté, face au budget prévu.</DialogDescription>
      </DialogHeader>
      <Field label="Nom" required htmlFor="cp-name">
        <Input id="cp-name" value={form.name} onChange={(event) => set('name', event.target.value)} maxLength={120} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Début" htmlFor="cp-start">
          <Input id="cp-start" type="date" value={form.starts_on} onChange={(event) => set('starts_on', event.target.value)} />
        </Field>
        <Field label="Fin" htmlFor="cp-end">
          <Input id="cp-end" type="date" value={form.ends_on} onChange={(event) => set('ends_on', event.target.value)} />
        </Field>
      </div>
      <Field label="Budget prévu (FCFA)" htmlFor="cp-budget">
        <Input id="cp-budget" type="number" min={0} inputMode="numeric" value={form.budget} onChange={(event) => set('budget', event.target.value)} />
      </Field>
      <Field label="Notes" htmlFor="cp-notes">
        <Textarea id="cp-notes" rows={3} value={form.notes} onChange={(event) => set('notes', event.target.value)} maxLength={1000} />
      </Field>
      <FormMessage error={error} />
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />} Enregistrer
        </Button>
      </DialogFooter>
    </form>
  );
}
