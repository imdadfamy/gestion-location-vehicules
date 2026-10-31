import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
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
  today = new Date();
  company = signal<any>({});
  logoUrl = signal('');
  constructor(
    public auth: AuthService,
    private actors: ActorNamesService,
  ) {}
  async ngOnInit() {
    await Promise.all([this.load(), this.loadCompany()]);
  }
  async loadCompany() {
    const r = await this.auth
      .supabase()
      .from('company_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (r.data) {
      this.company.set(r.data);
      if (r.data.logo_storage_path) {
        const s = await this.auth
          .supabase()
          .storage.from('rental-documents')
          .createSignedUrl(r.data.logo_storage_path, 300);
        if (s.data?.signedUrl) this.logoUrl.set(s.data.signedUrl);
      }
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
    const [rentals, payments] = await Promise.all([
      this.auth
        .supabase()
        .from('rentals')
        .select(
          '*,clients(first_name,last_name,phone,email),vehicles(registration_number,make,model)',
        )
        .order('created_at', { ascending: false }),
      this.auth.supabase().from('payments').select('*').order('payment_date', { ascending: false }),
    ]);
    this.loading.set(false);
    if (rentals.error || payments.error) {
      this.error.set(this.auth.errorMessage(rentals.error ?? payments.error));
      return;
    }
    const byRental = new Map<string, any[]>();
    for (const payment of payments.data ?? []) {
      const current = byRental.get(payment.rental_id) ?? [];
      current.push(payment);
      byRental.set(payment.rental_id, current);
    }
    const prepared = (rentals.data ?? []).map((rental) => ({
      ...rental,
      payments: byRental.get(rental.id) ?? [],
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
  detail(row: any) {
    this.error.set('');
    this.selected.set(row);
    this.selectedPayments.set(row.payments ?? []);
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
    const result = await this.auth
      .supabase()
      .rpc('confirm_rental_payment', { target_rental_id: row.id });
    this.markingId.set(null);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.message.set('Paiement total marqué comme reçu.');
    await this.load();
    if (this.selected()?.id === row.id) this.detail(this.rows().find((item) => item.id === row.id));
  }
}
