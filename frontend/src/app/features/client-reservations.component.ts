import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="page-heading"><div><p class="eyebrow">SUIVI</p><h1>Mes réservations</h1><p>Retrouvez toutes vos demandes, y compris les demandes finalisées ou annulées.</p></div></div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    @if (loading()) { <div class="empty-state">Chargement…</div> }
    @else if (!rows().length) { <div class="empty-state">Vous n’avez encore aucune réservation.</div> }
    @else { <div class="table-responsive app-table"><table class="table align-middle mb-0"><thead><tr><th>Véhicule</th><th>Période</th><th>Statut</th><th>Observation</th></tr></thead><tbody>@for (reservation of rows(); track reservation.id) { <tr><td><strong>{{ reservation.vehicles?.make }} {{ reservation.vehicles?.model }}</strong><small class="d-block text-muted">{{ reservation.vehicles?.registration_number }}</small></td><td>{{ reservation.planned_departure_date | date:'short' }}<br><small>au {{ reservation.planned_return_date | date:'short' }}</small></td><td><span class="badge text-bg-{{ tone(reservation.status) }}">{{ label(reservation) }}</span></td><td>{{ reservation.observation || '—' }}</td></tr> }</tbody></table></div> }
  `
})
export class ClientReservationsComponent implements OnInit {
  rows = signal<any[]>([]); loading = signal(false); error = signal('');
  constructor(private auth: AuthService) {}
  async ngOnInit() {
    this.loading.set(true); this.error.set('');
    const result = await this.auth.supabase().rpc('client_reservation_history');
    this.loading.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    this.rows.set(result.data ?? []);
  }
  label(reservation: any) {
    if (reservation.status === 'validated' && reservation.rental_id) return 'Contrat en attente de signatures';
    if (reservation.status === 'validated' && reservation.client_contract_sent_at) return 'Dossier à signer';
    return ({ pending: 'En attente', validated: 'Validée', finalized: 'Finalisée', cancelled: 'Annulée' } as Record<string, string>)[reservation.status] ?? reservation.status;
  }
  tone(status: string) { return ({ pending: 'warning', validated: 'info', finalized: 'success', cancelled: 'secondary' } as Record<string, string>)[status] ?? 'secondary'; }
}
