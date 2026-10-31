import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { PublicCatalogService } from '../../core/data/public-catalog.service';
import { ScrollRevealDirective } from '../../shared/scroll-reveal.directive';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ScrollRevealDirective],
  styleUrl: './public-vehicles.component.scss',
  templateUrl: './public-vehicles.component.html',
})
export class PublicVehiclesComponent implements OnInit {
  vehicles = signal<any[]>([]);
  loading = signal(false);
  error = signal('');
  product = signal<any>(null);
  activePhoto = signal<string | null>(null);
  departure = '';
  returnDate = '';
  category = '';
  transmission = '';
  sort = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private catalog: PublicCatalogService,
  ) {}

  ngOnInit() {
    const q = this.route.snapshot.queryParamMap;
    this.departure = q.get('depart') ?? '';
    this.returnDate = q.get('retour') ?? '';
    this.category = q.get('category') ?? '';
    void this.load();
  }

  money(value: any) {
    return Number(value ?? 0).toLocaleString('fr-FR') + ' FCFA';
  }

  visibleVehicles() {
    const rows = this.vehicles().filter(
      (v) =>
        (!this.category ||
          String(v.category ?? '').toLowerCase() === this.category.toLowerCase()) &&
        (!this.transmission ||
          String(v.transmission ?? '')
            .toLowerCase()
            .includes(this.transmission)),
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
    const result = await this.catalog.availableVehicles(
      this.departure ? new Date(this.departure).toISOString() : undefined,
      this.returnDate ? new Date(this.returnDate).toISOString() : undefined,
    );
    this.loading.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    const rows = await Promise.all(
      (result.data ?? []).map(async (vehicle: any) => {
        const paths: string[] = vehicle.photo_storage_paths ?? [];
        const urls = await Promise.all(
          paths.map(async (path: string) => {
            return this.catalog.photoUrl(path);
          }),
        );
        const photos = urls.filter(Boolean) as string[];
        return { ...vehicle, photos, photoUrl: photos[0] ?? null };
      }),
    );
    this.vehicles.set(rows);
  }

  openProduct(vehicle: any) {
    this.product.set(vehicle);
    this.activePhoto.set(vehicle.photos?.[0] ?? null);
  }
  closeProduct() {
    this.product.set(null);
    this.activePhoto.set(null);
  }

  async reserve(vehicle: any) {
    if (!this.departure || !this.returnDate) {
      this.error.set('Choisissez d’abord les dates et heures de départ et de retour.');
      return;
    }
    if (new Date(this.returnDate) <= new Date(this.departure)) {
      this.error.set('La date de retour doit être postérieure au départ.');
      return;
    }
    await this.auth.init();
    const target = { vehicle: vehicle.id, depart: this.departure, retour: this.returnDate };
    if (this.auth.profile()?.role === 'client') {
      await this.router.navigate(['/client/vehicles'], { queryParams: target });
      return;
    }
    await this.router.navigate(['/client/login'], { queryParams: target });
  }
}
