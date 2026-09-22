import { Component, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div><h1 class="h3 mb-0">Paiements et cautions</h1><small class="text-muted">Encaissements physiques enregistrés dans l’application</small></div>
      @if (auth.can('payments', 'create')) { <button class="btn btn-primary" (click)="openPayment()">Enregistrer un paiement</button> }
    </div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    @if (message()) { <div class="alert alert-success">{{ message() }}</div> }
    @if (loading()) { <p class="text-muted">Chargement…</p> }
    @if (!loading() && !rows().length) { <div class="alert alert-light border">Aucune location à afficher.</div> }
    @if (rows().length) {<div class="table-responsive bg-white border rounded"><table class="table table-hover mb-0">
      <thead><tr><th>Client</th><th>Location</th><th>Total</th><th>Reçu</th><th>Reste</th><th>Statut</th><th>Caution</th><th></th></tr></thead>
      <tbody>@for (row of rows(); track row.id) {<tr><td>{{ row.clients?.first_name }} {{ row.clients?.last_name }}</td><td>{{ row.vehicles?.registration_number }}</td><td>{{ row.rental_price | number:'1.0-2' }}</td><td>{{ received(row) | number:'1.0-2' }}</td><td>{{ outstanding(row) | number:'1.0-2' }}</td><td><span class="badge text-bg-secondary">{{ paymentStatus(row) }}</span></td><td>{{ depositLabel(row) }}</td><td><button class="btn btn-sm btn-outline-primary" (click)="detail(row)">Détail</button></td></tr>}</tbody>
    </table></div>}

    @if (paymentForm()) {<section class="card mt-4"><div class="card-body"><h2 class="h5">Nouvel encaissement manuel</h2>
      <div class="row g-3"><div class="col-md-6"><label class="form-label">Location</label><select class="form-select" [(ngModel)]="paymentForm()!.rental_id" (change)="syncPaymentRental()"><option value="">Sélectionner</option>@for (row of rows(); track row.id) {<option [value]="row.id">{{ row.clients?.first_name }} {{ row.clients?.last_name }} — {{ row.vehicles?.registration_number }} (reste : {{ outstanding(row) | number:'1.0-2' }})</option>}</select></div><div class="col-md-3"><label class="form-label">Montant</label><input class="form-control" type="number" min="0.01" step="0.01" [(ngModel)]="paymentForm()!.amount"></div><div class="col-md-3"><label class="form-label">Date</label><input class="form-control" type="datetime-local" [(ngModel)]="paymentForm()!.payment_date"></div><div class="col-md-4"><label class="form-label">Moyen d’encaissement</label><select class="form-select" [(ngModel)]="paymentForm()!.payment_method"><option value="cash">Espèces</option><option value="bank_transfer">Virement</option><option value="mobile_money">Mobile money encaissé</option><option value="other">Autre</option></select></div><div class="col-md-4"><label class="form-label">Référence</label><input class="form-control" [(ngModel)]="paymentForm()!.reference"></div><div class="col-md-4"><label class="form-label">Observation</label><input class="form-control" [(ngModel)]="paymentForm()!.observation"></div></div>
      <p class="small text-muted mt-3">Le paiement est définitif après enregistrement. Pour une correction, utilisez la procédure comptable prévue ; la base interdit la modification et la suppression.</p><button class="btn btn-success" [disabled]="saving()" (click)="savePayment()">{{ saving() ? 'Enregistrement…' : 'Enregistrer' }}</button><button class="btn btn-link" (click)="paymentForm.set(null)">Annuler</button>
    </div></section>}

    @if (selected()) {<section class="card mt-4"><div class="card-body"><div class="d-flex justify-content-between"><h2 class="h5">Détail financier — {{ selected().clients?.first_name }} {{ selected().clients?.last_name }}</h2><button class="btn-close" (click)="selected.set(null)"></button></div>
      <div class="row text-center my-3"><div class="col-md-4"><div class="border rounded p-2"><small>Total location</small><strong class="d-block">{{ selected().rental_price | number:'1.0-2' }}</strong></div></div><div class="col-md-4"><div class="border rounded p-2"><small>Paiements reçus</small><strong class="d-block">{{ received(selected()) | number:'1.0-2' }}</strong></div></div><div class="col-md-4"><div class="border rounded p-2"><small>Solde restant</small><strong class="d-block">{{ outstanding(selected()) | number:'1.0-2' }}</strong></div></div></div>
      <h3 class="h6">Historique des paiements</h3>@if (!selectedPayments().length) {<p class="text-muted">Aucun paiement enregistré.</p>} @else {<div class="table-responsive"><table class="table"><thead><tr><th>Date</th><th>Montant</th><th>Moyen</th><th>Référence / observation</th><th>Enregistré par</th></tr></thead><tbody>@for (payment of selectedPayments(); track payment.id) {<tr><td>{{ payment.payment_date | date:'short' }}</td><td>{{ payment.amount | number:'1.0-2' }}</td><td>{{ payment.payment_method || '—' }}</td><td>{{ payment.reference || '—' }} {{ payment.observation ? '— ' + payment.observation : '' }}</td><td>{{ payment.recorded_by || '—' }}</td></tr>}</tbody></table></div>}
      <hr><h3 class="h6">Caution — hors chiffre d’affaires</h3>
      @if (selectedDeposit()) {<div class="row"><div class="col-md-3">État : <strong>{{ depositStatus(selectedDeposit().status) }}</strong></div><div class="col-md-3">Montant : <strong>{{ selectedDeposit().amount | number:'1.0-2' }}</strong></div><div class="col-md-3">Restitué : <strong>{{ selectedDeposit().returned_amount | number:'1.0-2' }}</strong></div><div class="col-md-3">Retenu : <strong>{{ selectedDeposit().retained_amount | number:'1.0-2' }}</strong></div></div><p class="mt-2 mb-0">{{ selectedDeposit().observation || 'Aucune note.' }}</p>} @else {<p class="text-muted">Aucune caution enregistrée.</p>}
      @if (auth.can('deposits', 'create') || (selectedDeposit() && auth.can('deposits', 'update'))) {<button class="btn btn-outline-primary mt-3" (click)="openDeposit()">{{ selectedDeposit() ? 'Mettre à jour la caution' : 'Enregistrer la caution' }}</button>}
    </div></section>}

    @if (depositForm()) {<section class="card mt-4"><div class="card-body"><h2 class="h5">Caution — séparée des paiements</h2><div class="row g-3"><div class="col-md-3"><label class="form-label">Montant attendu</label><input class="form-control" type="number" [(ngModel)]="depositForm()!.amount" readonly></div><div class="col-md-3"><label class="form-label">État</label><select class="form-select" [(ngModel)]="depositForm()!.status" (change)="setDepositAmounts()"><option value="not_received">Non reçue</option><option value="received">Reçue</option><option value="returned">Restituée</option><option value="retained">Retenue</option></select></div><div class="col-md-3"><label class="form-label">Montant restitué</label><input class="form-control" type="number" min="0" [(ngModel)]="depositForm()!.returned_amount"></div><div class="col-md-3"><label class="form-label">Montant retenu</label><input class="form-control" type="number" min="0" [(ngModel)]="depositForm()!.retained_amount"></div><div class="col-md-12"><label class="form-label">Notes</label><input class="form-control" [(ngModel)]="depositForm()!.observation"></div></div><button class="btn btn-success mt-3" [disabled]="saving()" (click)="saveDeposit()">{{ saving() ? 'Enregistrement…' : 'Enregistrer la caution' }}</button><button class="btn btn-link" (click)="depositForm.set(null)">Annuler</button></div></section>}
  `
})
export class PaymentsComponent implements OnInit {
  rows = signal<any[]>([]); selected = signal<any>(null); selectedPayments = signal<any[]>([]); selectedDeposit = signal<any>(null);
  paymentForm = signal<any>(null); depositForm = signal<any>(null); loading = signal(false); saving = signal(false); error = signal(''); message = signal('');
  constructor(public auth: AuthService) {}
  async ngOnInit() { await this.load(); }
  private fail(error: unknown) { this.error.set(error instanceof Error ? error.message : String(error)); this.message.set(''); }
  private clear() { this.error.set(''); this.message.set(''); }
  async load() {
    this.loading.set(true); this.clear();
    const [rentals, payments, deposits] = await Promise.all([
      this.auth.supabase().from('rentals').select('*,clients(first_name,last_name),vehicles(registration_number)').order('created_at', { ascending: false }),
      this.auth.supabase().from('payments').select('*'),
      this.auth.can('deposits') ? this.auth.supabase().from('deposits').select('*') : Promise.resolve({ data: [], error: null })
    ]);
    this.loading.set(false); if (rentals.error || payments.error || deposits.error) return this.fail(rentals.error?.message ?? payments.error?.message ?? deposits.error?.message ?? 'Erreur de chargement.');
    const byRental = new Map((payments.data ?? []).map(payment => [payment.rental_id, [] as any[]]));
    for (const payment of payments.data ?? []) byRental.get(payment.rental_id)?.push(payment);
    const depositByRental = new Map((deposits.data ?? []).map(deposit => [deposit.rental_id, deposit]));
    this.rows.set((rentals.data ?? []).map(rental => ({ ...rental, payments: byRental.get(rental.id) ?? [], deposit: depositByRental.get(rental.id) ?? null })));
  }
  received(row: any): number { return (row?.payments ?? []).reduce((sum: number, payment: any) => sum + Number(payment.amount ?? 0), 0); }
  outstanding(row: any): number { return Math.max(0, Number(row?.rental_price ?? 0) - this.received(row)); }
  paymentStatus(row: any): string { const received = this.received(row), total = Number(row?.rental_price ?? 0); return received <= 0 ? 'Non payé' : received < total ? 'Partiellement payé' : 'Payé'; }
  depositLabel(row: any): string { return row?.deposit ? this.depositStatus(row.deposit.status) : 'Non reçue'; }
  depositStatus(status: string): string { return ({ not_received: 'Non reçue', received: 'Reçue', returned: 'Restituée', retained: 'Retenue' } as Record<string, string>)[status] ?? status; }
  openPayment() { this.clear(); this.paymentForm.set({ rental_id: '', amount: null, payment_date: this.localDateTime(), payment_method: 'cash', reference: '', observation: '' }); }
  syncPaymentRental() {}
  async savePayment() {
    this.clear(); const form = this.paymentForm(); if (!form?.rental_id || Number(form.amount) <= 0) return this.fail('Sélectionnez une location et un montant strictement positif.');
    this.saving.set(true); const result = await this.auth.supabase().from('payments').insert({ ...form, payment_date: new Date(form.payment_date).toISOString() }); this.saving.set(false);
    if (result.error) return this.fail(result.error.message); this.paymentForm.set(null); this.message.set('Paiement manuel enregistré.'); await this.load();
  }
  async detail(row: any) { this.clear(); this.selected.set(row); this.selectedPayments.set(row.payments ?? []); this.selectedDeposit.set(row.deposit ?? null); }
  openDeposit() {
    this.clear(); const row = this.selected(); if (!row) return; const existing = this.selectedDeposit();
    this.depositForm.set(existing ? { ...existing } : { rental_id: row.id, amount: Number(row.deposit_amount ?? 0), status: 'not_received', returned_amount: 0, retained_amount: 0, observation: '' });
  }
  setDepositAmounts() { const form = this.depositForm(); if (!form) return; const amount = Number(form.amount); if (form.status === 'not_received' || form.status === 'received') this.depositForm.set({ ...form, returned_amount: 0, retained_amount: 0 }); if (form.status === 'returned') this.depositForm.set({ ...form, returned_amount: amount, retained_amount: 0 }); }
  async saveDeposit() {
    this.clear(); const form = this.depositForm(); if (!form) return; const now = new Date().toISOString(); const payload: any = { ...form };
    if (payload.status === 'received') payload.received_at = payload.received_at ?? now;
    if (payload.status === 'returned') { payload.received_at = payload.received_at ?? now; payload.returned_at = now; }
    if (payload.status === 'retained') { payload.received_at = payload.received_at ?? now; payload.retained_at = now; }
    this.saving.set(true); const result = form.id ? await this.auth.supabase().from('deposits').update(payload).eq('id', form.id) : await this.auth.supabase().from('deposits').insert(payload); this.saving.set(false);
    if (result.error) return this.fail(result.error.message); this.depositForm.set(null); this.message.set('Caution enregistrée séparément des paiements.'); await this.load(); const updated = this.rows().find(row => row.id === this.selected()?.id); if (updated) await this.detail(updated);
  }
  private localDateTime(): string { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); }
}
