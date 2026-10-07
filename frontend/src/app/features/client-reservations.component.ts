import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [DatePipe],
  styles: [`
    .reservation-table .badge{border-radius:999px;padding:.4em .8em;font-weight:700}
    .reservation-table tbody tr{transition:background-color .2s ease}
    .reservation-table tbody tr:hover{background:var(--app-accent-soft,rgba(7,146,164,.08))}
    .reservation-table .btn-outline-danger{border-radius:999px}
    @media(max-width:600px){.reservation-table table,.reservation-table tbody,.reservation-table tr,.reservation-table td{display:block;width:100%}.reservation-table thead{display:none}.reservation-table tr{margin-bottom:14px;padding:14px;border:1px solid #dce9eb;border-radius:16px;background:#fff;box-shadow:0 7px 18px rgba(16,47,56,.06)}.reservation-table tbody tr:hover{background:#fff}.reservation-table td{border:0;padding:5px 0}.reservation-table td::before{display:block;color:#73878c;font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.reservation-table td:nth-child(1)::before{content:'Véhicule'}.reservation-table td:nth-child(2)::before{content:'Période'}.reservation-table td:nth-child(3)::before{content:'Statut'}.reservation-table td:nth-child(4)::before{content:'Observation'}}
  `],
  template: `
    <div class="page-heading"><div><p class="eyebrow">SUIVI</p><h1>Mes réservations</h1><p>Retrouvez toutes vos demandes, y compris les demandes finalisées ou annulées.</p></div></div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    @if (loading()) { <div class="empty-state">Chargement…</div> }
    @else if (!rows().length) { <div class="empty-state">Vous n’avez encore aucune réservation.</div> }
    @else { <div class="table-responsive app-table reservation-table"><table class="table align-middle mb-0"><thead><tr><th>Véhicule</th><th>Période</th><th>Statut</th><th>Observation</th></tr></thead><tbody>@for (reservation of rows(); track reservation.id) { <tr><td><strong>{{ reservation.vehicles?.make }} {{ reservation.vehicles?.model }}</strong><small class="d-block text-muted">{{ reservation.vehicles?.registration_number }}</small></td><td>{{ reservation.planned_departure_date | date:'dd/MM/yyyy' }}<br><small>au {{ reservation.planned_return_date | date:'dd/MM/yyyy' }}</small></td><td><span class="badge text-bg-{{ tone(reservation.status) }}">{{ label(reservation) }}</span>@if(reservation.status === 'pending'){<button class="btn btn-sm btn-outline-danger ms-2" (click)="cancel(reservation)">Annuler</button>}</td><td>{{ reservation.observation || '—' }}</td></tr> }</tbody></table></div> }
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
  async cancel(reservation: any) { const result = await this.auth.supabase().from('reservations').update({ status: 'cancelled' }).eq('id', reservation.id); if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; } this.rows.update(rows => rows.map(row => row.id === reservation.id ? { ...row, status: 'cancelled' } : row)); }
  tone(status: string) { return ({ pending: 'warning', validated: 'info', finalized: 'success', cancelled: 'secondary' } as Record<string, string>)[status] ?? 'secondary'; }
}
