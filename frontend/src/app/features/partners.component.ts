import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .vehicle-card{border:1px solid var(--app-border,#e1eaec);border-radius:16px;padding:18px;background:var(--app-surface,#fff);box-shadow:var(--app-shadow,0 12px 28px rgba(9,44,51,.05))}
    .photo-grid{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
    .photo-grid img{width:90px;height:68px;object-fit:cover;border-radius:8px;background:#edf4f5}
    .margin-warning{background:#fff8e8;border:1px solid #f0cf79;border-radius:10px;padding:10px 12px;font-size:.85rem}
  `],
  template: `
    <div class="page-heading"><div><p class="eyebrow">PARTENAIRES</p><h1>Véhicules partenaires</h1><p>Évaluez les soumissions puis fixez le prix client final.</p></div></div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> } @if (message()) { <div class="alert alert-success">{{ message() }}</div> }

    <section class="mb-5">
      <h2 class="h5 mb-3">En attente d'évaluation ({{ pending().length }})</h2>
      @if (loading()) { <div class="empty-state">Chargement…</div> }
      @else if (!pending().length) { <div class="empty-state">Aucune soumission en attente.</div> }
      @else { <div class="row g-3">@for (v of pending(); track v.id) { <div class="col-md-6"><article class="vehicle-card">
        <div class="d-flex justify-content-between gap-2"><div><h3 class="h6 mb-0">{{ v.make }} {{ v.model }}</h3><small class="text-muted">{{ v.registration_number }} · {{ v.partners?.company_name || v.partners?.contact_name }}</small></div><span class="badge text-bg-warning">En attente</span></div>
        <p class="small mt-2 mb-0">Prix demandé par le partenaire : <strong>{{ money(v.partner_requested_price) }}</strong>/jour</p>
        <p class="small text-muted mb-0">{{ v.category || 'Catégorie non renseignée' }} · {{ v.transmission || '—' }} · {{ v.fuel_type || '—' }}</p>
        @if (v.notes) { <p class="small text-muted mt-1 mb-0">{{ v.notes }}</p> }
        <div class="photo-grid">@for (photo of photosFor(v.id); track photo.id) { <img [src]="photo.url" alt="Photo"> }</div>
        <div class="d-flex gap-2 mt-2"><button class="btn btn-sm btn-primary" (click)="openEvaluate(v)">Évaluer</button></div>
      </article></div> }</div> }
    </section>

    <section>
      <h2 class="h5 mb-3">Tous les véhicules partenaires</h2>
      @if (!all().length) { <div class="empty-state">Aucun véhicule partenaire.</div> }
      @else { <div class="table-responsive app-table"><table class="table align-middle mb-0"><thead><tr><th>Véhicule</th><th>Partenaire</th><th>Statut</th><th>Prix partenaire</th><th>Prix client</th></tr></thead><tbody>@for (v of all(); track v.id) { <tr><td>{{ v.make }} {{ v.model }}<small class="d-block text-muted">{{ v.registration_number }}</small></td><td>{{ v.partners?.company_name || v.partners?.contact_name }}</td><td><span class="badge text-bg-{{ statusTone(v.approval_status) }}">{{ statusLabel(v.approval_status) }}</span></td><td>{{ money(v.partner_requested_price) }}</td><td>{{ v.approval_status === 'approved' ? money(v.rental_price) : '—' }}</td></tr> }</tbody></table></div> }
    </section>

    @if (evaluating()) { <section class="card form-card mt-4"><div class="card-body">
      <div class="d-flex justify-content-between"><h2 class="h4">Évaluer {{ evaluating().make }} {{ evaluating().model }}</h2><button class="btn-close" (click)="evaluating.set(null)"></button></div>
      <p class="text-muted">Partenaire : {{ evaluating().partners?.company_name || evaluating().partners?.contact_name }} · Prix demandé : <strong>{{ money(evaluating().partner_requested_price) }}</strong>/jour</p>
      <div class="row g-3">
        <div class="col-md-6"><label>Prix client final (FCFA/jour) <span class="required">*</span></label><input class="form-control" type="number" min="0" [(ngModel)]="finalPrice"></div>
        <div class="col-md-6"><label>Caution (FCFA)</label><input class="form-control" type="number" min="0" [(ngModel)]="finalDeposit"></div>
      </div>
      @if (marginTooLow()) { <p class="margin-warning mt-3">⚠ Votre marge serait de {{ money(margin()) }}, en dessous du minimum configuré ({{ money(minMargin()) }}). Vous pouvez valider quand même, ou ajuster le prix.</p> }
      @else { <p class="text-muted small mt-3">Votre marge : {{ money(margin()) }}</p> }
      <div class="d-flex flex-wrap gap-2 mt-3">
        <button class="btn btn-success" [disabled]="saving()" (click)="decide('approved')">Valider</button>
        <button class="btn btn-outline-danger" [disabled]="saving()" (click)="openReject()">Refuser</button>
        <button class="btn btn-link" (click)="evaluating.set(null)">Annuler</button>
      </div>
      @if (rejecting()) { <div class="mt-3"><label>Motif du refus</label><textarea class="form-control" rows="2" [(ngModel)]="rejectionReason"></textarea><button class="btn btn-danger mt-2" [disabled]="saving()" (click)="decide('rejected')">Confirmer le refus</button></div> }
    </div></section> }
  `
})
export class PartnersComponent implements OnInit {
  vehicles = signal<any[]>([]); allPhotos = signal<Record<string, any[]>>({});
  loading = signal(false); saving = signal(false); error = signal(''); message = signal('');
  evaluating = signal<any>(null); rejecting = signal(false); finalPrice = 0; finalDeposit = 0; rejectionReason = '';
  minMargin = signal(5000);
  constructor(private auth: AuthService) {}

  async ngOnInit() { await this.load(); }
  pending() { return this.vehicles().filter(v => v.approval_status === 'pending'); }
  all() { return this.vehicles(); }
  photosFor(vehicleId: string) { return this.allPhotos()[vehicleId] ?? []; }
  statusLabel(status: string) { return ({ pending: 'En attente', approved: 'Validé', rejected: 'Refusé' } as Record<string, string>)[status] ?? status; }
  statusTone(status: string) { return ({ pending: 'warning', approved: 'success', rejected: 'danger' } as Record<string, string>)[status] ?? 'secondary'; }
  money(value: any) { return Number(value ?? 0).toLocaleString('fr-FR') + ' FCFA'; }
  margin() { return Number(this.finalPrice || 0) - Number(this.evaluating()?.partner_requested_price || 0); }
  marginTooLow() { return this.margin() < this.minMargin(); }

  async load() {
    this.loading.set(true); this.error.set('');
    const [vehicles, settings] = await Promise.all([
      this.auth.supabase().from('vehicles').select('*,partners(company_name,contact_name)').eq('owner_type', 'partner').order('submitted_at', { ascending: false }),
      this.auth.supabase().from('company_settings').select('partner_minimum_margin').limit(1).maybeSingle()
    ]);
    this.loading.set(false);
    if (vehicles.error) { this.error.set(this.auth.errorMessage(vehicles.error)); return; }
    this.vehicles.set(vehicles.data ?? []);
    if (settings.data?.partner_minimum_margin != null) this.minMargin.set(Number(settings.data.partner_minimum_margin));
    const pendingIds = (vehicles.data ?? []).filter((v: any) => v.approval_status === 'pending').map((v: any) => v.id);
    if (pendingIds.length) {
      const docs = await this.auth.supabase().from('vehicle_documents').select('*').in('vehicle_id', pendingIds).eq('document_type', 'photo');
      const byVehicle: Record<string, any[]> = {};
      for (const doc of docs.data ?? []) {
        const signed = await this.auth.supabase().storage.from('rental-documents').createSignedUrl((doc as any).storage_path, 600);
        const url = signed.data?.signedUrl ?? '';
        (byVehicle[(doc as any).vehicle_id] ??= []).push({ ...doc, url });
      }
      this.allPhotos.set(byVehicle);
    }
  }

  openEvaluate(vehicle: any) { this.error.set(''); this.message.set(''); this.rejecting.set(false); this.rejectionReason = ''; this.finalPrice = Number(vehicle.partner_requested_price) + this.minMargin(); this.finalDeposit = Number(vehicle.deposit_amount || 0); this.evaluating.set(vehicle); }
  openReject() { this.rejecting.set(true); }

  async decide(decision: 'approved' | 'rejected') {
    const vehicle = this.evaluating(); if (!vehicle) return;
    if (decision === 'approved' && !(Number(this.finalPrice) > 0)) { this.error.set('Indiquez un prix client valide.'); return; }
    if (decision === 'rejected' && !this.rejectionReason.trim()) { this.error.set('Indiquez un motif de refus.'); return; }
    this.saving.set(true); this.error.set('');
    const payload: any = decision === 'approved'
      ? { approval_status: 'approved', status: 'available', rental_price: Number(this.finalPrice), deposit_amount: Number(this.finalDeposit || 0), commission_amount: Number(this.finalPrice) - Number(vehicle.partner_requested_price), reviewed_at: new Date().toISOString(), reviewed_by: this.auth.profile()?.id }
      : { approval_status: 'rejected', rejection_reason: this.rejectionReason.trim(), reviewed_at: new Date().toISOString(), reviewed_by: this.auth.profile()?.id };
    const result = await this.auth.supabase().from('vehicles').update(payload).eq('id', vehicle.id);
    this.saving.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    this.evaluating.set(null); this.message.set(decision === 'approved' ? 'Véhicule validé.' : 'Véhicule refusé.'); await this.load();
  }
}
