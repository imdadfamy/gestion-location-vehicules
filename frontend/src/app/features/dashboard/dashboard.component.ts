import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { AuthService } from '../../core/auth.service';

Chart.register(...registerables);

@Component({
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('monthlyCanvas') monthlyCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('rentalsCanvas') rentalsCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('revenueCanvas') revenueCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('topCanvas') topCanvas?: ElementRef<HTMLCanvasElement>;
  charts: Chart[] = [];
  loading = signal(true);
  error = signal('');
  cards = signal<any[]>([]);
  priorities = signal<any[]>([]);
  monthly: any[] = [];
  rentalMonths: any[] = [];
  revenue: any[] = [];
  top: any[] = [];
  viewReady = false;
  themeObserver?: MutationObserver;
  constructor(public auth: AuthService) {}
  greeting() {
    const profile = this.auth.profile() ?? {};
    const fromFields = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
    const legacy = String(profile.full_name ?? '');
    const name =
      fromFields ||
      (legacy && !legacy.includes('@') ? legacy : String(profile.email ?? '').split('@')[0]) ||
      'Utilisateur';
    return profile.role === 'super_admin' ? `Bonjour Admin, ${name}` : `Bonjour, ${name}`;
  }
  ngOnInit() {
    this.load();
  }
  ngAfterViewInit() {
    this.viewReady = true;
    this.themeObserver = new MutationObserver(() => this.renderCharts());
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    this.renderCharts();
  }
  ngOnDestroy() {
    this.charts.forEach((chart) => chart.destroy());
    this.themeObserver?.disconnect();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    const refresh = await this.auth.supabase().rpc('refresh_overdue_rentals');
    const [vehicles, clients, rentals, contracts, payments, maintenance] = await Promise.all([
      this.auth.supabase().from('vehicles').select('id,status'),
      this.auth.supabase().from('clients').select('id', { count: 'exact' }),
      this.auth
        .supabase()
        .from('rentals')
        .select(
          'id,status,departure_date,return_date,vehicle_id,vehicles(make,model,registration_number)',
        ),
      this.auth.supabase().from('contracts').select('id').eq('status', 'pending_signature'),
      this.auth
        .supabase()
        .from('payments')
        .select(
          'amount,payment_date,rental_id,rentals(vehicle_id,vehicles(make,model,registration_number))',
        ),
      this.auth.supabase().from('vehicle_maintenance').select('id').eq('status', 'in_progress'),
    ]);
    this.loading.set(false);
    const problem =
      refresh.error ??
      vehicles.error ??
      clients.error ??
      rentals.error ??
      contracts.error ??
      payments.error ??
      maintenance.error;
    if (problem) {
      this.error.set(this.auth.errorMessage(problem));
      return;
    }
    const vs: any[] = vehicles.data ?? [],
      rs: any[] = rentals.data ?? [],
      ps: any[] = payments.data ?? [],
      today = new Date(),
      now = Date.now();
    today.setHours(0, 0, 0, 0);
    const sum = (from: number) =>
      ps
        .filter((item) => new Date(item.payment_date).getTime() >= from)
        .reduce((total, item) => total + Number(item.amount || 0), 0);
    this.cards.set([
      { label: 'Véhicules', value: vs.length, detail: 'Parc enregistré', icon: '◇', tone: 'teal' },
      {
        label: 'Disponibles',
        value: vs.filter((item) => item.status === 'available').length,
        detail: 'Prêts à louer',
        icon: '✓',
        tone: 'teal',
      },
      {
        label: 'En location',
        value: vs.filter((item) => item.status === 'on_rental').length,
        detail: 'Actuellement sortis',
        icon: '◷',
        tone: 'blue',
      },
      {
        label: 'Maintenance',
        value: vs.filter((item) => item.status === 'maintenance').length,
        detail: 'Indisponibles',
        icon: '✦',
        tone: 'gold',
      },
      {
        label: 'Clients',
        value: clients.count ?? 0,
        detail: 'Fiches actives',
        icon: '♙',
        tone: 'violet',
      },
      {
        label: 'Locations en cours',
        value: rs.filter((item) => ['active', 'overdue'].includes(item.status)).length,
        detail: 'En cours ou en retard',
        icon: '▣',
        tone: 'blue',
      },
      {
        label: 'Locations à venir',
        value: rs.filter(
          (item) => item.status === 'pending' && new Date(item.departure_date).getTime() > now,
        ).length,
        detail: 'À préparer',
        icon: '↗',
        tone: 'violet',
      },
      {
        label: 'Contrats à signer',
        value: (contracts.data ?? []).length,
        detail: 'En attente de signature',
        icon: '▤',
        tone: 'gold',
      },
      {
        label: 'CA aujourd’hui',
        value: `${sum(today.getTime())
          .toLocaleString('fr-FR')
          .replace(/\\u202f/g, ' ')} FCFA`,
        detail: 'Encaissements du jour',
        icon: '₣',
        tone: 'teal',
      },
      {
        label: 'CA du mois',
        value: `${sum(new Date(today.getFullYear(), today.getMonth(), 1).getTime())
          .toLocaleString('fr-FR')
          .replace(/\\u202f/g, ' ')} FCFA`,
        detail: 'Depuis le 1er',
        icon: '₣',
        tone: 'teal',
      },
      {
        label: 'CA de l’année',
        value: `${sum(new Date(today.getFullYear(), 0, 1).getTime())
          .toLocaleString('fr-FR')
          .replace(/\\u202f/g, ' ')} FCFA`,
        detail: 'Encaissements annuels',
        icon: '₣',
        tone: 'teal',
      },
    ]);
    this.priorities.set(
      [
        {
          label: 'Contrats à signer',
          count: (contracts.data ?? []).length,
          detail: 'À faire signer pour démarrer les locations',
          path: '/contracts',
          tone: 'gold',
        },
        {
          label: 'Locations en retard',
          count: rs.filter((item) => item.status === 'overdue').length,
          detail: 'Retour véhicule à suivre',
          path: '/rentals',
          tone: 'red',
        },
        {
          label: 'Locations à préparer',
          count: rs.filter((item) => item.status === 'pending').length,
          detail: 'En attente des prérequis de départ',
          path: '/rentals',
          tone: 'teal',
        },
        {
          label: 'Maintenances en cours',
          count: (maintenance.data ?? []).length,
          detail: 'Véhicules indisponibles',
          path: '/maintenance',
          tone: 'gold',
        },
      ].filter((item) => item.count > 0),
    );
    const monthly = new Map<string, number>(),
      rentalMonths = new Map<string, number>(),
      revenue = new Map<string, number>(),
      top = new Map<string, number>();
    for (const item of ps) {
      const date = new Date(item.payment_date),
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthly.set(key, (monthly.get(key) ?? 0) + Number(item.amount || 0));
      const rental: any = Array.isArray(item.rentals) ? item.rentals[0] : item.rentals,
        car = rental?.vehicles,
        name = car ? `${car.make || ''} ${car.model || ''}`.trim() : 'Non affecté';
      revenue.set(name, (revenue.get(name) ?? 0) + Number(item.amount || 0));
    }
    for (const item of rs) {
      const date = new Date(item.departure_date),
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      rentalMonths.set(key, (rentalMonths.get(key) ?? 0) + 1);
      const car: any = Array.isArray(item.vehicles) ? item.vehicles[0] : item.vehicles,
        name = car ? `${car.make || ''} ${car.model || ''}`.trim() : 'Véhicule';
      top.set(name, (top.get(name) ?? 0) + 1);
    }
    this.monthly = [...monthly].sort();
    this.rentalMonths = [...rentalMonths].sort();
    this.revenue = [...revenue].sort((a, b) => b[1] - a[1]).slice(0, 8);
    this.top = [...top].sort((a, b) => b[1] - a[1]).slice(0, 8);
    queueMicrotask(() => this.renderCharts());
  }
  private chart(
    element: ElementRef<HTMLCanvasElement> | undefined,
    label: string,
    values: any[],
    color: string,
  ) {
    if (!element) return;
    const css = getComputedStyle(document.documentElement),
      text = css.getPropertyValue('--app-text').trim() || '#102d36',
      border = css.getPropertyValue('--app-border').trim() || '#dce7e9';
    this.charts.push(
      new Chart(element.nativeElement, {
        type: 'bar',
        data: {
          labels: values.map((item) => item[0]),
          datasets: [
            {
              label,
              data: values.map((item) => item[1]),
              backgroundColor: color,
              borderRadius: 8,
              maxBarThickness: 38,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { displayColors: false } },
          scales: {
            x: {
              ticks: { color: text, font: { size: 11 } },
              grid: { display: false },
              border: { color: border },
            },
            y: {
              beginAtZero: true,
              ticks: { color: text, font: { size: 11 } },
              grid: { color: border },
              border: { display: false },
            },
          },
        },
      }),
    );
  }
  renderCharts() {
    if (!this.viewReady || this.loading()) return;
    this.charts.forEach((chart) => chart.destroy());
    this.charts = [];
    this.chart(this.monthlyCanvas, 'FCFA', this.monthly, '#47b7c7');
    this.chart(this.rentalsCanvas, 'Locations', this.rentalMonths, '#3859db');
    this.chart(this.revenueCanvas, 'FCFA', this.revenue, '#f0ab3d');
    this.chart(this.topCanvas, 'Locations', this.top, '#7654cc');
  }
}
