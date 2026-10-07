import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="page-heading"><div><p class="eyebrow">CONSULTATION</p><h1>Inspections</h1><p>États des lieux de départ et de retour de vos véhicules (lecture seule).</p></div></div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    @if (loading()) { <div class="empty-state">Chargement…</div> }
    @else if (!rows().length) { <div class="empty-state">Aucune inspection pour le moment.</div> }
    @else { <div class="row g-3">@for (item of rows(); track item.id) { <div class="col-md-6"><article class="card"><div class="card-body">
      <span class="badge text-bg-{{ item.inspection_type === 'departure' ? 'primary' : 'success' }}">{{ item.inspection_type === 'departure' ? 'Départ' : 'Retour' }}</span>
      <h2 class="h6 mt-2 mb-1">{{ item.vehicles?.registration_number }}</h2>
      <p class="text-muted small mb-2">{{ item.inspection_date | date:'medium' }}</p>
      <p class="small mb-0">Kilométrage : {{ item.mileage }} km · Carburant : {{ item.fuel_level || 'Non renseigné' }}</p>
      @if (item.observations) { <p class="small text-muted mt-2 mb-0">{{ item.observations }}</p> }
    </div></article></div> }</div> }
  `
})
export class PartnerInspectionsComponent implements OnInit {
  rows = signal<any[]>([]); loading = signal(false); error = signal('');
  constructor(private auth: AuthService) {}
  async ngOnInit() {
    this.loading.set(true); this.error.set('');
    const result = await this.auth.supabase().from('vehicle_inspections').select('*,vehicles(registration_number,make,model)').order('inspection_date', { ascending: false });
    this.loading.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    this.rows.set(result.data ?? []);
  }
}
