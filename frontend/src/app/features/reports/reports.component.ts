import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { AdministrationService } from '../../core/data/administration.service';
@Component({ standalone: true, imports: [FormsModule], templateUrl: './reports.component.html' })
export class ReportsComponent implements OnInit {
  from = '';
  to = '';
  error = signal('');
  loading = signal(false);
  stats = signal<any[]>([]);
  revenueByVehicle = signal<any[]>([]);
  topVehicles = signal<any[]>([]);
  constructor(
    private auth: AuthService,
    private admin: AdministrationService,
  ) {}
  ngOnInit() {
    const now = new Date();
    this.from = `${now.getFullYear()}-01-01`;
    this.to = this.localDay(now);
    this.load();
  }
  /** Jour local AAAA-MM-JJ : les bornes de période s'appliquent au jour entier. */
  private localDay(value: Date) {
    const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }
  private between(date: string | undefined) {
    if (!date) return false;
    // Une date seule (AAAA-MM-JJ) est déjà un jour ; un horodatage est ramené au jour local.
    const day = date.length <= 10 ? date : this.localDay(new Date(date));
    return (!this.from || day >= this.from) && (!this.to || day <= this.to);
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    const [p, r, i, m] = await this.admin.reportSources();
    this.loading.set(false);
    const e = p.error ?? r.error ?? i.error ?? m.error;
    if (e) {
      this.error.set(this.auth.errorMessage(e));
      return;
    }
    const payments = (p.data ?? []).filter((x: any) => this.between(x.payment_date)),
      rentals = (r.data ?? []).filter((x: any) => this.between(x.departure_date)),
      incidents = (i.data ?? []).filter((x: any) => this.between(x.incident_date)),
      maintenance = (m.data ?? []).filter((x: any) => this.between(x.maintenance_date));
    const revenue = payments.reduce((s: number, x: any) => s + Number(x.amount || 0), 0),
      costs = maintenance.reduce((s: number, x: any) => s + Number(x.cost || 0), 0);
    this.stats.set([
      {
        label: 'Revenus encaissés',
        value: revenue.toLocaleString('fr-FR').replace(/\\u202f/g, ' ') + ' FCFA',
      },
      { label: 'Locations', value: rentals.length },
      { label: 'Clients actifs', value: new Set(rentals.map((x: any) => x.client_id)).size },
      { label: 'Incidents', value: incidents.length },
      {
        label: 'Coûts maintenance',
        value: costs.toLocaleString('fr-FR').replace(/\\u202f/g, ' ') + ' FCFA',
      },
    ]);
    const rev = new Map<string, number>();
    for (const x of payments) {
      const rental: any = Array.isArray(x.rentals) ? x.rentals[0] : x.rentals,
        car = rental?.vehicles;
      const name = car
        ? `${car.make || ''} ${car.model || ''} · ${car.registration_number || ''}`.trim()
        : 'Location non liée';
      rev.set(name, (rev.get(name) || 0) + Number(x.amount || 0));
    }
    this.revenueByVehicle.set(
      [...rev]
        .sort((a, b) => b[1] - a[1])
        .map(([name, amount]) => ({
          name,
          amount: amount.toLocaleString('fr-FR').replace(/\\u202f/g, ' ') + ' FCFA',
        })),
    );
    const top = new Map<string, number>();
    for (const x of rentals) {
      const car: any = Array.isArray(x.vehicles) ? x.vehicles[0] : x.vehicles,
        name = car
          ? `${car.make || ''} ${car.model || ''} · ${car.registration_number || ''}`.trim()
          : 'Véhicule';
      top.set(name, (top.get(name) || 0) + 1);
    }
    this.topVehicles.set(
      [...top].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
    );
  }
  csv() {
    const text = ['Indicateur;Valeur', ...this.stats().map((x) => `${x.label};${x.value}`)].join(
        '\n',
      ),
      link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    link.download = 'rapport-location.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
