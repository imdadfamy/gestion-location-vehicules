import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { DigitsOnlyDirective } from '../shared/digits-only.directive';

@Component({
  standalone: true,
  imports: [FormsModule, DigitsOnlyDirective, DatePipe],
  styles: [`
    .stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px}
    .stat-card{padding:18px 20px;border-radius:16px;background:var(--app-surface,#fff);border:1px solid var(--app-border,#e1eaec);box-shadow:var(--app-shadow,0 12px 28px rgba(9,44,51,.05))}
    .stat-card small{display:block;color:var(--app-muted,#6a7f85);font-size:.76rem;font-weight:700;letter-spacing:.03em;text-transform:uppercase}
    .stat-card strong{display:block;margin-top:6px;font-size:1.45rem;color:var(--app-text,#12323b)}
    .tabs{display:flex;gap:6px;margin-bottom:20px;border-bottom:1px solid var(--app-border,#e1eaec)}
    .tab-btn{border:0;background:transparent;padding:10px 16px;font-weight:700;color:var(--app-muted,#6a7f85);border-bottom:2px solid transparent;cursor:pointer}
    .tab-btn.active{color:var(--app-accent,#0792a4);border-bottom-color:var(--app-accent,#0792a4)}
    .toolbar-row{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
    .toolbar-row input{flex:2;min-width:220px}
    .toolbar-row select{flex:1;min-width:160px}
    .vehicle-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
    .vehicle-card{text-align:left;border:1px solid var(--app-border,#e1eaec);border-radius:16px;padding:16px;background:var(--app-surface,#fff);box-shadow:var(--app-shadow,0 12px 28px rgba(9,44,51,.05));cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}
    .vehicle-card:hover{transform:translateY(-3px);box-shadow:0 18px 34px rgba(9,44,51,.1)}
    .photo-grid{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}
    .photo-grid button{padding:0;border:0;background:transparent;cursor:pointer;border-radius:8px;overflow:hidden;transition:transform .15s ease}
    .photo-grid button:hover{transform:scale(1.04)}
    .photo-grid img{display:block;width:76px;height:58px;object-fit:cover;background:#edf4f5}
    .status-pill{display:inline-flex;align-items:center;padding:5px 14px;border-radius:999px;font-size:.76rem;font-weight:750;letter-spacing:.02em}
    .status-pill.pending{background:#fff4d6;color:#8a6200}
    .status-pill.approved{background:#dcf5ea;color:#0d7a4c}
    .status-pill.rejected{background:#fde3e3;color:#b3261e}
    .status-pill.secondary{background:#eef2f3;color:#56707a}
    .lightbox-overlay{position:fixed;inset:0;z-index:1100;background:rgba(5,15,18,.86);display:flex;align-items:center;justify-content:center;padding:28px}
    .lightbox-overlay img{max-width:min(92vw,900px);max-height:88vh;border-radius:12px;box-shadow:0 30px 70px rgba(0,0,0,.4)}
    .lightbox-close{position:absolute;top:20px;right:24px;border:0;background:rgba(255,255,255,.12);color:#fff;width:40px;height:40px;border-radius:50%;font-size:1.3rem;cursor:pointer}
    .lightbox-close:hover{background:rgba(255,255,255,.22)}
    .margin-warning{background:#fff8e8;color:#6b5205;border:1px solid #f0cf79;border-radius:10px;padding:10px 12px;font-size:.85rem}
    .app-table tbody tr{cursor:pointer}
    .panel-overlay{position:fixed;inset:0;z-index:1050;background:rgba(5,29,35,.5);display:flex;justify-content:flex-end}
    .panel{width:min(520px,100%);height:100dvh;overflow-y:auto;background:var(--app-surface,#fff);color:var(--app-text);padding:28px;box-shadow:-20px 0 50px rgba(0,0,0,.22)}
    .panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}
    @media(max-width:900px){.stat-row{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:700px){.panel{padding:18px}}
  `],
  template: `
    <div class="page-heading"><div><p class="eyebrow">PARTENAIRES</p><h1>Programme partenaire</h1><p>Évaluez les soumissions, pilotez vos partenaires et suivez la marge générée.</p></div></div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> } @if (message()) { <div class="alert alert-success">{{ message() }}</div> }

    <div class="stat-row">
      <div class="stat-card"><small>Partenaires actifs</small><strong>{{ activePartnersCount() }}</strong></div>
      <div class="stat-card"><small>Véhicules en attente</small><strong>{{ pending().length }}</strong></div>
      <div class="stat-card"><small>Véhicules approuvés</small><strong>{{ approvedCount() }}</strong></div>
      <div class="stat-card"><small>Marge totale (locations terminées)</small><strong>{{ money(totalCommission()) }}</strong></div>
    </div>

    <div class="tabs">
      <button class="tab-btn" [class.active]="view()==='vehicles'" (click)="view.set('vehicles')">Véhicules</button>
      <button class="tab-btn" [class.active]="view()==='partners'" (click)="view.set('partners')">Partenaires ({{ partners().length }})</button>
    </div>

    @if (view()==='vehicles') {
      @if (pending().length) {
        <section class="mb-5">
          <h2 class="h5 mb-3">En attente d'évaluation ({{ pending().length }})</h2>
          @if (loading()) { <div class="empty-state">Chargement…</div> }
          @else { <div class="vehicle-grid">@for (v of pending(); track v.id) { <article class="vehicle-card" role="button" tabindex="0" (click)="openVehicle(v)" (keydown.enter)="openVehicle(v)">
            <div class="d-flex justify-content-between gap-2"><div><h3 class="h6 mb-0">{{ v.make }} {{ v.model }}</h3><small class="text-muted">{{ v.registration_number }} · {{ partnerLabel(v.partners) }}</small></div><span class="status-pill pending">En attente</span></div>
            <p class="small mt-2 mb-0">Prix demandé : <strong>{{ money(v.partner_requested_price) }}</strong>/jour</p>
            <p class="small text-muted mb-0">{{ v.category || 'Catégorie non renseignée' }} · {{ v.transmission || '—' }} · {{ v.fuel_type || '—' }}</p>
            <div class="photo-grid">@for (photo of photosFor(v.id); track photo.id) { <button type="button" (click)="$event.stopPropagation();openLightbox(photo.url)" aria-label="Agrandir la photo"><img [src]="photo.url" alt="Photo"></button> }</div>
          </article> }</div> }
        </section>
      }

      <section>
        <h2 class="h5 mb-3">Tous les véhicules partenaires</h2>
        <div class="toolbar-row">
          <input class="form-control" [(ngModel)]="search" placeholder="Rechercher un véhicule ou un partenaire">
          <select class="form-select" [(ngModel)]="statusFilter"><option value="">Tous les statuts</option><option value="pending">En attente</option><option value="approved">Validés</option><option value="rejected">Refusés</option></select>
        </div>
        @if (!filteredVehicles().length) { <div class="empty-state">Aucun véhicule ne correspond.</div> }
        @else { <div class="table-responsive app-table"><table class="table align-middle mb-0"><thead><tr><th>Véhicule</th><th>Partenaire</th><th>Statut</th><th>Prix partenaire</th><th>Prix client</th><th>Disponibilité</th></tr></thead><tbody>@for (v of filteredVehicles(); track v.id) { <tr (click)="openVehicle(v)"><td>{{ v.make }} {{ v.model }}<small class="d-block text-muted">{{ v.registration_number }}</small></td><td>{{ partnerLabel(v.partners) }}</td><td><span class="status-pill {{ v.approval_status }}">{{ statusLabel(v.approval_status) }}</span></td><td>{{ money(v.partner_requested_price) }}</td><td>{{ v.approval_status === 'approved' ? money(v.rental_price) : '—' }}</td><td>@if(v.approval_status==='approved'){<span class="status-pill {{v.status==='available'?'approved':'secondary'}}">{{v.status==='available'?'Publié':'Suspendu'}}</span>}</td></tr> }</tbody></table></div> }
      </section>
    }

    @if (view()==='partners') {
      <div class="toolbar-row">
        <input class="form-control" [(ngModel)]="search" placeholder="Rechercher un partenaire">
      </div>
      @if (!filteredPartners().length) { <div class="empty-state">Aucun partenaire ne correspond.</div> }
      @else { <div class="table-responsive app-table"><table class="table align-middle mb-0"><thead><tr><th>Partenaire</th><th>Contact</th><th>Véhicules</th><th>Compte</th><th></th></tr></thead><tbody>@for (p of filteredPartners(); track p.id) { <tr (click)="openPartner(p)"><td><strong>{{ p.company_name || p.contact_name }}</strong>@if(p.company_name){<small class="d-block text-muted">{{ p.contact_name }}</small>}</td><td>{{ p.phone }}<small class="d-block text-muted">{{ p.email || '—' }}</small></td><td>{{ vehicleCountFor(p.id) }}</td><td><span class="status-pill {{ p.profiles?.is_active ? 'approved' : 'secondary' }}">{{ p.profiles?.is_active ? 'Actif' : 'Désactivé' }}</span></td><td><button class="btn btn-sm btn-outline-primary" (click)="$event.stopPropagation();openPartner(p)">Gérer</button></td></tr> }</tbody></table></div> }
    }

    @if (selectedVehicle()) {
      <div class="panel-overlay" (click)="selectedVehicle.set(null)">
        <section class="panel" (click)="$event.stopPropagation()">
          <div class="panel-head"><div><p class="eyebrow mb-1">FICHE VÉHICULE</p><h2 class="h4 mb-0">{{ selectedVehicle().make }} {{ selectedVehicle().model }}</h2><small class="text-muted">{{ selectedVehicle().registration_number }} · {{ partnerLabel(selectedVehicle().partners) }}</small></div><button class="btn-close" (click)="selectedVehicle.set(null)"></button></div>
          <div class="photo-grid">@for (photo of photosFor(selectedVehicle().id); track photo.id) { <button type="button" (click)="openLightbox(photo.url)" aria-label="Agrandir la photo"><img [src]="photo.url" alt="Photo"></button> }</div>

          @if (selectedVehicle().approval_status === 'pending') {
            <p class="text-muted">Prix demandé par le partenaire : <strong>{{ money(selectedVehicle().partner_requested_price) }}</strong>/jour</p>
            @if (selectedVehicle().notes) { <p class="small text-muted">{{ selectedVehicle().notes }}</p> }
            <div class="row g-3">
              <div class="col-md-6"><label>Prix client final (FCFA/jour) <span class="required">*</span></label><input class="form-control" type="number" min="0" [(ngModel)]="finalPrice"></div>
              <div class="col-md-6"><label>Caution (FCFA)</label><input class="form-control" type="number" min="0" [(ngModel)]="finalDeposit"></div>
            </div>
            @if (marginTooLow()) { <p class="margin-warning mt-3">⚠ Votre marge serait de {{ money(margin()) }}, en dessous du minimum configuré ({{ money(minMargin()) }}). Vous pouvez valider quand même, ou ajuster le prix.</p> }
            @else { <p class="text-muted small mt-3">Votre marge : {{ money(margin()) }}</p> }
            <div class="d-flex flex-wrap gap-2 mt-3">
              <button class="btn btn-success" [disabled]="saving()" (click)="decide('approved')">Valider</button>
              <button class="btn btn-outline-danger" [disabled]="saving()" (click)="openReject()">Refuser</button>
            </div>
            @if (rejecting()) { <div class="mt-3"><label>Motif du refus</label><textarea class="form-control" rows="2" [(ngModel)]="rejectionReason"></textarea><button class="btn btn-danger mt-2" [disabled]="saving()" (click)="decide('rejected')">Confirmer le refus</button></div> }
          }

          @if (selectedVehicle().approval_status === 'approved') {
            <div class="row g-3 mt-1">
              <div class="col-md-6"><label>Prix client (FCFA/jour)</label><input class="form-control" type="number" min="0" [(ngModel)]="finalPrice"></div>
              <div class="col-md-6"><label>Caution (FCFA)</label><input class="form-control" type="number" min="0" [(ngModel)]="finalDeposit"></div>
            </div>
            <p class="text-muted small mt-2">Marge actuelle : {{ money(margin()) }}</p>
            <div class="d-flex flex-wrap gap-2 mt-3">
              <button class="btn btn-primary" [disabled]="saving()" (click)="saveApprovedChanges()">Enregistrer le prix</button>
              <button class="btn btn-outline-secondary" [disabled]="saving()" (click)="toggleAvailability()">{{ selectedVehicle().status === 'available' ? 'Suspendre (dépublier)' : 'Republier' }}</button>
              <button class="btn btn-outline-warning" [disabled]="saving()" (click)="resendToEvaluation()">Renvoyer en évaluation</button>
            </div>
          }

          @if (selectedVehicle().approval_status === 'rejected') {
            <div class="alert alert-secondary mt-2">Refusé{{ selectedVehicle().reviewed_at ? (' le ' + (selectedVehicle().reviewed_at | date:'short')) : '' }}.<br>Motif : {{ selectedVehicle().rejection_reason || 'Non précisé' }}</div>
            <p class="text-muted small">Le partenaire doit modifier et resoumettre ce véhicule depuis son espace pour qu'il repasse en évaluation.</p>
          }
        </section>
      </div>
    }

    @if (selectedPartner()) {
      <div class="panel-overlay" (click)="selectedPartner.set(null)">
        <section class="panel" (click)="$event.stopPropagation()">
          <div class="panel-head"><div><p class="eyebrow mb-1">PARTENAIRE</p><h2 class="h4 mb-0">{{ selectedPartner().company_name || selectedPartner().contact_name }}</h2><small class="text-muted">{{ vehicleCountFor(selectedPartner().id) }} véhicule(s)</small></div><button class="btn-close" (click)="selectedPartner.set(null)"></button></div>
          <div class="row g-3">
            <div class="col-md-6"><label>Nom de l'entreprise</label><input class="form-control" [(ngModel)]="partnerForm.company_name"></div>
            <div class="col-md-6"><label>Nom du contact <span class="required">*</span></label><input class="form-control" [(ngModel)]="partnerForm.contact_name"></div>
            <div class="col-md-6"><label>Téléphone <span class="required">*</span></label><input class="form-control" type="tel" inputmode="numeric" appDigitsOnly [(ngModel)]="partnerForm.phone"></div>
            <div class="col-md-6"><label>E-mail</label><input class="form-control" type="email" [(ngModel)]="partnerForm.email"></div>
            <div class="col-md-12"><label>Infos de paiement</label><textarea class="form-control" rows="2" [(ngModel)]="partnerForm.payout_details"></textarea></div>
            <div class="col-md-12"><label>Notes internes</label><textarea class="form-control" rows="2" [(ngModel)]="partnerForm.notes"></textarea></div>
          </div>
          <div class="d-flex flex-wrap gap-2 mt-3">
            <button class="btn btn-primary" [disabled]="saving()" (click)="savePartner()">Enregistrer</button>
            <button class="btn" [class.btn-outline-danger]="selectedPartner().profiles?.is_active" [class.btn-outline-success]="!selectedPartner().profiles?.is_active" [disabled]="saving()" (click)="togglePartnerAccess()">{{ selectedPartner().profiles?.is_active ? 'Désactiver le compte' : 'Réactiver le compte' }}</button>
          </div>
        </section>
      </div>
    }

    @if (lightboxUrl()) {
      <div class="lightbox-overlay" (click)="lightboxUrl.set(null)">
        <button class="lightbox-close" (click)="lightboxUrl.set(null)" aria-label="Fermer">×</button>
        <img [src]="lightboxUrl()!" alt="Photo du véhicule" (click)="$event.stopPropagation()">
      </div>
    }
  `
})
export class PartnersComponent implements OnInit {
  vehicles = signal<any[]>([]); partners = signal<any[]>([]); rentals = signal<any[]>([]); allPhotos = signal<Record<string, any[]>>({});
  loading = signal(false); saving = signal(false); error = signal(''); message = signal('');
  view = signal<'vehicles' | 'partners'>('vehicles');
  search = ''; statusFilter = '';
  selectedVehicle = signal<any>(null); selectedPartner = signal<any>(null); lightboxUrl = signal<string | null>(null);
  rejecting = signal(false); finalPrice = 0; finalDeposit = 0; rejectionReason = '';
  partnerForm: any = {};
  minMargin = signal(5000);
  constructor(private auth: AuthService) {}

  async ngOnInit() { await this.load(); }
  pending() { return this.vehicles().filter(v => v.approval_status === 'pending'); }
  approvedCount() { return this.vehicles().filter(v => v.approval_status === 'approved').length; }
  activePartnersCount() { return this.partners().filter(p => p.profiles?.is_active).length; }
  photosFor(vehicleId: string) { return this.allPhotos()[vehicleId] ?? []; }
  partnerLabel(p: any) { return p?.company_name || p?.contact_name || 'Partenaire'; }
  vehicleCountFor(partnerId: string) { return this.vehicles().filter(v => v.partner_id === partnerId).length; }
  statusLabel(status: string) { return ({ pending: 'En attente', approved: 'Validé', rejected: 'Refusé' } as Record<string, string>)[status] ?? status; }
  money(value: any) { return Number(value ?? 0).toLocaleString('fr-FR') + ' FCFA'; }
  margin() { const v = this.selectedVehicle(); return Number(this.finalPrice || 0) - Number(v?.partner_requested_price || 0); }
  marginTooLow() { return this.margin() < this.minMargin(); }

  filteredVehicles() {
    const q = this.search.trim().toLowerCase();
    return this.vehicles().filter(v =>
      (!this.statusFilter || v.approval_status === this.statusFilter) &&
      (!q || `${v.make} ${v.model} ${v.registration_number} ${this.partnerLabel(v.partners)}`.toLowerCase().includes(q))
    );
  }
  filteredPartners() {
    const q = this.search.trim().toLowerCase();
    return this.partners().filter(p => !q || `${p.company_name ?? ''} ${p.contact_name} ${p.phone}`.toLowerCase().includes(q));
  }

  totalCommission() {
    let total = 0;
    for (const v of this.vehicles()) {
      if (v.approval_status !== 'approved' || !v.commission_amount) continue;
      for (const r of this.rentals()) {
        if (r.vehicle_id !== v.id || r.status !== 'completed') continue;
        const days = Math.max(1, Math.ceil((new Date(r.return_date).getTime() - new Date(r.departure_date).getTime()) / 86400000));
        total += Number(v.commission_amount) * days;
      }
    }
    return total;
  }

  async load() {
    this.loading.set(true); this.error.set('');
    const [vehicles, partners, settings] = await Promise.all([
      this.auth.supabase().from('vehicles').select('*,partners(id,company_name,contact_name)').eq('owner_type', 'partner').order('submitted_at', { ascending: false }),
      this.auth.supabase().from('partners').select('*,profiles!partners_profile_id_fkey(is_active)').order('created_at', { ascending: false }),
      this.auth.supabase().from('company_settings').select('partner_minimum_margin').limit(1).maybeSingle()
    ]);
    if (vehicles.error) { this.loading.set(false); this.error.set(this.auth.errorMessage(vehicles.error)); return; }
    this.vehicles.set(vehicles.data ?? []);
    if (!partners.error) this.partners.set(partners.data ?? []);
    if (settings.data?.partner_minimum_margin != null) this.minMargin.set(Number(settings.data.partner_minimum_margin));

    const vehicleIds = (vehicles.data ?? []).map((v: any) => v.id);
    if (vehicleIds.length) {
      const rentalsResult = await this.auth.supabase().from('rentals').select('vehicle_id,departure_date,return_date,status').in('vehicle_id', vehicleIds);
      if (!rentalsResult.error) this.rentals.set(rentalsResult.data ?? []);
    }

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
    this.loading.set(false);
  }

  openVehicle(vehicle: any) {
    this.error.set(''); this.message.set(''); this.rejecting.set(false); this.rejectionReason = '';
    this.finalPrice = vehicle.approval_status === 'approved' ? Number(vehicle.rental_price) : Number(vehicle.partner_requested_price) + this.minMargin();
    this.finalDeposit = Number(vehicle.deposit_amount || 0);
    this.selectedVehicle.set(vehicle);
  }
  openLightbox(url: string) { this.lightboxUrl.set(url); }
  openReject() { this.rejecting.set(true); }

  async decide(decision: 'approved' | 'rejected') {
    const vehicle = this.selectedVehicle(); if (!vehicle) return;
    if (decision === 'approved' && !(Number(this.finalPrice) > 0)) { this.error.set('Indiquez un prix client valide.'); return; }
    if (decision === 'rejected' && !this.rejectionReason.trim()) { this.error.set('Indiquez un motif de refus.'); return; }
    this.saving.set(true); this.error.set('');
    const payload: any = decision === 'approved'
      ? { approval_status: 'approved', status: 'available', rental_price: Number(this.finalPrice), deposit_amount: Number(this.finalDeposit || 0), commission_amount: Number(this.finalPrice) - Number(vehicle.partner_requested_price), reviewed_at: new Date().toISOString(), reviewed_by: this.auth.profile()?.id }
      : { approval_status: 'rejected', rejection_reason: this.rejectionReason.trim(), reviewed_at: new Date().toISOString(), reviewed_by: this.auth.profile()?.id };
    const result = await this.auth.supabase().from('vehicles').update(payload).eq('id', vehicle.id);
    this.saving.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    this.selectedVehicle.set(null); this.message.set(decision === 'approved' ? 'Véhicule validé.' : 'Véhicule refusé.'); await this.load();
  }

  async saveApprovedChanges() {
    const vehicle = this.selectedVehicle(); if (!vehicle) return;
    if (!(Number(this.finalPrice) > 0)) { this.error.set('Indiquez un prix client valide.'); return; }
    this.saving.set(true); this.error.set('');
    const result = await this.auth.supabase().from('vehicles').update({ rental_price: Number(this.finalPrice), deposit_amount: Number(this.finalDeposit || 0), commission_amount: Number(this.finalPrice) - Number(vehicle.partner_requested_price) }).eq('id', vehicle.id);
    this.saving.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    this.message.set('Prix mis à jour.'); this.selectedVehicle.set(null); await this.load();
  }

  async toggleAvailability() {
    const vehicle = this.selectedVehicle(); if (!vehicle) return;
    this.saving.set(true); this.error.set('');
    const next = vehicle.status === 'available' ? 'unavailable' : 'available';
    const result = await this.auth.supabase().from('vehicles').update({ status: next }).eq('id', vehicle.id);
    this.saving.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    this.message.set(next === 'available' ? 'Véhicule republié.' : 'Véhicule suspendu.'); this.selectedVehicle.set(null); await this.load();
  }

  async resendToEvaluation() {
    const vehicle = this.selectedVehicle(); if (!vehicle) return;
    if (!confirm('Renvoyer ce véhicule en évaluation ? Il ne sera plus visible du public tant qu’il ne sera pas revalidé.')) return;
    this.saving.set(true); this.error.set('');
    const result = await this.auth.supabase().from('vehicles').update({ approval_status: 'pending', status: 'unavailable' }).eq('id', vehicle.id);
    this.saving.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    this.message.set('Véhicule renvoyé en évaluation.'); this.selectedVehicle.set(null); await this.load();
  }

  openPartner(partner: any) {
    this.error.set(''); this.message.set('');
    this.partnerForm = { company_name: partner.company_name, contact_name: partner.contact_name, phone: partner.phone, email: partner.email, payout_details: partner.payout_details, notes: partner.notes };
    this.selectedPartner.set(partner);
  }

  async savePartner() {
    const partner = this.selectedPartner(); if (!partner) return;
    if (!this.partnerForm.contact_name?.trim() || !this.partnerForm.phone?.trim()) { this.error.set('Nom du contact et téléphone sont obligatoires.'); return; }
    this.saving.set(true); this.error.set('');
    const result = await this.auth.supabase().from('partners').update(this.partnerForm).eq('id', partner.id);
    this.saving.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    this.message.set('Partenaire mis à jour.'); this.selectedPartner.set(null); await this.load();
  }

  async togglePartnerAccess() {
    const partner = this.selectedPartner(); if (!partner?.profile_id) { this.error.set('Ce partenaire n’a pas encore de compte de connexion.'); return; }
    this.saving.set(true); this.error.set('');
    const enable = !partner.profiles?.is_active;
    try {
      const result = await this.auth.supabase().functions.invoke('manage-users', { body: { action: 'update_partner_access', user_id: partner.profile_id, is_active: enable } });
      if (result.error) throw result.error;
      if (result.data?.error) throw new Error(result.data.error);
      this.message.set(enable ? 'Compte partenaire réactivé.' : 'Compte partenaire désactivé.'); this.selectedPartner.set(null); await this.load();
    } catch (e) { this.error.set(this.auth.errorMessage(e)); }
    this.saving.set(false);
  }
}
