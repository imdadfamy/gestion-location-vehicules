import { Component, ElementRef, OnInit, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';

type DocumentKind = 'identity_document' | 'driving_license';

@Component({
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .form-card { max-width:980px; }
    .form-card label { display:block; font-size:.88rem; font-weight:700; margin-bottom:6px; }
    .form-card .form-control { min-height:45px; border-radius:12px; transition:border-color .2s ease,box-shadow .2s ease; }
    .form-card .form-control:focus { border-color:#0792a4; box-shadow:0 0 0 4px rgba(7,146,164,.15); }
    .progress{border-radius:999px;overflow:hidden}.progress-bar{background:#0792a4}
    .document-card { border:1px solid #dce8ea; border-radius:14px; padding:14px; background:#f8fbfb; transition:box-shadow .2s ease; }
    .document-card:hover{box-shadow:0 8px 20px rgba(16,47,56,.08)}
    .document-name { overflow-wrap:anywhere; font-size:.92rem; }
    .document-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
    @media(max-width:575px) {
      .form-card .card-body { padding:18px; }
      .form-card .row { --bs-gutter-y:.8rem; }
      .form-card .btn-primary { width:100%; min-height:48px; }
      .form-card hr { margin:24px 0; }
      .form-card .small, .document-name { overflow-wrap:anywhere; }
      .document-actions .btn { flex:1 1 auto; min-height:42px; }
    }
  `],
  template: `
    <div class="page-heading"><div><p class="eyebrow">MON DOSSIER</p><h1>Mes informations</h1><p>Ces informations restent modifiables et compléteront votre contrat.</p><div class="progress mt-3" style="height:10px"><div class="progress-bar" role="progressbar" [style.width.%]="completionPercent()" [attr.aria-valuenow]="completionPercent()" aria-valuemin="0" aria-valuemax="100"></div></div><p class="small text-muted mt-1">Dossier complet : {{completionPercent()}} %</p></div></div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    @if (message()) { <div class="alert alert-success">{{ message() }}</div> }
    @if (loading()) { <div class="empty-state">Chargement de votre dossier…</div> }
    @else if (form()) {
      <section class="card form-card"><div class="card-body">
        <h2 class="h6 mt-2">Identité</h2><div class="row g-3">
          <div class="col-md-6"><label>Prénom <span class="required">*</span></label><input class="form-control" [(ngModel)]="form()!.first_name"></div>
          <div class="col-md-6"><label>Nom <span class="required">*</span></label><input class="form-control" [(ngModel)]="form()!.last_name"></div>
          <div class="col-md-6"><label>Téléphone <span class="required">*</span></label><input class="form-control" type="tel" autocomplete="tel" required [(ngModel)]="form()!.phone"></div>
          <div class="col-md-6"><label>E-mail</label><input class="form-control" type="email" [(ngModel)]="form()!.email"></div>
          <div class="col-md-4"><label>Type de pièce</label><select class="form-select" [(ngModel)]="form()!.id_document_type"><option value="">Sélectionner</option><option value="CNI">CNI</option><option value="Passeport">Passeport</option><option value="Carte de séjour">Carte de séjour</option></select></div>
          <div class="col-md-4"><label>Numéro de pièce</label><input class="form-control" [(ngModel)]="form()!.id_document_number"></div>
          <div class="col-md-4"><label>Résidence</label><input class="form-control" [(ngModel)]="form()!.residence"></div>
          <div class="col-12"><label>Adresse / maison / quartier</label><input class="form-control" [(ngModel)]="form()!.address"></div>
          <div class="col-12"><h2 class="h6 mt-3">Permis de conduire</h2></div><div class="col-md-4"><label>Numéro de permis</label><input class="form-control" [(ngModel)]="form()!.driving_license_number"></div>
          <div class="col-md-4"><label>Date de délivrance</label><input class="form-control" type="date" [(ngModel)]="form()!.driving_license_issue_date"></div>
          <div class="col-md-4"><label>Expiration du permis</label><input class="form-control" type="date" [(ngModel)]="form()!.driving_license_expiry_date"></div>
          <div class="col-md-6"><label>Contact d’urgence</label><input class="form-control" [(ngModel)]="form()!.emergency_contact_name"></div>
          <div class="col-md-6"><label>Numéro d’urgence</label><input class="form-control" [(ngModel)]="form()!.emergency_contact_phone"></div>
        </div>

        <hr><h2 class="h6">Pièces justificatives</h2>
        <p class="text-muted small">Vos champs sont enregistrés avant l’ajout d’un fichier. Vous pouvez remplacer ou retirer une pièce à tout moment avant la signature du contrat.</p>
        <h2 class="h6 mt-2">Identité</h2><div class="row g-3">
          @for (kind of documentKinds; track kind.type) {
            <div class="col-md-6">
              <label>{{ kind.label }}</label><p class="small text-muted mb-1">JPG, PNG ou PDF, 5 Mo max</p>
              <input class="form-control" type="file" accept="image/*,.pdf" (change)="upload($event, kind.type)">
              @if (documentsFor(kind.type).length) {
                <div class="mt-2 d-grid gap-2">
                  @for (document of documentsFor(kind.type); track document.id) {
                    <div class="document-card">
                      <div class="document-name"><strong>{{ document.document_name }}</strong></div>
                      <div class="document-actions">
                        <button type="button" class="btn btn-sm btn-outline-primary" (click)="view(document)">Voir</button>
                        <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="saving()" (click)="replace(document, kind.type)">Remplacer</button>
                        <button type="button" class="btn btn-sm btn-outline-danger" [disabled]="saving()" (click)="remove(document)">Retirer</button>
                      </div>
                    </div>
                  }
                </div>
              } @else { <p class="small text-muted mt-2 mb-0">Aucun document ajouté.</p> }
            </div>
          }
        </div>
        <input #replacementInput class="d-none" type="file" accept="image/*,.pdf" (change)="uploadReplacement($event)">
        <button class="btn btn-primary mt-4" [disabled]="saving()" (click)="save()">{{ saving() ? 'Enregistrement…' : 'Enregistrer mon dossier' }}</button>
      </div></section>
    }
  `
})
export class ClientAccountComponent implements OnInit {
  @ViewChild('replacementInput') replacementInput?: ElementRef<HTMLInputElement>;
  form = signal<any>(null); documents = signal<any[]>([]); loading = signal(false); saving = signal(false); error = signal(''); message = signal('');
  replacement?: { document: any; type: DocumentKind };
  readonly documentKinds: { type: DocumentKind; label: string }[] = [
    { type: 'identity_document', label: 'Pièce d’identité' },
    { type: 'driving_license', label: 'Permis de conduire' }
  ];
  constructor(private auth: AuthService) {}
  async ngOnInit() { await this.load(); }

  documentsFor(type: DocumentKind) { return this.documents().filter(document => document.document_type === type); }
  async load() {
    this.loading.set(true); this.error.set('');
    const profile = this.auth.profile();
    const result = await this.auth.supabase().from('clients').select('*').eq('profile_id', profile.id).maybeSingle();
    this.loading.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    if (!result.data) {
      this.form.set({ first_name: profile.first_name || profile.full_name?.split(' ')[0] || '', last_name: profile.last_name || profile.full_name?.split(' ').slice(1).join(' ') || '', phone: '', email: profile.email || '' });
      this.documents.set([]); return;
    }
    this.form.set({ ...result.data });
    const documentsResult = await this.auth.supabase().from('client_documents').select('*').eq('client_id', result.data.id).order('created_at', { ascending: false });
    if (documentsResult.error) this.error.set(this.auth.errorMessage(documentsResult.error)); else this.documents.set(documentsResult.data ?? []);
  }
  completionPercent(){const f=this.form();if(!f)return 0;const fields=[f.first_name,f.last_name,f.phone,f.email,f.id_document_type,f.id_document_number,f.residence,f.address,f.driving_license_number,f.driving_license_issue_date,f.driving_license_expiry_date,f.emergency_contact_name,f.emergency_contact_phone];const filled=fields.filter(Boolean).length;return Math.round((filled/fields.length)*100);}
  async persistForUpload() {
    const form = this.form();
    if (!form?.first_name?.trim() || !form.last_name?.trim() || !form.phone?.trim()) { this.error.set('Prénom, nom et téléphone sont obligatoires avant l’ajout d’une pièce.'); return null; }
    if (form.driving_license_issue_date && form.driving_license_expiry_date && new Date(form.driving_license_expiry_date).getTime() <= new Date(form.driving_license_issue_date).getTime()) { this.error.set('La date d expiration du permis doit etre posterieure a sa date de delivrance.'); return null; }
    this.saving.set(true); let result: any;
    if (form.id) result = await this.auth.supabase().from('clients').update({ ...form, profile_id: this.auth.profile().id }).eq('id', form.id).select().single();
    else result = await this.auth.supabase().rpc('ensure_client_profile', { target_first_name: form.first_name, target_last_name: form.last_name, target_phone: form.phone, target_email: form.email || null });
    this.saving.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return null; }
    this.error.set(''); this.form.set(result.data); await this.auth.load(); return result.data;
  }
  async save() { const saved = await this.persistForUpload(); if (saved) { this.error.set(''); this.message.set('Votre dossier a été enregistré.'); } }
  replace(document: any, type: DocumentKind) {
    this.replacement = { document, type };
    this.replacementInput?.nativeElement.click();
  }
  async uploadReplacement(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0], replacement = this.replacement;
    (event.target as HTMLInputElement).value = ''; this.replacement = undefined;
    if (!file || !replacement) return;
    await this.uploadFile(file, replacement.type, replacement.document);
  }
  async upload(event: Event, type: DocumentKind) {
    const file = (event.target as HTMLInputElement).files?.[0]; (event.target as HTMLInputElement).value = '';
    if (file) await this.uploadFile(file, type);
  }
  async uploadFile(file: File, type: DocumentKind, replacedDocument?: any) {
    this.error.set(''); this.message.set('');
    const form = await this.persistForUpload(); if (!form) return;
    this.saving.set(true);
    const path = `clients/${form.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const upload = await this.auth.supabase().storage.from('rental-documents').upload(path, file, { contentType: file.type });
    if (upload.error) { this.saving.set(false); this.error.set(this.auth.errorMessage(upload.error)); return; }
    const inserted = await this.auth.supabase().from('client_documents').insert({ client_id: form.id, document_type: type, document_name: file.name, storage_path: path, mime_type: file.type, file_size: file.size, uploaded_by: this.auth.profile().id }).select().single();
    if (inserted.error) { this.saving.set(false); this.error.set(this.auth.errorMessage(inserted.error)); return; }
    this.documents.update(documents => [inserted.data, ...documents]);
    if (replacedDocument) await this.remove(replacedDocument, true);
    this.saving.set(false); this.error.set(''); this.message.set(replacedDocument ? 'La pièce a été remplacée.' : 'Pièce ajoutée. Les informations du formulaire ont été conservées.');
  }
  async remove(document: any, replacing = false) {
    if (!replacing && !window.confirm(`Retirer définitivement « ${document.document_name} » ?`)) return;
    this.saving.set(true); this.error.set('');
    const storage = await this.auth.supabase().storage.from('rental-documents').remove([document.storage_path]);
    if (storage.error) { this.saving.set(false); this.error.set(this.auth.errorMessage(storage.error)); return; }
    const result = await this.auth.supabase().from('client_documents').delete().eq('id', document.id);
    this.saving.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    this.documents.update(documents => documents.filter(row => row.id !== document.id));
    if (!replacing) { this.error.set(''); this.message.set('La pièce a été retirée.'); }
  }
  async view(document: any) {
    this.error.set(''); const result = await this.auth.supabase().storage.from('rental-documents').createSignedUrl(document.storage_path, 60);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    window.open(result.data.signedUrl, '_blank', 'noopener');
  }
}



