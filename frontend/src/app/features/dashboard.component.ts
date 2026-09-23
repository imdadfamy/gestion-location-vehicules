import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { AuthService } from '../core/auth.service';

Chart.register(...registerables);

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `<div class="dashboard-hero"><div><p class="eyebrow">PILOTAGE DE L’ACTIVITÉ</p><h1>{{greeting()}}</h1><p>Une lecture claire de votre parc, des locations et des encaissements.</p></div><div class="hero-date"><span>MISE À JOUR</span><strong>Aujourd’hui</strong></div></div>@if(error()){<div class="alert alert-danger">{{error()}}</div>}@if(loading()){<div class="empty-state">Chargement des indicateurs…</div>}@else{<div class="metrics-grid">@for(c of cards();track c.label){<article class="dashboard-metric" [class]="'dashboard-metric '+c.tone"><div class="metric-icon">{{c.icon}}</div><div><small>{{c.label}}</small><strong>{{c.value}}</strong><span>{{c.detail}}</span></div></article>}</div><section class="priority-section"><div class="section-title"><div><p class="eyebrow">À SUIVRE</p><h2>Priorités opérationnelles</h2></div><a routerLink="/notifications">Voir les alertes →</a></div><div class="priority-grid">@for(item of priorities();track item.label){<a class="priority-card" [routerLink]="item.path"><span class="priority-dot" [class]="'priority-dot '+item.tone"></span><div><strong>{{item.label}}</strong><small>{{item.detail}}</small></div><b>{{item.count}}</b><i>›</i></a>}@empty{<div class="priority-empty">Aucune alerte prioritaire : votre activité est à jour.</div>}</div></section><section class="charts-section"><div class="section-title"><div><p class="eyebrow">TENDANCES</p><h2>Vue analytique</h2></div><span>Basée sur les encaissements enregistrés</span></div><div class="row g-3"><div class="col-lg-6"><div class="chart-card"><div class="chart-heading"><div><h3>Chiffre d’affaires mensuel</h3><p>Encaissements physiques</p></div><span class="chart-badge teal">FCFA</span></div><canvas #monthlyCanvas></canvas></div></div><div class="col-lg-6"><div class="chart-card"><div class="chart-heading"><div><h3>Locations par mois</h3><p>Activité de location</p></div><span class="chart-badge blue">Volume</span></div><canvas #rentalsCanvas></canvas></div></div><div class="col-lg-6"><div class="chart-card"><div class="chart-heading"><div><h3>CA par véhicule</h3><p>Recettes par véhicule</p></div><span class="chart-badge gold">FCFA</span></div><canvas #revenueCanvas></canvas></div></div><div class="col-lg-6"><div class="chart-card"><div class="chart-heading"><div><h3>Véhicules les plus loués</h3><p>Classement du parc</p></div><span class="chart-badge violet">Top</span></div><canvas #topCanvas></canvas></div></div></div></section>}`,
  styles: [`.dashboard-hero{display:flex;justify-content:space-between;gap:1.5rem;align-items:flex-end;padding:1.8rem 2rem;margin-bottom:1.3rem;border-radius:22px;background:linear-gradient(122deg,#0b3440,#106879);color:#fff;box-shadow:0 18px 38px rgba(5,67,79,.2);overflow:hidden;position:relative}.dashboard-hero:after{content:'';position:absolute;width:260px;height:260px;right:-80px;top:-130px;border-radius:50%;border:34px solid rgba(96,218,224,.11)}.dashboard-hero h1{position:relative;z-index:1;margin:0;font-size:clamp(1.55rem,3vw,2.35rem);font-weight:800;letter-spacing:-.045em}.dashboard-hero p:not(.eyebrow){position:relative;z-index:1;margin:.45rem 0 0;color:#c6e1e4}.dashboard-hero .eyebrow{position:relative;z-index:1;color:#7ce1e6!important}.hero-date{position:relative;z-index:1;min-width:125px;padding:13px 15px;border:1px solid rgba(255,255,255,.2);border-radius:15px;background:rgba(255,255,255,.1);backdrop-filter:blur(8px)}.hero-date span,.hero-date strong{display:block}.hero-date span{font-size:.62rem;letter-spacing:.13em;color:#a9d9dc;font-weight:800}.hero-date strong{margin-top:3px;font-size:.95rem}.metrics-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.dashboard-metric{display:flex;gap:12px;align-items:center;min-width:0;padding:16px;border:1px solid var(--app-border);border-radius:18px;background:var(--app-surface);box-shadow:var(--app-shadow);transition:transform .2s ease,box-shadow .2s ease}.dashboard-metric:hover{transform:translateY(-3px);box-shadow:0 18px 38px rgba(6,43,53,.12)}.metric-icon{display:grid;place-items:center;flex:0 0 39px;width:39px;height:39px;border-radius:13px;font-size:1.1rem}.dashboard-metric small,.dashboard-metric span,.priority-card small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dashboard-metric small{color:var(--app-muted);font-size:.7rem;font-weight:750;letter-spacing:.035em}.dashboard-metric strong{display:block;margin:.15rem 0;font-size:1.12rem;line-height:1.15;color:var(--app-text)}.dashboard-metric span{max-width:150px;color:var(--app-muted);font-size:.68rem}.teal .metric-icon{background:#d9f4f4;color:#087f8a}.blue .metric-icon{background:#e4e9ff;color:#3659d8}.gold .metric-icon{background:#fff0cf;color:#b37100}.violet .metric-icon{background:#eee7ff;color:#7150b9}.red .metric-icon{background:#ffeaec;color:#c44957}.priority-section,.charts-section{margin-top:1.45rem;padding:1.35rem;border:1px solid var(--app-border);border-radius:20px;background:var(--app-surface);box-shadow:var(--app-shadow)}.section-title{display:flex;justify-content:space-between;align-items:end;gap:1rem;margin-bottom:1rem}.section-title h2{margin:0;color:var(--app-text);font-size:1.05rem;font-weight:800}.section-title .eyebrow{margin-bottom:.18rem!important}.section-title>a{color:var(--app-accent);text-decoration:none;font-size:.78rem;font-weight:800}.section-title>span{color:var(--app-muted);font-size:.75rem}.priority-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.priority-card{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--app-border);border-radius:14px;color:var(--app-text);text-decoration:none;background:var(--app-surface-soft);transition:.2s ease}.priority-card:hover{border-color:var(--app-accent);transform:translateY(-1px)}.priority-dot{width:9px;height:9px;border-radius:50%;flex:0 0 9px}.priority-dot.teal{background:#13a7ae}.priority-dot.gold{background:#e5a32c}.priority-dot.red{background:#d24b54}.priority-card div{min-width:0;flex:1}.priority-card strong{display:block;font-size:.8rem}.priority-card small{margin-top:2px;color:var(--app-muted);font-size:.7rem}.priority-card>b{display:grid;place-items:center;min-width:24px;height:24px;padding:0 6px;border-radius:50%;background:var(--app-accent-soft);color:var(--app-accent);font-size:.72rem}.priority-card i{font-size:1.25rem;font-style:normal;color:var(--app-muted)}.priority-empty{padding:1rem;border-radius:12px;background:var(--app-surface-soft);color:var(--app-muted);font-size:.85rem}.charts-section{margin-bottom:1rem}.chart-card{height:100%;min-height:310px;padding:1.2rem;border:1px solid var(--app-border);border-radius:16px;background:var(--app-surface-soft)}.chart-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;margin-bottom:.8rem}.chart-heading h3{margin:0;color:var(--app-text);font-size:.92rem;font-weight:800}.chart-heading p{margin:.18rem 0 0;color:var(--app-muted);font-size:.72rem}.chart-badge{padding:4px 8px;border-radius:999px;font-size:.62rem;font-weight:800}.chart-badge.teal{background:#d9f4f4;color:#087f8a}.chart-badge.blue{background:#e4e9ff;color:#3659d8}.chart-badge.gold{background:#fff0cf;color:#b37100}.chart-badge.violet{background:#eee7ff;color:#7150b9}.chart-card canvas{max-height:235px}@media(max-width:1200px){.metrics-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:768px){.dashboard-hero{padding:1.35rem;display:block}.hero-date{display:inline-block;margin-top:1rem}.metrics-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.priority-grid{grid-template-columns:1fr}.priority-section,.charts-section{padding:1rem}.section-title{align-items:start}.section-title>span{display:none}.chart-card{min-height:280px;padding:1rem}}@media(max-width:420px){.metrics-grid{grid-template-columns:1fr}.dashboard-metric strong{font-size:1.22rem}}`]
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('monthlyCanvas') monthlyCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('rentalsCanvas') rentalsCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('revenueCanvas') revenueCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('topCanvas') topCanvas?: ElementRef<HTMLCanvasElement>;
  charts: Chart[] = []; loading = signal(true); error = signal(''); cards = signal<any[]>([]); priorities = signal<any[]>([]);
  monthly: any[] = []; rentalMonths: any[] = []; revenue: any[] = []; top: any[] = []; viewReady = false; themeObserver?: MutationObserver;
  constructor(public auth: AuthService) {}
  greeting() { const profile = this.auth.profile() ?? {}; const fromFields = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim(); const legacy = String(profile.full_name ?? ''); const name = fromFields || (legacy && !legacy.includes('@') ? legacy : String(profile.email ?? '').split('@')[0]) || 'Utilisateur'; return profile.role === 'super_admin' ? `Bonjour Admin, ${name}` : `Bonjour, ${name}`; }
  ngOnInit() { this.load(); }
  ngAfterViewInit() { this.viewReady = true; this.themeObserver = new MutationObserver(() => this.renderCharts()); this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); this.renderCharts(); }
  ngOnDestroy() { this.charts.forEach(chart => chart.destroy()); this.themeObserver?.disconnect(); }
  async load() {
    this.loading.set(true); this.error.set('');
    const refresh = await this.auth.supabase().rpc('refresh_overdue_rentals');
    const [vehicles, clients, rentals, contracts, payments, maintenance] = await Promise.all([
      this.auth.supabase().from('vehicles').select('id,status'), this.auth.supabase().from('clients').select('id', { count: 'exact' }),
      this.auth.supabase().from('rentals').select('id,status,departure_date,return_date,vehicle_id,vehicles(make,model,registration_number)'),
      this.auth.supabase().from('contracts').select('id').eq('status', 'pending_signature'),
      this.auth.supabase().from('payments').select('amount,payment_date,rental_id,rentals(vehicle_id,vehicles(make,model,registration_number))'),
      this.auth.supabase().from('vehicle_maintenance').select('id').eq('status', 'in_progress')
    ]);
    this.loading.set(false);
    const problem = refresh.error ?? vehicles.error ?? clients.error ?? rentals.error ?? contracts.error ?? payments.error ?? maintenance.error;
    if (problem) { this.error.set(this.auth.errorMessage(problem)); return; }
    const vs: any[] = vehicles.data ?? [], rs: any[] = rentals.data ?? [], ps: any[] = payments.data ?? [], today = new Date(), now = Date.now();
    today.setHours(0, 0, 0, 0);
    const sum = (from: number) => ps.filter(item => new Date(item.payment_date).getTime() >= from).reduce((total, item) => total + Number(item.amount || 0), 0);
    this.cards.set([
      { label: 'Véhicules', value: vs.length, detail: 'Parc enregistré', icon: '◇', tone: 'teal' },
      { label: 'Disponibles', value: vs.filter(item => item.status === 'available').length, detail: 'Prêts à louer', icon: '✓', tone: 'teal' },
      { label: 'En location', value: vs.filter(item => item.status === 'on_rental').length, detail: 'Actuellement sortis', icon: '◷', tone: 'blue' },
      { label: 'Maintenance', value: vs.filter(item => item.status === 'maintenance').length, detail: 'Indisponibles', icon: '✦', tone: 'gold' },
      { label: 'Clients', value: clients.count ?? 0, detail: 'Fiches actives', icon: '♙', tone: 'violet' },
      { label: 'Locations en cours', value: rs.filter(item => ['active', 'overdue'].includes(item.status)).length, detail: 'En cours ou en retard', icon: '▣', tone: 'blue' },
      { label: 'Locations à venir', value: rs.filter(item => item.status === 'pending' && new Date(item.departure_date).getTime() > now).length, detail: 'À préparer', icon: '↗', tone: 'violet' },
      { label: 'Contrats à signer', value: (contracts.data ?? []).length, detail: 'En attente de signature', icon: '▤', tone: 'gold' },
      { label: 'CA aujourd’hui', value: `${sum(today.getTime()).toLocaleString('fr-FR')} FCFA`, detail: 'Encaissements du jour', icon: '₣', tone: 'teal' },
      { label: 'CA du mois', value: `${sum(new Date(today.getFullYear(), today.getMonth(), 1).getTime()).toLocaleString('fr-FR')} FCFA`, detail: 'Depuis le 1er', icon: '₣', tone: 'teal' },
      { label: 'CA de l’année', value: `${sum(new Date(today.getFullYear(), 0, 1).getTime()).toLocaleString('fr-FR')} FCFA`, detail: 'Encaissements annuels', icon: '₣', tone: 'teal' }
    ]);
    this.priorities.set([
      { label: 'Contrats à signer', count: (contracts.data ?? []).length, detail: 'À faire signer pour démarrer les locations', path: '/contracts', tone: 'gold' },
      { label: 'Locations en retard', count: rs.filter(item => item.status === 'overdue').length, detail: 'Retour véhicule à suivre', path: '/rentals', tone: 'red' },
      { label: 'Locations à préparer', count: rs.filter(item => item.status === 'pending').length, detail: 'En attente des prérequis de départ', path: '/rentals', tone: 'teal' },
      { label: 'Maintenances en cours', count: (maintenance.data ?? []).length, detail: 'Véhicules indisponibles', path: '/maintenance', tone: 'gold' }
    ].filter(item => item.count > 0));
    const monthly = new Map<string, number>(), rentalMonths = new Map<string, number>(), revenue = new Map<string, number>(), top = new Map<string, number>();
    for (const item of ps) {
      const date = new Date(item.payment_date), key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthly.set(key, (monthly.get(key) ?? 0) + Number(item.amount || 0));
      const rental: any = Array.isArray(item.rentals) ? item.rentals[0] : item.rentals, car = rental?.vehicles, name = car ? `${car.make || ''} ${car.model || ''}`.trim() : 'Non affecté';
      revenue.set(name, (revenue.get(name) ?? 0) + Number(item.amount || 0));
    }
    for (const item of rs) {
      const date = new Date(item.departure_date), key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      rentalMonths.set(key, (rentalMonths.get(key) ?? 0) + 1);
      const car: any = Array.isArray(item.vehicles) ? item.vehicles[0] : item.vehicles, name = car ? `${car.make || ''} ${car.model || ''}`.trim() : 'Véhicule';
      top.set(name, (top.get(name) ?? 0) + 1);
    }
    this.monthly = [...monthly].sort(); this.rentalMonths = [...rentalMonths].sort(); this.revenue = [...revenue].sort((a, b) => b[1] - a[1]).slice(0, 8); this.top = [...top].sort((a, b) => b[1] - a[1]).slice(0, 8);
    queueMicrotask(() => this.renderCharts());
  }
  private chart(element: ElementRef<HTMLCanvasElement> | undefined, label: string, values: any[], color: string) {
    if (!element) return;
    const css = getComputedStyle(document.documentElement), text = css.getPropertyValue('--app-text').trim() || '#102d36', border = css.getPropertyValue('--app-border').trim() || '#dce7e9';
    this.charts.push(new Chart(element.nativeElement, { type: 'bar', data: { labels: values.map(item => item[0]), datasets: [{ label, data: values.map(item => item[1]), backgroundColor: color, borderRadius: 8, maxBarThickness: 38 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { displayColors: false } }, scales: { x: { ticks: { color: text, font: { size: 11 } }, grid: { display: false }, border: { color: border } }, y: { beginAtZero: true, ticks: { color: text, font: { size: 11 } }, grid: { color: border }, border: { display: false } } } } }));
  }
  renderCharts() { if (!this.viewReady || this.loading()) return; this.charts.forEach(chart => chart.destroy()); this.charts = []; this.chart(this.monthlyCanvas, 'FCFA', this.monthly, '#47b7c7'); this.chart(this.rentalsCanvas, 'Locations', this.rentalMonths, '#3859db'); this.chart(this.revenueCanvas, 'FCFA', this.revenue, '#f0ab3d'); this.chart(this.topCanvas, 'Locations', this.top, '#7654cc'); }
}





