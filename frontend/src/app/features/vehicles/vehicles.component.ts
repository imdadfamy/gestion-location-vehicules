import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { StorageService } from '../../core/data/storage.service';
import { VehiclesService } from '../../core/data/vehicles.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  styleUrl: './vehicles.component.scss',
  templateUrl: './vehicles.component.html',
})
export class VehiclesComponent implements OnInit {
  rows = signal<any[]>([]);
  editing = signal<any>(null);
  documents = signal<any[]>([]);
  photos = signal<any[]>([]);
  error = signal('');
  message = signal('');
  loading = signal(false);
  saving = signal(false);
  query = '';
  constructor(
    public auth: AuthService,
    private vehicles: VehiclesService,
    private storage: StorageService,
  ) {}
  ngOnInit() {
    this.load();
  }
  private clear() {
    this.error.set('');
    this.message.set('');
  }
  async load() {
    this.loading.set(true);
    this.clear();
    const r = await this.vehicles.search(this.query);
    this.rows.set(r.data ?? []);
    if (r.error) this.error.set(this.auth.errorMessage(r.error));
    this.loading.set(false);
  }
  newVehicle() {
    this.clear();
    this.editing.set({ status: 'available', mileage: 0, rental_price: 0, deposit_amount: 0 });
    this.documents.set([]);
    this.photos.set([]);
  }
  close() {
    this.editing.set(null);
    this.documents.set([]);
    this.photos.set([]);
  }
  async open(v: any, keepFeedback = false) {
    if (!keepFeedback) this.clear();
    this.editing.set({ ...v });
    const r = await this.vehicles.documents(v.id);
    if (r.error) {
      this.error.set(this.auth.errorMessage(r.error));
      return;
    }
    const files = r.data ?? [];
    const pictures = files.filter(
      (d: any) => d.document_type === 'photo' || String(d.mime_type ?? '').startsWith('image/'),
    );
    this.documents.set(files.filter((d: any) => !pictures.includes(d)));
    const withUrls = await Promise.all(
      pictures.map(async (d: any) => {
        const url = await this.storage.signedUrl('rental-documents', d.storage_path, 600);
        return { ...d, url: url.data?.signedUrl ?? '' };
      }),
    );
    this.photos.set(withUrls);
  }
  async save() {
    this.clear();
    const v = this.editing();
    if (!v?.registration_number?.trim() || !v?.make?.trim() || !v?.model?.trim()) {
      this.error.set('Immatriculation, marque et modèle sont obligatoires.');
      return;
    }
    this.saving.set(true);
    const r = await this.vehicles.save(v);
    this.saving.set(false);
    if (r.error) {
      this.error.set(this.auth.errorMessage(r.error));
      return;
    }
    if (r.data) await this.open(r.data, true);
    await this.load();
    this.message.set(
      v.id
        ? 'Informations du véhicule mises à jour.'
        : 'Véhicule ajouté. Ajoutez ensuite ses documents ou photos depuis sa fiche.',
    );
  }
  async remove() {
    const v = this.editing();
    if (!v?.id) return;
    if (
      !window.confirm(
        'Retirer définitivement ce véhicule ? Cette action est impossible si le véhicule est lié à une location, une réservation, une inspection ou un historique.',
      )
    )
      return;
    this.clear();
    this.saving.set(true);
    const r = await this.vehicles.remove(v.id);
    this.saving.set(false);
    if (r.error) {
      this.error.set(this.auth.errorMessage(r.error));
      return;
    }
    this.close();
    await this.load();
    this.message.set(
      r.filesCleaned
        ? 'Véhicule retiré définitivement.'
        : 'Véhicule retiré. Certains fichiers associés devront être supprimés depuis Storage.',
    );
  }
  async uploadFiles(event: Event, type: 'document' | 'photo') {
    const v = this.editing();
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    if (!v?.id || !files.length) return;
    this.clear();
    if (type === 'photo' && files.some((file) => !file.type.startsWith('image/'))) {
      this.error.set('La zone Photos accepte uniquement des images.');
      return;
    }
    this.saving.set(true);
    let count = 0;
    for (const file of files) {
      const failure = await this.vehicles.uploadDocument(v.id, type, file);
      if (failure) this.error.set(this.auth.errorMessage(failure));
      else count++;
    }
    this.saving.set(false);
    (event.target as HTMLInputElement).value = '';
    await this.open(v, true);
    if (count) this.message.set(count + ' fichier' + (count > 1 ? 's ajoutés.' : ' ajouté.'));
  }
  async download(d: any, event: Event) {
    event.preventDefault();
    const r = await this.storage.signedUrl('rental-documents', d.storage_path);
    if (r.error) this.error.set(this.auth.errorMessage(r.error));
    else window.open(r.data.signedUrl, '_blank', 'noopener');
  }
  statusTone(s: string) {
    return (
      (
        {
          available: 'success',
          on_rental: 'primary',
          maintenance: 'warning',
          unavailable: 'secondary',
        } as Record<string, string>
      )[s] ?? 'secondary'
    );
  }
  statusLabel(s: string) {
    return (
      (
        {
          available: 'Disponible',
          on_rental: 'En location',
          maintenance: 'Maintenance',
          unavailable: 'Indisponible',
        } as Record<string, string>
      )[s] ?? s
    );
  }
}
