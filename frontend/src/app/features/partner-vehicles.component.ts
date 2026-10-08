import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .vehicle-card{border:1px solid var(--app-border,#e1eaec);border-radius:16px;padding:18px;background:var(--app-surface,#fff);box-shadow:var(--app-shadow,0 12px 28px rgba(9,44,51,.05));transition:transform .2s ease,box-shadow .2s ease}
    .vehicle-card:hover{transform:translateY(-3px)}
    .photo-grid{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .photo-grid img{width:76px;height:58px;object-fit:cover;border-radius:8px;background:#edf4f5}
    .badge{border-radius:999px}
  `],
  template: `
    <div class="page-heading"><div><p class="eyebrow">MES VÉHICULES</p><h1>Mes véhicules</h1><p>Proposez vos véhicules à la location ; chaque ajout est évalué avant publication.</p></div><button class="btn btn-primary" (click)="openForm()">+ Proposer un véhicule</button></div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> } @if (message()) { <div class="alert alert-success">{{ message() }}</div> }
    @if (loading()) { <div class="empty-state">Chargement…</div> }
    @else if (!vehicles().length) { <div class="empty-state">Vous n'avez encore proposé aucun véhicule.</div> }
    @else { <div class="row g-3">@for (v of vehicles(); track v.id) { <div class="col-md-6"><article class="vehicle-card">
      <div class="d-flex justify-content-between gap-2"><div><h2 class="h5 mb-0">{{ v.make }} {{ v.model }}</h2><small class="text-muted">{{ v.registration_number }} · {{ v.color || 'Couleur non renseignée' }}</small></div><span class="badge text-bg-{{ statusTone(v.approval_status) }}">{{ statusLabel(v.approval_status) }}</span></div>
      <p class="small mt-2 mb-0">Prix demandé : <strong>{{ money(v.partner_requested_price) }}</strong>/jour</p>
      @if (v.approval_status === 'approved') { <p class="small text-muted mb-0">Prix client : {{ money(v.rental_price) }}/jour</p> }
      @if (v.approval_status === 'rejected' && v.rejection_reason) { <p class="small text-danger mb-0">Motif : {{ v.rejection_reason }}</p> }
      <div class="d-flex gap-2 mt-3">
        @if (v.approval_status !== 'approved') { <button class="btn btn-sm btn-outline-primary" (click)="edit(v)">Modifier</button> }
        <button class="btn btn-sm btn-outline-secondary" (click)="managePhotos(v)">Photos</button>
      </div>
    </article></div> }</div> }

    @if (form()) { <section class="card form-card mt-4"><div class="card-body">
      <div class="d-flex justify-content-between"><h2 class="h4">{{ form()!.id ? 'Modifier' : 'Proposer' }} un véhicule</h2><button class="btn-close" (click)="form.set(null)"></button></div>
      <div class="row g-3 mt-1">
        <div class="col-md-4"><label>Immatriculation <span class="required">*</span></label><input class="form-control" [(ngModel)]="form()!.registration_number"></div>
        <div class="col-md-4"><label>Marque <span class="required">*</span></label><input class="form-control" [(ngModel)]="form()!.make"></div>
        <div class="col-md-4"><label>Modèle <span class="required">*</span></label><input class="form-control" [(ngModel)]="form()!.model"></div>
        <div class="col-md-3"><label>Couleur</label><input class="form-control" [(ngModel)]="form()!.color"></div>
        <div class="col-md-3"><label>Année</label><input class="form-control" type="number" [(ngModel)]="form()!.year"></div>
        <div class="col-md-3"><label>Carburant</label><select class="form-select" [(ngModel)]="form()!.fuel_type"><option value="">Sélectionner</option><option value="essence">Essence</option><option value="diesel">Diesel</option><option value="hybrid">Hybride</option></select></div>
        <div class="col-md-3"><label>Transmission</label><select class="form-select" [(ngModel)]="form()!.transmission"><option value="">Sélectionner</option><option value="automatic">Automatique</option><option value="manual">Manuelle</option></select></div>
        <div class="col-md-4"><label>Catégorie</label><select class="form-select" [(ngModel)]="form()!.category"><option value="">Sélectionner</option><option value="Citadine">Citadine</option><option value="Berline">Berline</option><option value="SUV">SUV</option></select></div>
        <div class="col-md-4"><label>Prix souhaité (FCFA/jour) <span class="required">*</span></label><input class="form-control" type="number" min="0" [(ngModel)]="form()!.partner_requested_price"></div>
        <div class="col-md-4"><label>Caution suggérée (FCFA)</label><input class="form-control" type="number" min="0" [(ngModel)]="form()!.deposit_amount"></div>
        <div class="col-12"><label>Conditions d'utilisation / notes</label><textarea class="form-control" rows="3" [(ngModel)]="form()!.notes" placeholder="Kilométrage limite, zone autorisée, carburant à la reprise…"></textarea></div>
      </div>
      <button class="btn btn-success mt-4" [disabled]="saving()" (click)="save()">{{ saving() ? 'Envoi…' : 'Soumettre pour évaluation' }}</button>
      <button class="btn btn-link mt-4" (click)="form.set(null)">Annuler</button>
    </div></section> }

    @if (photoVehicle()) { <section class="card form-card mt-4"><div class="card-body">
      <div class="d-flex justify-content-between"><h2 class="h4">Photos — {{ photoVehicle().make }} {{ photoVehicle().model }}</h2><button class="btn-close" (click)="photoVehicle.set(null)"></button></div>
      <input class="form-control mt-2" type="file" multiple accept="image/png,image/jpeg,image/webp" (change)="uploadPhotos($event)">
      <div class="photo-grid">@for (photo of photos(); track photo.id) { <img [src]="photo.url" [alt]="photoVehicle().make"> }</div>
    </div></section> }
  `
})
export class PartnerVehiclesComponent implements OnInit {
  vehicles = signal<any[]>([]); form = signal<any>(null); photoVehicle = signal<any>(null); photos = signal<any[]>([]);
  loading = signal(false); saving = signal(false); error = signal(''); message = signal('');
  private partnerId = '';
  constructor(private auth: AuthService) {}

  async ngOnInit() { await this.load(); }

  statusLabel(status: string) { return ({ pending: 'En attente', approved: 'Validé', rejected: 'Refusé' } as Record<string, string>)[status] ?? status; }
  statusTone(status: string) { return ({ pending: 'warning', approved: 'success', rejected: 'danger' } as Record<string, string>)[status] ?? 'secondary'; }
  money(value: any) { return Number(value ?? 0).toLocaleString('fr-FR') + ' FCFA'; }

  async load() {
    this.loading.set(true); this.error.set('');
    const partner = await this.auth.supabase().from('partners').select('id').eq('profile_id', this.auth.profile()?.id ?? '').maybeSingle();
    this.partnerId = partner.data?.id ?? '';
    const result = await this.auth.supabase().from('vehicles').select('*').eq('owner_type', 'partner').order('created_at', { ascending: false });
    this.loading.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    this.vehicles.set(result.data ?? []);
  }

  openForm() { this.error.set(''); this.message.set(''); this.form.set({ registration_number: '', make: '', model: '', color: '', year: null, fuel_type: '', transmission: '', category: '', partner_requested_price: 0, deposit_amount: 0, notes: '' }); }
  edit(vehicle: any) { this.error.set(''); this.message.set(''); this.form.set({ ...vehicle }); }

  async save() {
    const value = this.form();
    if (!value?.registration_number?.trim() || !value.make?.trim() || !value.model?.trim() || !(Number(value.partner_requested_price) > 0)) {
      this.error.set('Immatriculation, marque, modèle et prix souhaité sont obligatoires.'); return;
    }
    this.saving.set(true); this.error.set('');
    const payload = { registration_number: value.registration_number.trim(), make: value.make.trim(), model: value.model.trim(), color: value.color || null, year: value.year || null, fuel_type: value.fuel_type || null, transmission: value.transmission || null, category: value.category || null, partner_requested_price: Number(value.partner_requested_price), deposit_amount: Number(value.deposit_amount || 0), notes: value.notes || null };
    const result = value.id
      ? await this.auth.supabase().from('vehicles').update(payload).eq('id', value.id)
      : await this.auth.supabase().from('vehicles').insert(payload);
    this.saving.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    this.form.set(null); this.message.set('Véhicule soumis pour évaluation.'); await this.load();
  }

  async managePhotos(vehicle: any) {
    this.error.set(''); this.photoVehicle.set(vehicle); this.photos.set([]);
    const docs = await this.auth.supabase().from('vehicle_documents').select('*').eq('vehicle_id', vehicle.id).eq('document_type', 'photo').order('created_at', { ascending: false });
    if (docs.error) { this.error.set(this.auth.errorMessage(docs.error)); return; }
    const withUrls = await Promise.all((docs.data ?? []).map(async (d: any) => { const url = await this.auth.supabase().storage.from('rental-documents').createSignedUrl(d.storage_path, 600); return { ...d, url: url.data?.signedUrl ?? '' }; }));
    this.photos.set(withUrls);
  }

  async uploadPhotos(event: Event) {
    const vehicle = this.photoVehicle(); const files = Array.from((event.target as HTMLInputElement).files ?? []);
    if (!vehicle || !files.length) return;
    this.error.set('');
    for (const file of files) {
      const path = `vehicles/${vehicle.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const upload = await this.auth.supabase().storage.from('rental-documents').upload(path, file, { contentType: file.type });
      if (upload.error) { this.error.set(this.auth.errorMessage(upload.error)); continue; }
      const saved = await this.auth.supabase().from('vehicle_documents').insert({ vehicle_id: vehicle.id, document_type: 'photo', document_name: file.name, storage_path: path, mime_type: file.type, file_size: file.size });
      if (saved.error) this.error.set(this.auth.errorMessage(saved.error));
    }
    (event.target as HTMLInputElement).value = '';
    await this.managePhotos(vehicle);
  }
}
