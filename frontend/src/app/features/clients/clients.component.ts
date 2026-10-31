import { Component, OnInit, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { recognize } from 'tesseract.js';
import { AuthService } from '../../core/auth.service';
import { ClientsService } from '../../core/data/clients.service';
import { StorageService } from '../../core/data/storage.service';
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
  constructor(
    public auth: AuthService,
    private clients: ClientsService,
    private storage: StorageService,
  ) {}
  ngOnInit() {
    this.load();
  }
  async load() {
    this.loading.set(true);
    const r = await this.clients.search(this.query);
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
    const [d, r] = await Promise.all([this.clients.documents(c.id), this.clients.rentals(c.id)]);
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
    const r = await this.clients.save(value);
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
    const existing = this.documents().some((d) => d.document_name === file.name);
    if (existing) return;
    const failure = await this.clients.uploadDocument(clientId, 'identity_document', file);
    if (failure) this.error.set(this.auth.errorMessage(failure));
    else
      this.message.set(
        'L’image originale de la pièce a été conservée dans les documents privés du client.',
      );
  }
  async upload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0],
      c = this.edit();
    if (!file || !c?.id) return;
    const failure = await this.clients.uploadDocument(c.id, 'document', file);
    if (failure) this.error.set(this.auth.errorMessage(failure));
    else await this.open(c);
  }
  async download(d: any, event: Event) {
    event.preventDefault();
    const r = await this.storage.signedUrl('rental-documents', d.storage_path);
    if (r.error) this.error.set(this.auth.errorMessage(r.error));
    else window.open(r.data.signedUrl, '_blank', 'noopener');
  }
}
