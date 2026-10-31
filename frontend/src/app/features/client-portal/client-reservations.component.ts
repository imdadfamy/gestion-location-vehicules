import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [DatePipe],
  styleUrl: './client-reservations.component.scss',
  templateUrl: './client-reservations.component.html',
})
export class ClientReservationsComponent implements OnInit {
  rows = signal<any[]>([]);
  loading = signal(false);
  error = signal('');
  constructor(private auth: AuthService) {}
  async ngOnInit() {
    this.loading.set(true);
    this.error.set('');
    const result = await this.auth.supabase().rpc('client_reservation_history');
    this.loading.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.rows.set((result.data as any[]) ?? []);
  }
  label(reservation: any) {
    if (reservation.status === 'validated' && reservation.rental_id)
      return 'Contrat en attente de signatures';
    if (reservation.status === 'validated' && reservation.client_contract_sent_at)
      return 'Dossier à signer';
    return (
      (
        {
          pending: 'En attente',
          validated: 'Validée',
          finalized: 'Finalisée',
          cancelled: 'Annulée',
        } as Record<string, string>
      )[reservation.status] ?? reservation.status
    );
  }
  async cancel(reservation: any) {
    const result = await this.auth
      .supabase()
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservation.id);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.rows.update((rows) =>
      rows.map((row) => (row.id === reservation.id ? { ...row, status: 'cancelled' } : row)),
    );
  }
  tone(status: string) {
    return (
      (
        {
          pending: 'warning',
          validated: 'info',
          finalized: 'success',
          cancelled: 'secondary',
        } as Record<string, string>
      )[status] ?? 'secondary'
    );
  }
}
