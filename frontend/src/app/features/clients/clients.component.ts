import { Component, OnInit, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { recognize } from 'tesseract.js';
import { AuthService } from '../../core/auth.service';
import { DigitsOnlyDirective } from '../../shared/digits-only.directive';

@Component({
  standalone: true,
  imports: [FormsModule, SlicePipe, DigitsOnlyDirective],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss',
})
export class ClientsComponent implements OnInit {
  rows = signal<any[]>([]);
  edit = signal<any>(null);
  documents = signal<any[]>([]);
  rentals = signal<any[]>([]);
  error = signal('');
  message = signal('');
  loading = signal(false);
  saving = signal(false);
  scanning = signal(false);
  scanFileName = signal('');
  query = '';
  private identityFile?: File;
  constructor(public auth: AuthService) {}
  ngOnInit() {
    this.load();
  }
  async load() {
    this.loading.set(true);
    let q = this.auth.supabase().from('clients').select('*').order('last_name');
    if (this.query.trim())
      q = q.or(
        `first_name.ilike.%${this.query.trim()}%,last_name.ilike.%${this.query.trim()}%,phone.ilike.%${this.query.trim()}%,email.ilike.%${this.query.trim()}%`,
      );
    const r = await q;
    this.rows.set(r.data ?? []);
    this.error.set(r.error ? this.auth.errorMessage(r.error) : '');
    this.loading.set(false);
  }
  newClient() {
    this.edit.set({});
    this.documents.set([]);
    this.rentals.set([]);
    this.identityFile = undefined;
    this.scanFileName.set('');
    this.message.set('');
  }
  async open(c: any) {
    this.edit.set({ ...c });
    this.identityFile = undefined;
    this.scanFileName.set('');
    const [d, r] = await Promise.all([
      this.auth
        .supabase()
        .from('client_documents')
        .select('*')
        .eq('client_id', c.id)
        .order('created_at', { ascending: false }),
      this.auth
        .supabase()
        .from('rentals')
        .select('id,status,departure_date,return_date,vehicles(registration_number)')
        .eq('client_id', c.id)
        .order('departure_date', { ascending: false }),
    ]);
    this.documents.set(d.data ?? []);
    this.rentals.set(r.data ?? []);
    this.error.set(
      d.error ? this.auth.errorMessage(d.error) : r.error ? this.auth.errorMessage(r.error) : '',
    );
  }
  async scanIdentity(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.identityFile = file;
    this.scanFileName.set(file.name);
    this.scanning.set(true);
    this.error.set('');
    this.message.set('Lecture de la pièce en cours…');
    try {
      const result = await recognize(file, 'fra+eng');
      const extracted = this.extract(result.data.text);
      const current = this.edit() ?? {};
      this.edit.set({
        ...current,
        first_name: current.first_name || extracted.first_name || '',
        last_name: current.last_name || extracted.last_name || '',
        id_document_number: current.id_document_number || extracted.id_document_number || '',
      });
      const count = Object.values(extracted).filter(Boolean).length;
      this.message.set(
        count
          ? `Lecture terminée : ${count} information(s) proposée(s). Vérifiez et corrigez les champs avant l’enregistrement.`
          : 'Lecture terminée. Aucun champ n’a pu être identifié automatiquement : saisissez-les manuellement.',
      );
      if (current.id) await this.archiveIdentity(file, current.id);
    } catch {
      this.error.set(
        'La lecture automatique de la pièce a échoué. Vous pouvez remplir tous les champs manuellement et enregistrer l’image comme document.',
      );
    } finally {
      this.scanning.set(false);
    }
  }
  private extract(text: string) {
    const clean = text.replace(/\r/g, '\n');
    const pick = (patterns: RegExp[]) =>
      patterns.map((p) => clean.match(p)?.[1]?.trim()).find(Boolean) || '';
    const last = pick([/\b(?:NOM|SURNAME)\s*[:\-]?\s*([^\n]+)/i]);
    const first = pick([/\b(?:PR[ÉE]NOM(?:S)?|GIVEN\s*NAMES?)\s*[:\-]?\s*([^\n]+)/i]);
    const id = pick([
      /\b(?:N[°O]|NUM[ÉE]RO|NO|ID)\s*(?:D['’ ]?IDENTIT[ÉE])?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\- ]{4,})/i,
    ]);
    return {
      first_name: first.replace(/[^\p{L} '\-]/gu, '').trim(),
      last_name: last.replace(/[^\p{L} '\-]/gu, '').trim(),
      id_document_number: id.replace(/\s+/g, ' ').trim(),
    };
  }
  async save() {
    const value = this.edit();
    if (!value?.first_name?.trim() || !value?.last_name?.trim() || !value?.phone?.trim()) {
      this.error.set('Veuillez renseigner le prénom, le nom et le téléphone du client.');
      return;
    }
    this.saving.set(true);
    const r = value.id
      ? await this.auth
          .supabase()
          .from('clients')
          .update(value)
          .eq('id', value.id)
          .select()
          .single()
      : await this.auth.supabase().from('clients').insert(value).select().single();
    this.saving.set(false);
    if (r.error) {
      this.error.set(this.auth.errorMessage(r.error));
      return;
    }
    if (this.identityFile && r.data?.id) await this.archiveIdentity(this.identityFile, r.data.id);
    if (r.data) await this.open(r.data);
    else this.edit.set(null);
    await this.load();
  }
  async archiveIdentity(file: File, clientId: string) {
    const path = `clients/${clientId}/${crypto.randomUUID()}-${file.name}`;
    const existing = this.documents().some((d) => d.storage_path?.endsWith(file.name));
    if (existing) return;
    const s = await this.auth
      .supabase()
      .storage.from('rental-documents')
      .upload(path, file, { contentType: file.type });
    if (s.error) {
      this.error.set(this.auth.errorMessage(s.error));
      return;
    }
    const r = await this.auth.supabase().from('client_documents').insert({
      client_id: clientId,
      document_type: 'identity_document',
      document_name: file.name,
      storage_path: path,
      mime_type: file.type,
      file_size: file.size,
    });
    if (r.error) this.error.set(this.auth.errorMessage(r.error));
    else
      this.message.set(
        'L’image originale de la pièce a été conservée dans les documents privés du client.',
      );
  }
  async upload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0],
      c = this.edit();
    if (!file || !c?.id) return;
    const path = `clients/${c.id}/${crypto.randomUUID()}-${file.name}`;
    const s = await this.auth
      .supabase()
      .storage.from('rental-documents')
      .upload(path, file, { contentType: file.type });
    if (s.error) {
      this.error.set(this.auth.errorMessage(s.error));
      return;
    }
    const r = await this.auth.supabase().from('client_documents').insert({
      client_id: c.id,
      document_type: 'document',
      document_name: file.name,
      storage_path: path,
      mime_type: file.type,
      file_size: file.size,
    });
    if (r.error) this.error.set(this.auth.errorMessage(r.error));
    else await this.open(c);
  }
  async download(d: any, event: Event) {
    event.preventDefault();
    const r = await this.auth
      .supabase()
      .storage.from('rental-documents')
      .createSignedUrl(d.storage_path, 60);
    if (r.error) this.error.set(this.auth.errorMessage(r.error));
    else window.open(r.data.signedUrl, '_blank', 'noopener');
  }
}
