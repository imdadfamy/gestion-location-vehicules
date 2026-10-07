import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="page-heading"><div><p class="eyebrow">REVENUS</p><h1>Mes revenus</h1><p>Locations de vos véhicules et montant qui vous revient.</p></div></div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    @if (loading()) { <div class="empty-state">Chargement…</div> }
    @else if (!rows().length) { <div class="empty-state">Aucune location pour le moment.</div> }
    @else { <div class="table-responsive app-table"><table class="table align-middle mb-0"><thead><tr><th>Véhicule</th><th>Période</th><th>Statut</th><th class="text-end">Votre part</th></tr></thead><tbody>@for (item of rows(); track item.id) { <tr><td>{{ item.vehicles?.registration_number }}</td><td>{{ item.departure_date | date:'short' }} → {{ item.return_date | date:'short' }}</td><td><span class="badge text-bg-{{ statusTone(item.status) }}">{{ statusLabel(item.status) }}</span></td><td class="text-end">{{ money(payout(item)) }}</td></tr> }</tbody></table></div>
      <p class="text-muted small mt-3">Total des locations terminées : <strong>{{ money(totalEarned()) }}</strong></p>
    }
  `
})
export class PartnerEarningsComponent implements OnInit {
  rows = signal<any[]>([]); loading = signal(false); error = signal('');
  constructor(private auth: AuthService) {}
  async ngOnInit() {
    this.loading.set(true); this.error.set('');
    const result = await this.auth.supabase().from('rentals').select('*,vehicles(registration_number,make,model,partner_requested_price)').order('departure_date', { ascending: false });
    this.loading.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    this.rows.set(result.data ?? []);
  }
  statusLabel(status: string) { return ({ pending: 'En attente', active: 'En cours', overdue: 'En retard', completed: 'Terminée' } as Record<string, string>)[status] ?? status; }
  statusTone(status: string) { return ({ pending: 'warning', active: 'primary', overdue: 'danger', completed: 'success' } as Record<string, string>)[status] ?? 'secondary'; }
  money(value: any) { return Number(value ?? 0).toLocaleString('fr-FR') + ' FCFA'; }
  days(item: any) { return Math.max(1, Math.ceil((new Date(item.return_date).getTime() - new Date(item.departure_date).getTime()) / 86400000)); }
  payout(item: any) { return this.days(item) * Number(item.vehicles?.partner_requested_price ?? 0); }
  totalEarned() { return this.rows().filter(item => item.status === 'completed').reduce((sum, item) => sum + this.payout(item), 0); }
}
