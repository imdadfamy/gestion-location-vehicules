import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './reservation-rental.component.html',
})
export class ReservationRentalComponent implements OnInit {
  reservation = signal<any>(null);
  vehicle = signal<any>(null);
  form = signal<any>({});
  loading = signal(true);
  saving = signal(false);
  error = signal('');
  private reservationId = '';
  private clientId = '';
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
  ) {}
  async ngOnInit() {
    this.reservationId = this.route.snapshot.queryParamMap.get('reservation') ?? '';
    this.clientId = this.route.snapshot.queryParamMap.get('client') ?? '';
    if (!this.reservationId || !this.clientId) {
      this.loading.set(false);
      return;
    }
    const reservation = await this.auth
      .supabase()
      .from('reservations')
      .select('*')
      .eq('id', this.reservationId)
      .in('status', ['pending', 'validated'])
      .maybeSingle();
    if (reservation.error || !reservation.data) {
      this.error.set(
        reservation.error
          ? this.auth.errorMessage(reservation.error)
          : 'Réservation introuvable ou déjà finalisée.',
      );
      this.loading.set(false);
      return;
    }
    const vehicle = await this.auth
      .supabase()
      .from('vehicles')
      .select('id,registration_number,make,model,rental_price,deposit_amount,status')
      .eq('id', reservation.data.vehicle_id)
      .single();
    if (vehicle.error) {
      this.error.set(this.auth.errorMessage(vehicle.error));
      this.loading.set(false);
      return;
    }
    this.reservation.set(reservation.data);
    this.vehicle.set(vehicle.data);
    this.form.set({
      departure_location: '',
      return_location: '',
      rental_price: vehicle.data.rental_price ?? 0,
      deposit_amount: vehicle.data.deposit_amount ?? 0,
      driving_zone: '',
      notes: reservation.data.observation ?? '',
    });
    this.loading.set(false);
  }
  async save() {
    const value = this.form();
    if (Number(value.rental_price) < 0 || Number(value.deposit_amount) < 0) {
      this.error.set('Les montants doivent être positifs ou nuls.');
      return;
    }
    this.saving.set(true);
    const result = await this.auth.supabase().rpc('create_rental_from_reservation', {
      target_reservation_id: this.reservationId,
      target_client_id: this.clientId,
      target_departure_location: value.departure_location || null,
      target_return_location: value.return_location || null,
      target_rental_price: Number(value.rental_price || 0),
      target_deposit_amount: Number(value.deposit_amount || 0),
      target_driving_zone: value.driving_zone || null,
      target_notes: value.notes || null,
    });
    this.saving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    await this.router.navigate(['/rentals']);
  }
  back() {
    void this.router.navigate(['/reservation-client'], {
      queryParams: { reservation: this.reservationId },
    });
  }
}
