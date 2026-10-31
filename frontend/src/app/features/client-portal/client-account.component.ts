import { Component, ElementRef, OnInit, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DigitsOnlyDirective } from '../../shared/digits-only.directive';

type DocumentKind = 'identity_document' | 'driving_license';

@Component({
  standalone: true,
  imports: [FormsModule, DigitsOnlyDirective],
  styleUrl: './client-account.component.scss',
  templateUrl: './client-account.component.html',
})
export class ClientAccountComponent implements OnInit {
  @ViewChild('replacementInput') replacementInput?: ElementRef<HTMLInputElement>;
  form = signal<any>(null);
  documents = signal<any[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  message = signal('');
  replacement?: { document: any; type: DocumentKind };
  readonly documentKinds: { type: DocumentKind; label: string }[] = [
    { type: 'identity_document', label: 'Pièce d’identité' },
    { type: 'driving_license', label: 'Permis de conduire' },
  ];
  constructor(private auth: AuthService) {}
  async ngOnInit() {
    await this.load();
  }

  documentsFor(type: DocumentKind) {
    return this.documents().filter((document) => document.document_type === type);
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    const profile = this.auth.profile();
    const result = await this.auth
      .supabase()
      .from('clients')
      .select('*')
      .eq('profile_id', profile.id)
      .maybeSingle();
    this.loading.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    if (!result.data) {
      this.form.set({
        first_name: profile.first_name || profile.full_name?.split(' ')[0] || '',
        last_name: profile.last_name || profile.full_name?.split(' ').slice(1).join(' ') || '',
        phone: '',
        email: profile.email || '',
      });
      this.documents.set([]);
      return;
    }
    this.form.set({ ...result.data });
    const documentsResult = await this.auth
      .supabase()
      .from('client_documents')
      .select('*')
      .eq('client_id', result.data.id)
      .order('created_at', { ascending: false });
    if (documentsResult.error) this.error.set(this.auth.errorMessage(documentsResult.error));
    else this.documents.set(documentsResult.data ?? []);
  }
  completionPercent() {
    const f = this.form();
    if (!f) return 0;
    const fields = [
      f.first_name,
      f.last_name,
      f.phone,
      f.email,
      f.id_document_type,
      f.id_document_number,
      f.residence,
      f.address,
      f.driving_license_number,
      f.driving_license_issue_date,
      f.driving_license_expiry_date,
      f.emergency_contact_name,
      f.emergency_contact_phone,
    ];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }
  async persistForUpload() {
    const form = this.form();
    if (!form?.first_name?.trim() || !form.last_name?.trim() || !form.phone?.trim()) {
      this.error.set('Prénom, nom et téléphone sont obligatoires avant l’ajout d’une pièce.');
      return null;
    }
    if (
      form.driving_license_issue_date &&
      form.driving_license_expiry_date &&
      new Date(form.driving_license_expiry_date).getTime() <=
        new Date(form.driving_license_issue_date).getTime()
    ) {
      this.error.set(
        'La date d expiration du permis doit etre posterieure a sa date de delivrance.',
      );
      return null;
    }
    this.saving.set(true);
    let result: any;
    if (form.id)
      result = await this.auth
        .supabase()
        .from('clients')
        .update({ ...form, profile_id: this.auth.profile().id })
        .eq('id', form.id)
        .select()
        .single();
    else
      result = await this.auth.supabase().rpc('ensure_client_profile', {
        target_first_name: form.first_name,
        target_last_name: form.last_name,
        target_phone: form.phone,
        target_email: form.email || null,
      });
    this.saving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return null;
    }
    this.error.set('');
    this.form.set(result.data);
    await this.auth.load();
    return result.data;
  }
  async save() {
    const saved = await this.persistForUpload();
    if (saved) {
      this.error.set('');
      this.message.set('Votre dossier a été enregistré.');
    }
  }
  replace(document: any, type: DocumentKind) {
    this.replacement = { document, type };
    this.replacementInput?.nativeElement.click();
  }
  async uploadReplacement(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0],
      replacement = this.replacement;
    (event.target as HTMLInputElement).value = '';
    this.replacement = undefined;
    if (!file || !replacement) return;
    await this.uploadFile(file, replacement.type, replacement.document);
  }
  async upload(event: Event, type: DocumentKind) {
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    if (file) await this.uploadFile(file, type);
  }
  async uploadFile(file: File, type: DocumentKind, replacedDocument?: any) {
    this.error.set('');
    this.message.set('');
    const form = await this.persistForUpload();
    if (!form) return;
    this.saving.set(true);
    const path = `clients/${form.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const upload = await this.auth
      .supabase()
      .storage.from('rental-documents')
      .upload(path, file, { contentType: file.type });
    if (upload.error) {
      this.saving.set(false);
      this.error.set(this.auth.errorMessage(upload.error));
      return;
    }
    const inserted = await this.auth
      .supabase()
      .from('client_documents')
      .insert({
        client_id: form.id,
        document_type: type,
        document_name: file.name,
        storage_path: path,
        mime_type: file.type,
        file_size: file.size,
        uploaded_by: this.auth.profile().id,
      })
      .select()
      .single();
    if (inserted.error) {
      this.saving.set(false);
      this.error.set(this.auth.errorMessage(inserted.error));
      return;
    }
    this.documents.update((documents) => [inserted.data, ...documents]);
    if (replacedDocument) await this.remove(replacedDocument, true);
    this.saving.set(false);
    this.error.set('');
    this.message.set(
      replacedDocument
        ? 'La pièce a été remplacée.'
        : 'Pièce ajoutée. Les informations du formulaire ont été conservées.',
    );
  }
  async remove(document: any, replacing = false) {
    if (!replacing && !window.confirm(`Retirer définitivement « ${document.document_name} » ?`))
      return;
    this.saving.set(true);
    this.error.set('');
    const storage = await this.auth
      .supabase()
      .storage.from('rental-documents')
      .remove([document.storage_path]);
    if (storage.error) {
      this.saving.set(false);
      this.error.set(this.auth.errorMessage(storage.error));
      return;
    }
    const result = await this.auth
      .supabase()
      .from('client_documents')
      .delete()
      .eq('id', document.id);
    this.saving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.documents.update((documents) => documents.filter((row) => row.id !== document.id));
    if (!replacing) {
      this.error.set('');
      this.message.set('La pièce a été retirée.');
    }
  }
  async view(document: any) {
    this.error.set('');
    const result = await this.auth
      .supabase()
      .storage.from('rental-documents')
      .createSignedUrl(document.storage_path, 60);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    window.open(result.data.signedUrl, '_blank', 'noopener');
  }
}
