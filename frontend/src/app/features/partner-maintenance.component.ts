import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="page-heading"><div><p class="eyebrow">MES VÉHICULES</p><h1>Maintenance</h1><p>Déclarez une maintenance pour rendre votre véhicule temporairement indisponible.</p></div>@if (vehicles().length) {<button class="btn btn-primary" (click)="openForm()">+ Nouvelle maintenance</button>}</div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> } @if (message()) { <div class="alert alert-success">{{ message() }}</div> }
    @if (loading()) { <div class="empty-state">Chargement…</div> }
    @else if (!rows().length) { <div class="empty-state">Aucune maintenance enregistrée.</div> }
    @else { <div class="table-responsive app-table"><table class="table align-middle mb-0"><thead><tr><th>Véhicule</th><th>Type</th><th>Date</th><th>Statut</th><th class="text-end">Action</th></tr></thead><tbody>@for (item of rows(); track item.id) { <tr><td>{{ item.vehicles?.registration_number }}</td><td>{{ item.maintenance_type }}</td><td>{{ item.maintenance_date | date }}</td><td><span class="badge text-bg-{{ statusTone(item.status) }}">{{ statusLabel(item.status) }}</span></td><td class="text-end">@if (item.status !== 'completed') { <button class="btn btn-sm btn-outline-success" (click)="complete(item)">Clôturer</button> }</td></tr> }</tbody></table></div> }

    @if (form()) { <section class="card form-card mt-4"><div class="card-body">
      <div class="d-flex justify-content-between"><h2 class="h4">Nouvelle maintenance</h2><button class="btn-close" (click)="form.set(null)"></button></div>
      <div class="row g-3 mt-1">
        <div class="col-md-6"><label>Véhicule <span class="required">*</span></label><select class="form-select" [(ngModel)]="form()!.vehicle_id"><option value="">Sélectionner</option>@for (v of vehicles(); track v.id) { <option [value]="v.id">{{ v.registration_number }} — {{ v.make }} {{ v.model }}</option> }</select></div>
        <div class="col-md-6"><label>Type <span class="required">*</span></label><input class="form-control" [(ngModel)]="form()!.maintenance_type" placeholder="Révision, pneus, vidange…"></div>
        <div class="col-md-6"><label>Date</label><input class="form-control" type="date" [(ngModel)]="form()!.maintenance_date"></div>
        <div class="col-12"><label>Notes</label><textarea class="form-control" rows="3" [(ngModel)]="form()!.description"></textarea></div>
      </div>
      <button class="btn btn-success mt-4" [disabled]="saving()" (click)="save()">{{ saving() ? 'Enregistrement…' : 'Déclarer la maintenance' }}</button>
      <button class="btn btn-link mt-4" (click)="form.set(null)">Annuler</button>
    </div></section> }
  `
})
export class PartnerMaintenanceComponent implements OnInit {
  rows = signal<any[]>([]); vehicles = signal<any[]>([]); form = signal<any>(null);
  loading = signal(false); saving = signal(false); error = signal(''); message = signal('');
  constructor(private auth: AuthService) {}

  async ngOnInit() { await this.load(); }
  statusLabel(status: string) { return ({ planned: 'Planifiée', in_progress: 'En cours', completed: 'Terminée', cancelled: 'Annulée' } as Record<string, string>)[status] ?? status; }
  statusTone(status: string) { return ({ planned: 'secondary', in_progress: 'warning', completed: 'success', cancelled: 'danger' } as Record<string, string>)[status] ?? 'secondary'; }

  async load() {
    this.loading.set(true); this.error.set('');
    const [vehicles, rows] = await Promise.all([
      this.auth.supabase().from('vehicles').select('id,registration_number,make,model').eq('owner_type', 'partner').order('registration_number'),
      this.auth.supabase().from('vehicle_maintenance').select('*,vehicles(registration_number)').order('maintenance_date', { ascending: false })
    ]);
    this.loading.set(false);
    const failure = vehicles.error ?? rows.error;
    if (failure) { this.error.set(this.auth.errorMessage(failure)); return; }
    this.vehicles.set(vehicles.data ?? []); this.rows.set(rows.data ?? []);
  }

  openForm() { this.error.set(''); this.message.set(''); this.form.set({ vehicle_id: '', maintenance_type: '', maintenance_date: new Date().toISOString().slice(0, 10), status: 'in_progress', description: '' }); }

  async save() {
    const value = this.form();
    if (!value?.vehicle_id || !value.maintenance_type?.trim()) { this.error.set('Véhicule et type sont obligatoires.'); return; }
    this.saving.set(true); this.error.set('');
    const result = await this.auth.supabase().from('vehicle_maintenance').insert({ vehicle_id: value.vehicle_id, maintenance_type: value.maintenance_type.trim(), maintenance_date: value.maintenance_date, status: value.status, description: value.description || null });
    this.saving.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    this.form.set(null); this.message.set('Maintenance déclarée. Le véhicule est indisponible à la réservation.'); await this.load();
  }

  async complete(item: any) {
    this.error.set(''); this.message.set('');
    const result = await this.auth.supabase().from('vehicle_maintenance').update({ status: 'completed' }).eq('id', item.id);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    this.message.set('Maintenance clôturée. Le véhicule redevient disponible.'); await this.load();
  }
}
