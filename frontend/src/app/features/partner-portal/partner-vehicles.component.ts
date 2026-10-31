import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  styleUrl: './partner-vehicles.component.scss',
  templateUrl: './partner-vehicles.component.html',
})
export class PartnerVehiclesComponent implements OnInit {
  vehicles = signal<any[]>([]);
  form = signal<any>(null);
  photoVehicle = signal<any>(null);
  photos = signal<any[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  message = signal('');
  private partnerId = '';
  constructor(private auth: AuthService) {}

  async ngOnInit() {
    await this.load();
  }

  statusLabel(status: string) {
    return (
      ({ pending: 'En attente', approved: 'Validé', rejected: 'Refusé' } as Record<string, string>)[
        status
      ] ?? status
    );
  }
  statusTone(status: string) {
    return (
      ({ pending: 'warning', approved: 'success', rejected: 'danger' } as Record<string, string>)[
        status
      ] ?? 'secondary'
    );
  }
  money(value: any) {
    return Number(value ?? 0).toLocaleString('fr-FR') + ' FCFA';
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    const partner = await this.auth
      .supabase()
      .from('partners')
      .select('id')
      .eq('profile_id', this.auth.profile()?.id ?? '')
      .maybeSingle();
    this.partnerId = partner.data?.id ?? '';
    const result = await this.auth
      .supabase()
      .from('vehicles')
      .select('*')
      .eq('owner_type', 'partner')
      .order('created_at', { ascending: false });
    this.loading.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.vehicles.set(result.data ?? []);
  }

  openForm() {
    this.error.set('');
    this.message.set('');
    this.form.set({
      registration_number: '',
      make: '',
      model: '',
      color: '',
      year: null,
      fuel_type: '',
      transmission: '',
      category: '',
      partner_requested_price: 0,
      deposit_amount: 0,
      notes: '',
    });
  }
  edit(vehicle: any) {
    this.error.set('');
    this.message.set('');
    this.form.set({ ...vehicle });
  }

  async save() {
    const value = this.form();
    if (
      !value?.registration_number?.trim() ||
      !value.make?.trim() ||
      !value.model?.trim() ||
      !(Number(value.partner_requested_price) > 0)
    ) {
      this.error.set('Immatriculation, marque, modèle et prix souhaité sont obligatoires.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const payload = {
      registration_number: value.registration_number.trim(),
      make: value.make.trim(),
      model: value.model.trim(),
      color: value.color || null,
      year: value.year || null,
      fuel_type: value.fuel_type || null,
      transmission: value.transmission || null,
      category: value.category || null,
      partner_requested_price: Number(value.partner_requested_price),
      deposit_amount: Number(value.deposit_amount || 0),
      notes: value.notes || null,
    };
    const result = value.id
      ? await this.auth.supabase().from('vehicles').update(payload).eq('id', value.id)
      : await this.auth.supabase().from('vehicles').insert(payload);
    this.saving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.form.set(null);
    this.message.set('Véhicule soumis pour évaluation.');
    await this.load();
  }

  async managePhotos(vehicle: any) {
    this.error.set('');
    this.photoVehicle.set(vehicle);
    this.photos.set([]);
    const docs = await this.auth
      .supabase()
      .from('vehicle_documents')
      .select('*')
      .eq('vehicle_id', vehicle.id)
      .eq('document_type', 'photo')
      .order('created_at', { ascending: false });
    if (docs.error) {
      this.error.set(this.auth.errorMessage(docs.error));
      return;
    }
    const withUrls = await Promise.all(
      (docs.data ?? []).map(async (d: any) => {
        const url = await this.auth
          .supabase()
          .storage.from('rental-documents')
          .createSignedUrl(d.storage_path, 600);
        return { ...d, url: url.data?.signedUrl ?? '' };
      }),
    );
    this.photos.set(withUrls);
  }

  async uploadPhotos(event: Event) {
    const vehicle = this.photoVehicle();
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    if (!vehicle || !files.length) return;
    this.error.set('');
    for (const file of files) {
      const path = `vehicles/${vehicle.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const upload = await this.auth
        .supabase()
        .storage.from('rental-documents')
        .upload(path, file, { contentType: file.type });
      if (upload.error) {
        this.error.set(this.auth.errorMessage(upload.error));
        continue;
      }
      const saved = await this.auth.supabase().from('vehicle_documents').insert({
        vehicle_id: vehicle.id,
        document_type: 'photo',
        document_name: file.name,
        storage_path: path,
        mime_type: file.type,
        file_size: file.size,
      });
      if (saved.error) this.error.set(this.auth.errorMessage(saved.error));
    }
    (event.target as HTMLInputElement).value = '';
    await this.managePhotos(vehicle);
  }
}
