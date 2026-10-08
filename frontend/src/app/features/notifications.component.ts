import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [DatePipe, FormsModule],
  styles: [`
    .section-label{display:block;margin:0 0 6px;font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--app-muted,#6a7f85)}
    .section-hint{color:var(--app-muted,#8198a0);font-size:.84rem;margin:0 0 14px}
    .notif-card{border:1px solid var(--app-border,#e1eaec)}
    .notif-card.unread{border-left:3px solid var(--app-accent,#0792a4)}
    .unread-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--app-accent,#0792a4);margin-right:8px;flex:0 0 auto}
  `],
  template: `
<div class="d-flex justify-content-between align-items-center mb-3"><div><h1 class="h3 mb-0">Notifications</h1><small class="text-muted">Alertes opérationnelles et notifications internes</small></div><button class="btn btn-outline-primary" (click)="load()">Actualiser</button></div>
@if(error()){<div class="alert alert-danger">{{error()}}</div>}
@if(loading()){<p>Chargement…</p>}
@else{
  <section class="mb-4">
    <span class="section-label">Alertes opérationnelles</span>
    <p class="section-hint">Calculées en direct à partir de l'état actuel (contrats, retours, échéances…) — rien à marquer ici, elles disparaissent d'elles-mêmes une fois la situation résolue.</p>
    @if(!alerts().length){<p class="text-muted">Aucune alerte en cours.</p>}
    @else{<div class="row g-3">@for(a of alerts();track a.key){<div class="col-md-6"><div class="alert alert-warning h-100 mb-0"><strong>{{a.title}}</strong><div>{{a.message}}</div></div></div>}</div>}
  </section>

  <section>
    <span class="section-label">Notifications</span>
    <p class="section-hint">Ouvrir cette page marque automatiquement toutes les notifications comme vues.</p>
    <select class="form-select w-auto mb-3" [(ngModel)]="filter"><option value="">Toutes</option><option value="unread">Nouvelles (depuis la dernière visite)</option><option value="read">Déjà vues</option></select>
    @if(!visible().length){<p class="text-muted">Aucune notification.</p>}
    @else{<div class="row g-3">@for(n of visible();track n.id){<div class="col-12"><div class="card notif-card" [class.unread]="n.wasUnread"><div class="card-body d-flex align-items-start gap-2"><span class="unread-dot" [style.visibility]="n.wasUnread?'visible':'hidden'"></span><div><strong>{{n.title}}</strong><div>{{n.message}}</div><small class="text-muted">{{n.created_at|date:'short'}}</small></div></div></div></div>}</div>}
  </section>
}
`
})
export class NotificationsComponent implements OnInit {
  rows = signal<any[]>([]); alerts = signal<any[]>([]); loading = signal(false); error = signal(''); filter = '';
  constructor(private auth: AuthService) {}
  ngOnInit() { this.load(); }
  visible() { return this.rows().filter(item => !this.filter || (this.filter === 'read' ? !item.wasUnread : item.wasUnread)); }
  async load() {
    this.loading.set(true); this.error.set(''); const refresh = await this.auth.supabase().rpc('refresh_overdue_rentals');
    const [notifications, contracts, rentals, payments, maintenance, vehicles, incidents] = await Promise.all([
      this.auth.supabase().from('notifications').select('*').eq('user_id', this.auth.profile()?.id).order('created_at', { ascending: false }), this.auth.supabase().from('contracts').select('contract_number').eq('status', 'pending_signature'), this.auth.supabase().from('rentals').select('id,status,return_date,rental_price,vehicles(registration_number)'), this.auth.supabase().from('payments').select('rental_id,amount'), this.auth.supabase().from('vehicle_maintenance').select('id,next_maintenance_date,status,vehicles(registration_number)').neq('status', 'completed'), this.auth.supabase().from('vehicles').select('registration_number,insurance_expiry_date,technical_inspection_expiry_date'), this.auth.supabase().from('incidents').select('id').in('status', ['open', 'in_progress'])
    ]);
    this.loading.set(false); const problem = refresh.error ?? notifications.error ?? contracts.error ?? rentals.error ?? payments.error ?? maintenance.error ?? vehicles.error ?? incidents.error;
    if (problem) { this.error.set(this.auth.errorMessage(problem)); return; }
    this.rows.set((notifications.data ?? []).map(item => ({ ...item, wasUnread: !item.is_read })));
    await this.markAllSeen();
    const now = Date.now(), soon = now + 30 * 86400000, alerts: any[] = [];
    for (const contract of contracts.data ?? []) alerts.push({ key: `contract-${contract.contract_number}`, title: 'Contrat à signer', message: `${contract.contract_number ?? 'Contrat'} attend les signatures.` });
    for (const rental of rentals.data ?? []) { const end = new Date(rental.return_date).getTime(), vehicle: any = Array.isArray(rental.vehicles) ? rental.vehicles[0] : rental.vehicles, name = vehicle?.registration_number ?? 'Véhicule'; if (rental.status === 'overdue') alerts.push({ key: `late-${rental.id}`, title: 'Véhicule en retard', message: `${name} a dépassé sa date de retour.` }); else if (rental.status === 'active' && end >= now && end < now + 48 * 3600000) alerts.push({ key: `return-${rental.id}`, title: 'Retour proche', message: `${name} doit être retourné dans moins de 48 h.` }); const paid = (payments.data ?? []).filter(payment => payment.rental_id === rental.id).reduce((total, payment) => total + Number(payment.amount), 0); if (paid < Number(rental.rental_price)) alerts.push({ key: `payment-${rental.id}`, title: 'Solde de paiement restant', message: `${name} présente un solde impayé.` }); }
    for (const item of maintenance.data ?? []) { const date = item.next_maintenance_date ? new Date(item.next_maintenance_date).getTime() : 0; if (date && date <= soon) alerts.push({ key: `maintenance-${item.id}`, title: 'Maintenance à venir', message: `${(Array.isArray(item.vehicles) ? item.vehicles[0] : item.vehicles)?.registration_number ?? 'Véhicule'} arrive à échéance.` }); }
    for (const vehicle of vehicles.data ?? []) { if (vehicle.insurance_expiry_date && new Date(vehicle.insurance_expiry_date).getTime() <= soon) alerts.push({ key: `insurance-${vehicle.registration_number}`, title: 'Assurance à renouveler', message: `${vehicle.registration_number} : échéance d'assurance proche ou dépassée.` }); if (vehicle.technical_inspection_expiry_date && new Date(vehicle.technical_inspection_expiry_date).getTime() <= soon) alerts.push({ key: `technical-${vehicle.registration_number}`, title: 'Contrôle technique à renouveler', message: `${vehicle.registration_number} : échéance proche ou dépassée.` }); }
    if ((incidents.data ?? []).length) alerts.push({ key: 'incidents', title: 'Incident nécessitant une action', message: `${(incidents.data ?? []).length} incident(s) ouvert(s) ou en cours.` }); this.alerts.set(alerts);
  }
  async markAllSeen() {
    const unreadIds = this.rows().filter(item => !item.is_read).map(item => item.id);
    if (unreadIds.length) {
      const result = await this.auth.supabase().from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).in('id', unreadIds);
      if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
      this.rows.set(this.rows().map(item => unreadIds.includes(item.id) ? { ...item, is_read: true } : item));
    }
    await this.auth.refreshUnreadNotifications();
  }
}
