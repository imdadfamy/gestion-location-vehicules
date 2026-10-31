import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

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
  constructor(public auth: AuthService) {}
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
    let q = this.auth
      .supabase()
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false });
    if (this.query.trim())
      q = q.or(
        'registration_number.ilike.%' +
          this.query.trim() +
          '%,make.ilike.%' +
          this.query.trim() +
          '%,model.ilike.%' +
          this.query.trim() +
          '%',
      );
    const r = await q;
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
  async open(v: any) {
    this.clear();
    this.editing.set({ ...v });
    const r = await this.auth
      .supabase()
      .from('vehicle_documents')
      .select('*')
      .eq('vehicle_id', v.id)
      .order('created_at', { ascending: false });
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
        const url = await this.auth
          .supabase()
          .storage.from('rental-documents')
          .createSignedUrl(d.storage_path, 600);
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
    const r = v.id
      ? await this.auth.supabase().from('vehicles').update(v).eq('id', v.id).select().single()
      : await this.auth.supabase().from('vehicles').insert(v).select().single();
    this.saving.set(false);
    if (r.error) {
      this.error.set(this.auth.errorMessage(r.error));
      return;
    }
    this.message.set(
      v.id
        ? 'Informations du véhicule mises à jour.'
        : 'Véhicule ajouté. Ajoutez ensuite ses documents ou photos depuis sa fiche.',
    );
    if (r.data) await this.open(r.data);
    await this.load();
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
    const files = await this.auth
      .supabase()
      .from('vehicle_documents')
      .select('storage_path')
      .eq('vehicle_id', v.id);
    const r = await this.auth.supabase().from('vehicles').delete().eq('id', v.id);
    this.saving.set(false);
    if (r.error) {
      this.error.set(this.auth.errorMessage(r.error));
      return;
    }
    const paths = (files.data ?? []).map((d: any) => d.storage_path);
    if (paths.length) {
      const cleanup = await this.auth.supabase().storage.from('rental-documents').remove(paths);
      if (cleanup.error)
        this.message.set(
          'Véhicule retiré. Certains fichiers associés devront être supprimés depuis Storage.',
        );
    }
    this.close();
    this.message.set(this.message() || 'Véhicule retiré définitivement.');
    await this.load();
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
      const path =
        'vehicles/' +
        v.id +
        '/' +
        crypto.randomUUID() +
        '-' +
        file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const up = await this.auth
        .supabase()
        .storage.from('rental-documents')
        .upload(path, file, { contentType: file.type });
      if (up.error) {
        this.error.set(this.auth.errorMessage(up.error));
        continue;
      }
      const saved = await this.auth.supabase().from('vehicle_documents').insert({
        vehicle_id: v.id,
        document_type: type,
        document_name: file.name,
        storage_path: path,
        mime_type: file.type,
        file_size: file.size,
      });
      if (saved.error) this.error.set(this.auth.errorMessage(saved.error));
      else count++;
    }
    this.saving.set(false);
    (event.target as HTMLInputElement).value = '';
    if (count) this.message.set(count + ' fichier' + (count > 1 ? 's ajoutés.' : ' ajouté.'));
    await this.open(v);
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
