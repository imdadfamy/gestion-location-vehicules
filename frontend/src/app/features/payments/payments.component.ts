import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { CompanyService } from '../../core/data/company.service';
import { PaymentMethod, PaymentsService } from '../../core/data/payments.service';
import { RentalsService } from '../../core/data/rentals.service';
import { ActorNamesService } from '../../core/actor-names.service';

@Component({
  standalone: true,
  imports: [FormsModule, DatePipe],
  styleUrl: './payments.component.scss',
  templateUrl: './payments.component.html',
})
export class PaymentsComponent implements OnInit {
  rows = signal<any[]>([]);
  selected = signal<any>(null);
  selectedPayments = signal<any[]>([]);
  loading = signal(false);
  error = signal('');
  message = signal('');
  markingId = signal<string | null>(null);
  saving = signal(false);
  payForm: {
    amount: number;
    payment_date: string;
    payment_method: PaymentMethod;
    reference: string;
    observation: string;
  } | null = null;
  retainForm: { retained: number; observation: string } | null = null;
  today = new Date();
  company = signal<any>({});
  logoUrl = signal('');
  constructor(
    public auth: AuthService,
    private actors: ActorNamesService,
    private companyData: CompanyService,
    private payments: PaymentsService,
    private rentals: RentalsService,
  ) {}
  async ngOnInit() {
    await Promise.all([this.load(), this.loadCompany()]);
  }
  async loadCompany() {
    const r = await this.companyData.get();
    if (r.data) {
      this.company.set(r.data);
      const logo = await this.companyData.logoUrl(r.data.logo_storage_path);
      if (logo) this.logoUrl.set(logo);
    }
  }
  receiptRef(row: any) {
    return (
      'REC-' +
      String(row?.id ?? '')
        .slice(0, 8)
        .toUpperCase()
    );
  }
  displayReference(payment: any) {
    const ref = String(payment.reference ?? '').trim();
    const clean = ref.startsWith('LOCATION-CONFIRMEE-') ? '' : ref;
    const parts = [clean || null, payment.observation || null].filter(Boolean);
    return parts.length ? parts.join(' — ') : '—';
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    const [rentals, payments, deposits] = await Promise.all([
      this.payments.rentals(),
      this.payments.all(),
      this.payments.deposits(),
    ]);
    this.loading.set(false);
    if (rentals.error || payments.error || deposits.error) {
      this.error.set(this.auth.errorMessage(rentals.error ?? payments.error ?? deposits.error));
      return;
    }
    const byRental = new Map<string, any[]>();
    for (const payment of payments.data ?? []) {
      const current = byRental.get(payment.rental_id) ?? [];
      current.push(payment);
      byRental.set(payment.rental_id, current);
    }
    const depositByRental = new Map((deposits.data ?? []).map((d) => [d.rental_id, d]));
    const prepared = (rentals.data ?? []).map((rental) => ({
      ...rental,
      payments: byRental.get(rental.id) ?? [],
      deposit: depositByRental.get(rental.id) ?? null,
    }));
    this.rows.set(prepared);
    await this.actors.load((payments.data ?? []).map((payment) => payment.recorded_by));
  }
  actorName(id: string | null | undefined) {
    return this.actors.label(id);
  }
  received(row: any) {
    return (row?.payments ?? []).reduce(
      (sum: number, payment: any) => sum + Number(payment.amount ?? 0),
      0,
    );
  }
  outstanding(row: any) {
    return Math.max(0, Number(row?.rental_price ?? 0) - this.received(row));
  }
  paymentStatus(row: any) {
    const total = Number(row?.rental_price ?? 0),
      received = this.received(row);
    return received <= 0 ? 'Non payé' : received < total ? 'Partiellement payé' : 'Payé';
  }
  tone(row: any) {
    return this.paymentStatus(row) === 'Payé'
      ? 'success'
      : this.paymentStatus(row) === 'Partiellement payé'
        ? 'warning'
        : 'secondary';
  }
  money(value: any) {
    return (
      Number(value ?? 0)
        .toLocaleString('fr-FR')
        .replace(/\\u202f/g, ' ') + ' FCFA'
    );
  }
  method(value: string) {
    return (
      (
        {
          cash: 'Espèces',
          bank_transfer: 'Virement',
          mobile_money: 'Mobile money',
          other: 'Autre',
        } as Record<string, string>
      )[value] ?? '—'
    );
  }
  readonly methods: { value: PaymentMethod; label: string }[] = [
    { value: 'cash', label: 'Espèces' },
    { value: 'mobile_money', label: 'Mobile money' },
    { value: 'bank_transfer', label: 'Virement' },
    { value: 'other', label: 'Autre' },
  ];
  depositStatus(row: any) {
    if (!(Number(row?.deposit_amount) > 0)) return { label: 'Aucune', tone: 'light' };
    return (
      (
        {
          received: { label: 'Reçue', tone: 'primary' },
          returned: { label: 'Restituée', tone: 'success' },
          retained: { label: 'Retenue', tone: 'warning' },
        } as Record<string, { label: string; tone: string }>
      )[row?.deposit?.status] ?? { label: 'Non reçue', tone: 'secondary' }
    );
  }
  private today10() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  private resetForms(row: any) {
    this.payForm = {
      amount: this.outstanding(row),
      payment_date: this.today10(),
      payment_method: 'cash',
      reference: '',
      observation: '',
    };
    this.retainForm = null;
  }
  /** Rafraîchit la liste puis la fiche ouverte (les montants viennent de la base). */
  private async reloadSelected(id: string, message: string) {
    await this.load();
    const row = this.rows().find((item) => item.id === id);
    if (row) this.detail(row);
    this.message.set(message);
  }
  async recordPayment() {
    const row = this.selected();
    const form = this.payForm;
    if (!row || !form) return;
    this.error.set('');
    this.message.set('');
    const amount = Number(form.amount);
    if (!(amount > 0)) return this.error.set('Indiquez un montant supérieur à zéro.');
    if (amount > this.outstanding(row))
      return this.error.set(
        `Le montant dépasse le solde restant (${this.money(this.outstanding(row))}).`,
      );
    if (!form.payment_date) return this.error.set('Indiquez la date de l’encaissement.');
    this.saving.set(true);
    const result = await this.payments.record({
      rental_id: row.id,
      amount,
      payment_date: new Date(form.payment_date + 'T12:00:00').toISOString(),
      payment_method: form.payment_method,
      reference: form.reference.trim() || null,
      observation: form.observation.trim() || null,
    });
    this.saving.set(false);
    if (result.error) return this.error.set(this.auth.errorMessage(result.error));
    await this.reloadSelected(
      row.id,
      amount === this.outstanding(row)
        ? 'Encaissement enregistré : la location est entièrement payée.'
        : `Encaissement de ${this.money(amount)} enregistré.`,
    );
  }
  async receiveDeposit() {
    const row = this.selected();
    if (!row) return;
    this.error.set('');
    this.message.set('');
    this.saving.set(true);
    const result = await this.payments.receiveDeposit(row.id, Number(row.deposit_amount));
    this.saving.set(false);
    if (result.error) return this.error.set(this.auth.errorMessage(result.error));
    await this.reloadSelected(row.id, 'Caution enregistrée comme reçue.');
  }
  async returnDeposit() {
    const row = this.selected();
    if (!row?.deposit) return;
    if (
      !window.confirm(
        `Confirmer la restitution intégrale de la caution (${this.money(row.deposit.amount)}) ? Cette opération est définitive.`,
      )
    )
      return;
    this.error.set('');
    this.message.set('');
    this.saving.set(true);
    const result = await this.payments.returnDeposit(row.deposit.id, Number(row.deposit.amount));
    this.saving.set(false);
    if (result.error) return this.error.set(this.auth.errorMessage(result.error));
    await this.reloadSelected(row.id, 'Caution restituée au client.');
  }
  startRetain() {
    const row = this.selected();
    this.retainForm = { retained: Number(row?.deposit?.amount ?? 0), observation: '' };
  }
  async retainDeposit() {
    const row = this.selected();
    const form = this.retainForm;
    if (!row?.deposit || !form) return;
    this.error.set('');
    this.message.set('');
    const amount = Number(row.deposit.amount);
    const retained = Number(form.retained);
    if (!(retained > 0) || retained > amount)
      return this.error.set(
        `Le montant retenu doit être compris entre 1 et ${this.money(amount)}.`,
      );
    if (!form.observation.trim())
      return this.error.set('Indiquez le motif de la retenue (dommage, retard, carburant…).');
    if (
      !window.confirm(
        `Retenir ${this.money(retained)} et restituer ${this.money(amount - retained)} ? Cette opération est définitive.`,
      )
    )
      return;
    this.saving.set(true);
    const result = await this.payments.retainDeposit(
      row.deposit.id,
      amount,
      retained,
      form.observation.trim(),
    );
    this.saving.set(false);
    if (result.error) return this.error.set(this.auth.errorMessage(result.error));
    await this.reloadSelected(row.id, `Retenue de ${this.money(retained)} enregistrée.`);
  }
  detail(row: any) {
    this.error.set('');
    this.selected.set(row);
    this.selectedPayments.set(row.payments ?? []);
    this.resetForms(row);
    setTimeout(
      () =>
        document.querySelector('.invoice')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      0,
    );
  }
  print() {
    window.print();
  }
  async markPaid(row: any) {
    this.error.set('');
    this.message.set('');
    this.markingId.set(row.id);
    const result = await this.rentals.confirmPayment(row.id);
    this.markingId.set(null);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    await this.load();
    if (this.selected()?.id === row.id) this.detail(this.rows().find((item) => item.id === row.id));
    this.message.set('Paiement total marqué comme reçu.');
  }
}
