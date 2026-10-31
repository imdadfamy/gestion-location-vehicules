import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  styleUrl: './client-portal.component.scss',
  templateUrl: './client-portal.component.html',
})
export class ClientPortalComponent implements OnInit {
  vehicles = signal<any[]>([]);
  product = signal<any>(null);
  activePhoto = signal<string | null>(null);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  message = signal('');
  departure = '';
  returnDate = '';
  observation = '';
  category = '';
  transmission = '';
  fuel = '';
  sort = '';
  private pendingVehicleId: string | null = null;
  constructor(
    private auth: AuthService,
    private route: ActivatedRoute,
  ) {}
  ngOnInit() {
    const q = this.route.snapshot.queryParamMap;
    this.departure = q.get('depart') ?? '';
    this.returnDate = q.get('retour') ?? '';
    this.pendingVehicleId = q.get('vehicle');
    void this.load();
  }
  money(value: any) {
    return (
      Number(value ?? 0)
        .toLocaleString('fr-FR')
        .replace(/\\u202f/g, ' ') + ' FCFA'
    );
  }
  bookingDays() {
    const start = new Date(this.departure).getTime(),
      end = new Date(this.returnDate).getTime();
    return Math.max(1, Math.ceil((end - start) / 86400000));
  }
  bookingTotal() {
    return this.bookingDays() * Number(this.product()?.rental_price ?? 0);
  }
  visibleVehicles() {
    const rows = this.vehicles().filter(
      (v) =>
        (!this.category ||
          String(v.category ?? '').toLowerCase() === this.category.toLowerCase()) &&
        (!this.transmission ||
          String(v.transmission ?? '')
            .toLowerCase()
            .includes(this.transmission)) &&
        (!this.fuel ||
          String(v.fuel_type ?? '')
            .toLowerCase()
            .includes(this.fuel)),
    );
    return this.sort
      ? rows.sort(
          (a, b) =>
            (Number(a.rental_price) - Number(b.rental_price)) * (this.sort === 'asc' ? 1 : -1),
        )
      : rows;
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    const result = await this.auth.supabase().rpc('client_available_vehicles', {
      target_departure: this.departure ? new Date(this.departure).toISOString() : undefined,
      target_return: this.returnDate ? new Date(this.returnDate).toISOString() : undefined,
    });
    this.loading.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    let failedPhotos = 0;
    const rows = await Promise.all(
      (result.data ?? []).map(async (vehicle: any) => {
        const paths: string[] =
          vehicle.photo_storage_paths ??
          (vehicle.photo_storage_path ? [vehicle.photo_storage_path] : []);
        const urls = await Promise.all(
          paths.map(async (path) => {
            const storage = this.auth.supabase().storage.from('rental-documents');
            const signed = await storage.createSignedUrl(path, 600);
            if (signed.data?.signedUrl) return signed.data.signedUrl;
            const file = await storage.download(path);
            if (file.data) return URL.createObjectURL(file.data);
            failedPhotos++;
            return null;
          }),
        );
        return { ...vehicle, photos: urls.filter(Boolean) };
      }),
    );
    this.vehicles.set(rows);
    if (failedPhotos)
      this.error.set(
        'Certaines photos du véhicule ne peuvent pas être chargées. Vérifiez que les fichiers ont bien été ajoutés dans « Photos du véhicule ».',
      );
    if (this.pendingVehicleId) {
      const match = rows.find((v) => v.id === this.pendingVehicleId);
      this.pendingVehicleId = null;
      if (match) this.openProduct(match);
    }
  }
  openProduct(vehicle: any) {
    this.error.set('');
    this.observation = '';
    this.product.set(vehicle);
    this.activePhoto.set(vehicle.photos?.[0] ?? null);
  }
  closeProduct() {
    this.product.set(null);
    this.activePhoto.set(null);
  }
  async submitReservation() {
    const vehicle = this.product();
    if (!vehicle) return;
    this.error.set('');
    this.message.set('');
    if (!this.departure || !this.returnDate) {
      this.error.set('Choisissez d’abord les dates et heures de départ et de retour.');
      return;
    }
    if (new Date(this.returnDate) <= new Date(this.departure)) {
      this.error.set('La date de retour doit être postérieure au départ.');
      return;
    }
    this.saving.set(true);
    const result = await this.auth.supabase().rpc('client_create_reservation', {
      target_vehicle_id: vehicle.id,
      target_departure: new Date(this.departure).toISOString(),
      target_return: new Date(this.returnDate).toISOString(),
      target_observation: this.observation || undefined,
    });
    this.saving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.closeProduct();
    this.observation = '';
    this.message.set(
      'Votre réservation a été envoyée. Vous pouvez la suivre dans « Mes réservations ».',
    );
    await this.load();
  }
}
