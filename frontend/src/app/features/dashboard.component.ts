import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { AuthService } from '../core/auth.service';

Chart.register(...registerables);

@Component({
  standalone: true,
  template: `<div class="page-heading"><div><p class="eyebrow">VUE D'ENSEMBLE</p><h1>Tableau de bord</h1><p>La situation de votre activité, mise à jour depuis Supabase.</p></div></div>@if(error()){<div class="alert alert-danger">{{error()}}</div>}@if(loading()){<div class="empty-state">Chargement des indicateurs…</div>}@else{<div class="row g-3">@for(c of cards();track c.label){<div class="col-sm-6 col-xl-3"><div class="metric-card"><small>{{c.label}}</small><strong>{{c.value}}</strong></div></div>}</div><div class="row g-3 mt-1"><div class="col-lg-6"><div class="card"><div class="card-body"><h2 class="h5">CA mensuel</h2><canvas #monthlyCanvas></canvas></div></div></div><div class="col-lg-6"><div class="card"><div class="card-body"><h2 class="h5">Locations par mois</h2><canvas #rentalsCanvas></canvas></div></div></div><div class="col-lg-6"><div class="card"><div class="card-body"><h2 class="h5">CA par véhicule</h2><canvas #revenueCanvas></canvas></div></div></div><div class="col-lg-6"><div class="card"><div class="card-body"><h2 class="h5">Véhicules les plus loués</h2><canvas #topCanvas></canvas></div></div></div></div>}`
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('monthlyCanvas') monthlyCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('rentalsCanvas') rentalsCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('revenueCanvas') revenueCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('topCanvas') topCanvas?: ElementRef<HTMLCanvasElement>;
  charts: Chart[] = []; loading = signal(true); error = signal(''); cards = signal<any[]>([]);
  monthly: any[] = []; rentalMonths: any[] = []; revenue: any[] = []; top: any[] = []; viewReady = false;
  constructor(private auth: AuthService) {}
  ngOnInit() { this.load(); }
  ngAfterViewInit() { this.viewReady = true; this.renderCharts(); }
  ngOnDestroy() { this.charts.forEach(chart => chart.destroy()); }
  async load() {
    this.loading.set(true); this.error.set('');
    const refresh = await this.auth.supabase().rpc('refresh_overdue_rentals');
    const [vehicles, clients, rentals, contracts, payments, maintenance] = await Promise.all([
      this.auth.supabase().from('vehicles').select('id,status'), this.auth.supabase().from('clients').select('id', { count: 'exact' }),
      this.auth.supabase().from('rentals').select('status,departure_date,return_date,vehicle_id,vehicles(make,model,registration_number)'), this.auth.supabase().from('contracts').select('id').eq('status', 'pending_signature'),
      this.auth.supabase().from('payments').select('amount,payment_date,rental_id,rentals(vehicle_id,vehicles(make,model,registration_number))'), this.auth.supabase().from('vehicle_maintenance').select('id').eq('status', 'in_progress')
    ]);
    this.loading.set(false); const problem = refresh.error ?? vehicles.error ?? clients.error ?? rentals.error ?? contracts.error ?? payments.error ?? maintenance.error;
    if (problem) { this.error.set(this.auth.errorMessage(problem)); return; }
    const vs: any[] = vehicles.data ?? [], rs: any[] = rentals.data ?? [], ps: any[] = payments.data ?? [], now = Date.now(), today = new Date(); today.setHours(0, 0, 0, 0);
    const sum = (from: number) => ps.filter(item => new Date(item.payment_date).getTime() >= from).reduce((total, item) => total + Number(item.amount || 0), 0);
    this.cards.set([{ label: 'Véhicules', value: vs.length }, { label: 'Disponibles', value: vs.filter(item => item.status === 'available').length }, { label: 'En location', value: vs.filter(item => item.status === 'on_rental').length }, { label: 'En maintenance', value: vs.filter(item => item.status === 'maintenance').length }, { label: 'Clients', value: clients.count ?? 0 }, { label: 'Locations en cours', value: rs.filter(item => ['active', 'overdue'].includes(item.status)).length }, { label: 'Locations à venir', value: rs.filter(item => item.status === 'pending' && new Date(item.departure_date).getTime() > now).length }, { label: 'Contrats à signer', value: (contracts.data ?? []).length }, { label: 'CA aujourd’hui', value: `${sum(today.getTime()).toLocaleString('fr-FR')} FCFA` }, { label: 'CA du mois', value: `${sum(new Date(today.getFullYear(), today.getMonth(), 1).getTime()).toLocaleString('fr-FR')} FCFA` }, { label: 'CA de l’année', value: `${sum(new Date(today.getFullYear(), 0, 1).getTime()).toLocaleString('fr-FR')} FCFA` }]);
    const monthly = new Map<string, number>(), rentalMonths = new Map<string, number>(), revenue = new Map<string, number>(), top = new Map<string, number>();
    for (const item of ps) { const date = new Date(item.payment_date), key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; monthly.set(key, (monthly.get(key) ?? 0) + Number(item.amount || 0)); const rental: any = Array.isArray(item.rentals) ? item.rentals[0] : item.rentals, car = rental?.vehicles, name = car ? `${car.make || ''} ${car.model || ''}`.trim() : 'Non affecté'; revenue.set(name, (revenue.get(name) ?? 0) + Number(item.amount || 0)); }
    for (const item of rs) { const date = new Date(item.departure_date), key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; rentalMonths.set(key, (rentalMonths.get(key) ?? 0) + 1); const car: any = Array.isArray(item.vehicles) ? item.vehicles[0] : item.vehicles, name = car ? `${car.make || ''} ${car.model || ''}`.trim() : 'Véhicule'; top.set(name, (top.get(name) ?? 0) + 1); }
    this.monthly = [...monthly].sort(); this.rentalMonths = [...rentalMonths].sort(); this.revenue = [...revenue].sort((a, b) => b[1] - a[1]).slice(0, 8); this.top = [...top].sort((a, b) => b[1] - a[1]).slice(0, 8); queueMicrotask(() => this.renderCharts());
  }
  private chart(element: ElementRef<HTMLCanvasElement> | undefined, label: string, values: any[], color: string) { if (!element) return; this.charts.push(new Chart(element.nativeElement, { type: 'bar', data: { labels: values.map(item => item[0]), datasets: [{ label, data: values.map(item => item[1]), backgroundColor: color, borderRadius: 8 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } })); }
  renderCharts() { if (!this.viewReady || this.loading()) return; this.charts.forEach(chart => chart.destroy()); this.charts = []; this.chart(this.monthlyCanvas, 'FCFA', this.monthly, '#47b7c7'); this.chart(this.rentalsCanvas, 'Locations', this.rentalMonths, '#3859db'); this.chart(this.revenueCanvas, 'FCFA', this.revenue, '#f0ab3d'); this.chart(this.topCanvas, 'Locations', this.top, '#7654cc'); }
}
