import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { PublicCatalogService } from '../../core/data/public-catalog.service';
import { ScrollRevealDirective } from '../../shared/scroll-reveal.directive';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ScrollRevealDirective],
  styleUrl: './home.component.scss',
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  vehicles = signal<any[]>([]);
  company = signal<any>({});
  depart = '';
  retour = '';
  category = '';
  categoryFilter = '';
  year = new Date().getFullYear();

  constructor(
    private auth: AuthService,
    private router: Router,
    private catalog: PublicCatalogService,
  ) {}

  async ngOnInit() {
    const c = await this.catalog.companyContact();
    if (!c.error && c.data) this.company.set(c.data);
    const v = await this.catalog.availableVehicles();
    if (!v.error) {
      const rows = await Promise.all(
        (v.data ?? []).slice(0, 6).map(async (vehicle: any) => {
          const path = vehicle.photo_storage_paths?.[0];
          if (!path) return { ...vehicle, photoUrl: null };
          return { ...vehicle, photoUrl: await this.catalog.photoUrl(path) };
        }),
      );
      this.vehicles.set(rows);
    }
  }

  visibleVehicles() {
    return this.vehicles().filter(
      (v) =>
        !this.categoryFilter ||
        String(v.category ?? '').toLowerCase() === this.categoryFilter.toLowerCase(),
    );
  }

  money(value: any) {
    return Number(value ?? 0).toLocaleString('fr-FR') + ' FCFA';
  }

  whatsappLink() {
    const number = String(this.company().whatsapp_phone ?? '').replace(/[^\d+]/g, '');
    return number ? 'https://wa.me/' + number.replace(/^\+/, '') : 'https://wa.me/';
  }

  search() {
    const q: Record<string, string> = {};
    if (this.depart) q['depart'] = this.depart;
    if (this.retour) q['retour'] = this.retour;
    if (this.category) q['category'] = this.category;
    this.router.navigate(['/vehicules'], { queryParams: q });
  }
}
