import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';

type PhotoType = 'front' | 'rear' | 'left_side' | 'right_side' | 'interior';
const photoTypes: { key: PhotoType; label: string }[] = [
  { key: 'front', label: 'Avant' }, { key: 'rear', label: 'Arrière' }, { key: 'left_side', label: 'Côté gauche' }, { key: 'right_side', label: 'Côté droit' }, { key: 'interior', label: 'Intérieur' }
];

@Component({
  standalone: true,
  imports: [DatePipe, FormsModule],
  styles: [`
    .inspection-card { border:1px solid #dce9eb; border-radius:16px; padding:18px; background:#fff; box-shadow:0 8px 22px rgba(16,47,56,.06); }
    .inspection-card strong { color:#17353e; }.inspection-photo { width:100%; height:160px; object-fit:cover; border-radius:10px; background:#edf4f5; }
    .form-card { max-width:1000px; }.inspection-sheet { width:100%; margin-inline:auto; }.client-page { display:flex; flex-direction:column; }.client-page > .form-card { order:2; width:100%; }.client-page > .row { order:3; }.client-page > .card { order:1; }.client-page > .page-heading { order:0; }.client-page { display:flex; flex-direction:column; }.client-page > .form-card { order:2; width:100%; }.client-page > .row { order:3; }.client-page > .card { order:1; }.client-page > .page-heading { order:0; }.required { color:#b42318; }
    @media(max-width:575px) { .inspection-card { padding:15px; }.inspection-card .btn { width:100%; min-height:44px; }.form-card .card-body { padding:18px; } }
  `],
  template: `
    <div class="client-page"><div class="page-heading"><div><p class="eyebrow">ÉTATS DES LIEUX</p><h1>Mes inspections</h1><p>Réalisez vos états des lieux après la signature complète de votre contrat.</p></div></div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> } @if (message()) { <div class="alert alert-success">{{ message() }}</div> }
    @if (loading()) { <div class="empty-state">Chargement des inspections…</div> }
    @else {
      @if (availableActions().length) { <section class="card mb-4"><div class="card-body"><h2 class="h5">Nouvelle inspection</h2><p class="text-muted small">Le bouton apparaît uniquement pour une location dont le contrat est signé par vous et le Responsable.</p><div class="d-flex flex-wrap gap-2">@for (action of availableActions(); track action.rental.id + action.type) { <button class="btn btn-primary" (click)="openForm(action.rental, action.type)">+ Inspection {{ label(action.type).toLowerCase() }} — {{ action.rental.vehicle?.registration_number }}</button> }</div></div></section> }
      @if (!inspections().length) { <div class="empty-state">Aucune inspection enregistrée pour le moment.</div> }
    @else { <div class="row g-3">@for (inspection of inspections(); track inspection.id) { <div class="col-md-6"><article class="inspection-card"><div class="d-flex justify-content-between gap-2"><div><span class="badge text-bg-{{ inspection.inspection_type === 'departure' ? 'primary' : 'success' }}">Inspection {{ label(inspection.inspection_type) }}</span><h2 class="h5 mt-3 mb-1">{{ inspection.vehicle?.make }} {{ inspection.vehicle?.model }}</h2><p class="text-muted mb-3">{{ inspection.vehicle?.registration_number }} · {{ inspection.inspection_date | date:'medium' }}</p></div><button class="btn btn-sm btn-outline-primary align-self-start" (click)="show(inspection)">Voir la fiche</button></div><div class="row small"><div class="col-6"><strong>Kilométrage</strong><br>{{ inspection.mileage }} km</div><div class="col-6"><strong>Carburant</strong><br>{{ inspection.fuel_level || 'Non renseigné' }}</div></div></article></div> }</div> }
    }

    @if (form()) { <section class="card form-card mt-4"><div class="card-body"><div class="d-flex justify-content-between"><div><p class="eyebrow mb-1">NOUVEL ÉTAT DES LIEUX</p><h2 class="h4">Inspection de {{ label(form()!.inspection_type).toLowerCase() }}</h2><p class="text-muted">{{ form()!.rental.vehicle?.make }} {{ form()!.rental.vehicle?.model }} · {{ form()!.rental.vehicle?.registration_number }}</p></div><button class="btn-close" (click)="closeForm()"></button></div><div class="row g-3"><div class="col-md-6"><label>Kilométrage <span class="required">*</span></label><input class="form-control" min="0" type="number" [(ngModel)]="form()!.mileage"></div><div class="col-md-6"><label>Niveau de carburant</label><input class="form-control" [(ngModel)]="form()!.fuel_level" placeholder="Ex. plein, 1/2"></div><div class="col-12"><label>Dommages constatés</label><textarea class="form-control" rows="2" [(ngModel)]="form()!.damagesText" placeholder="Un dommage par ligne"></textarea></div><div class="col-12"><label>Observations</label><textarea class="form-control" rows="3" [(ngModel)]="form()!.observations" placeholder="Toute information utile sur le véhicule"></textarea></div></div><h3 class="h6 mt-4">Photos (facultatives)</h3><div class="row g-3">@for (photo of photoTypes; track photo.key) { <div class="col-md"><label>{{ photo.label }}</label><input class="form-control" type="file" accept="image/png,image/jpeg,image/webp" (change)="choose(photo.key, $event)"></div> }</div><button class="btn btn-success mt-4" [disabled]="saving()" (click)="save()">{{ saving() ? 'Enregistrement…' : 'Enregistrer l’inspection' }}</button><button class="btn btn-link mt-4" (click)="closeForm()">Annuler</button></div></section> }

    @if (photoInspection()) { <section class="card form-card mt-4"><div class="card-body"><div class="d-flex justify-content-between"><div><p class="eyebrow mb-1">PHOTOS</p><h2 class="h4">Ajouter des photos — inspection de {{ label(photoInspection().inspection_type).toLowerCase() }}</h2></div><button class="btn-close" (click)="closePhotoForm()"></button></div><div class="row g-3">@for (photo of photoTypes; track photo.key) { <div class="col-md"><label>{{ photo.label }}</label><input class="form-control" type="file" accept="image/png,image/jpeg,image/webp" (change)="choose(photo.key, $event)"></div> }</div><button class="btn btn-success mt-4" [disabled]="saving()" (click)="savePhotos()">{{ saving() ? 'Envoi…' : 'Ajouter les photos' }}</button><button class="btn btn-link mt-4" (click)="closePhotoForm()">Annuler</button></div></section> }

    @if (selected()) { <section class="card form-card inspection-sheet mt-4"><div class="card-body"><div class="d-flex justify-content-between gap-2"><div><p class="eyebrow mb-1">HISTORIQUE</p><h2 class="h4">Inspection de {{ label(selected().inspection_type).toLowerCase() }}</h2><p class="text-muted">{{ selected().vehicle?.make }} {{ selected().vehicle?.model }} · {{ selected().vehicle?.registration_number }}</p></div><button class="btn-close" (click)="selected.set(null)"></button></div><div class="row g-3"><div class="col-md-4"><strong>Date</strong><br>{{ selected().inspection_date | date:'medium' }}</div><div class="col-md-4"><strong>Kilométrage</strong><br>{{ selected().mileage }} km</div><div class="col-md-4"><strong>Carburant</strong><br>{{ selected().fuel_level || 'Non renseigné' }}</div><div class="col-md-6"><strong>Dommages</strong><br>{{ damages(selected()) }}</div><div class="col-md-6"><strong>Observations</strong><br>{{ selected().observations || 'Aucune observation.' }}</div></div><hr><h3 class="h6">Photos ajoutées</h3>@if (!photos().length) { <p class="text-muted">Aucune photo ajoutée.</p> } @else { <div class="row g-3">@for (photo of photos(); track photo.id) { <div class="col-sm-6 col-lg-4"><img class="inspection-photo" [src]="photo.url" [alt]="photoLabel(photo.photo_type)"><div class="d-flex justify-content-between align-items-center mt-2"><strong>{{ photoLabel(photo.photo_type) }}</strong><button class="btn btn-sm btn-outline-primary" (click)="openPhoto(photo)">Voir</button></div></div> }</div> }</div></section> }
    </div>
  `
})
export class ClientInspectionsComponent implements OnInit {
  readonly photoTypes = photoTypes;
  inspections = signal<any[]>([]); rentals = signal<any[]>([]); form = signal<any>(null); photoInspection = signal<any>(null); selected = signal<any>(null); photos = signal<any[]>([]);
  loading = signal(false); saving = signal(false); error = signal(''); message = signal(''); private files = new Map<PhotoType, File>();
  constructor(private auth: AuthService) {}
  async ngOnInit() { await this.load(); }
  label(type: string) { return type === 'departure' ? 'Départ' : 'Retour'; }
  photoLabel(type: string) { return photoTypes.find(photo => photo.key === type)?.label ?? 'Photo complémentaire'; }
  damages(inspection: any) { return Array.isArray(inspection?.damages) && inspection.damages.length ? inspection.damages.join('; ') : 'Aucun dommage signalé.'; }
  availableActions() {
    const actions: { rental: any; type: 'departure' | 'return' }[] = [];
    for (const rental of this.rentals()) {
      if (!rental.has_departure && rental.status === 'pending') actions.push({ rental, type: 'departure' });
      if (rental.has_departure && !rental.has_return && ['active', 'overdue'].includes(rental.status) && this.isReturnDay(rental.return_date)) actions.push({ rental, type: 'return' });
    }
    return actions;
  }
  isReturnDay(returnDate: string) {
    if (!returnDate) return false;
    const today = new Date();
    const expected = new Date(returnDate);
    return today.getFullYear() === expected.getFullYear() && today.getMonth() === expected.getMonth() && today.getDate() === expected.getDate();
  }
  async load() {
    this.loading.set(true); this.error.set('');
    const [history, rentals] = await Promise.all([this.auth.supabase().rpc('client_inspection_history'), this.auth.supabase().rpc('client_inspection_eligible_rentals')]);
    this.loading.set(false);
    if (history.error || rentals.error) { this.error.set(this.auth.errorMessage(history.error ?? rentals.error)); return; }
    this.inspections.set(history.data ?? []); this.rentals.set(rentals.data ?? []);
  }
  openForm(rental: any, inspectionType: 'departure' | 'return') { window.scrollTo({ top: 0, behavior: 'smooth' }); this.error.set(''); this.message.set(''); this.selected.set(null); this.files.clear(); this.form.set({ rental, inspection_type: inspectionType, mileage: 0, fuel_level: '', damagesText: '', observations: '' }); setTimeout(() => document.querySelector('.form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }
  closeForm() { this.form.set(null); this.files.clear(); }
  openPhotoForm(inspection: any) { this.error.set(''); this.message.set(''); this.form.set(null); this.files.clear(); this.photoInspection.set(inspection); }
  closePhotoForm() { this.photoInspection.set(null); this.files.clear(); }
  choose(type: PhotoType, event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (file) this.files.set(type, file); }
  async save() {
    const form = this.form(); if (!form || Number(form.mileage) < 0) { this.error.set('Un kilométrage valide est obligatoire.'); return; }
    this.saving.set(true); this.error.set(''); this.message.set('');
    try {
      const result = await this.auth.supabase().rpc('client_create_inspection', { target_rental_id: form.rental.id, target_inspection_type: form.inspection_type, target_mileage: Number(form.mileage), target_fuel_level: form.fuel_level || null, target_observations: form.observations || null, target_damages: form.damagesText ? form.damagesText.split('\n').map((line: string) => line.trim()).filter(Boolean) : [] });
      if (result.error) throw result.error;
      await this.uploadPhotos(result.data.id);
      this.closeForm(); this.message.set('Inspection enregistrée. Elle est maintenant visible dans votre historique et dans celui du Responsable.'); await this.load();
    } catch (error) { this.error.set(this.auth.errorMessage(error)); } finally { this.saving.set(false); }
  }
  async savePhotos() {
    const inspection = this.photoInspection();
    if (!inspection) return;
    if (!this.files.size) { this.error.set('Choisissez au moins une photo avant l’envoi.'); return; }
    this.saving.set(true); this.error.set(''); this.message.set('');
    try { await this.uploadPhotos(inspection.id); this.closePhotoForm(); this.message.set('Photos ajoutées à l’inspection.'); await this.load(); await this.show(inspection); }
    catch (error) { this.error.set(this.auth.errorMessage(error)); } finally { this.saving.set(false); }
  }
  private async uploadPhotos(inspectionId: string) {
    for (const [type, file] of this.files) {
      const path = `inspections/${inspectionId}/${type}-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const form = new FormData(); form.append('inspection_id', inspectionId); form.append('photo_type', type); form.append('file', file, file.name);
      const result = await this.auth.supabase().functions.invoke('client-inspection-photo', { body: form });
      const upload = result.error;
      if (upload) throw upload;
    }
  }
  async show(inspection: any) {
    this.error.set(''); this.selected.set(inspection); this.photos.set([]);
    setTimeout(() => document.querySelector('.client-page .inspection-sheet')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    const result = await this.auth.supabase().functions.invoke('client-inspection-photo', { body: { inspection_id: inspection.id } });
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    this.photos.set(result.data?.photos ?? []);
  }
  async openPhoto(photo: any) { const result = await this.auth.supabase().storage.from('inspection-photos').createSignedUrl(photo.storage_path, 60); if (result.error) this.error.set(this.auth.errorMessage(result.error)); else window.open(result.data.signedUrl, '_blank', 'noopener'); }
}
