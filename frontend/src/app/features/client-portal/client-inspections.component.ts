import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';

type PhotoType = 'front' | 'rear' | 'left_side' | 'right_side' | 'interior';
const photoTypes: { key: PhotoType; label: string }[] = [
  { key: 'front', label: 'Avant' },
  { key: 'rear', label: 'Arrière' },
  { key: 'left_side', label: 'Côté gauche' },
  { key: 'right_side', label: 'Côté droit' },
  { key: 'interior', label: 'Intérieur' },
];

@Component({
  standalone: true,
  imports: [DatePipe, FormsModule],
  styleUrl: './client-inspections.component.scss',
  templateUrl: './client-inspections.component.html',
})
export class ClientInspectionsComponent implements OnInit {
  readonly photoTypes = photoTypes;
  inspections = signal<any[]>([]);
  rentals = signal<any[]>([]);
  form = signal<any>(null);
  photoInspection = signal<any>(null);
  selected = signal<any>(null);
  photos = signal<any[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  message = signal('');
  private files = new Map<PhotoType, File>();
  constructor(private auth: AuthService) {}
  async ngOnInit() {
    await this.load();
  }
  label(type: string) {
    return type === 'departure' ? 'Départ' : 'Retour';
  }
  photoLabel(type: string) {
    return photoTypes.find((photo) => photo.key === type)?.label ?? 'Photo complémentaire';
  }
  damages(inspection: any) {
    return Array.isArray(inspection?.damages) && inspection.damages.length
      ? inspection.damages.join('; ')
      : 'Aucun dommage signalé.';
  }
  availableActions() {
    const actions: { rental: any; type: 'departure' | 'return' }[] = [];
    for (const rental of this.rentals()) {
      if (!rental.has_departure && rental.status === 'pending')
        actions.push({ rental, type: 'departure' });
      if (
        rental.has_departure &&
        !rental.has_return &&
        ['active', 'overdue'].includes(rental.status) &&
        this.isReturnDay(rental.return_date)
      )
        actions.push({ rental, type: 'return' });
    }
    return actions;
  }
  isReturnDay(returnDate: string) {
    if (!returnDate) return false;
    const today = new Date();
    const expected = new Date(returnDate);
    return (
      today.getFullYear() === expected.getFullYear() &&
      today.getMonth() === expected.getMonth() &&
      today.getDate() === expected.getDate()
    );
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    const [history, rentals] = await Promise.all([
      this.auth.supabase().rpc('client_inspection_history'),
      this.auth.supabase().rpc('client_inspection_eligible_rentals'),
    ]);
    this.loading.set(false);
    if (history.error || rentals.error) {
      this.error.set(this.auth.errorMessage(history.error ?? rentals.error));
      return;
    }
    this.inspections.set((history.data as any[]) ?? []);
    this.rentals.set((rentals.data as any[]) ?? []);
  }
  openForm(rental: any, inspectionType: 'departure' | 'return') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.error.set('');
    this.message.set('');
    this.selected.set(null);
    this.files.clear();
    this.form.set({
      rental,
      inspection_type: inspectionType,
      mileage: 0,
      fuel_level: '',
      damagesText: '',
      observations: '',
    });
    setTimeout(
      () =>
        document
          .querySelector('.form-card')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      0,
    );
  }
  closeForm() {
    this.form.set(null);
    this.files.clear();
  }
  openPhotoForm(inspection: any) {
    this.error.set('');
    this.message.set('');
    this.form.set(null);
    this.files.clear();
    this.photoInspection.set(inspection);
  }
  closePhotoForm() {
    this.photoInspection.set(null);
    this.files.clear();
  }
  choose(type: PhotoType, event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.files.set(type, file);
  }
  async save() {
    const form = this.form();
    if (!form || Number(form.mileage) < 0) {
      this.error.set('Un kilométrage valide est obligatoire.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    try {
      const result = await this.auth.supabase().rpc('client_create_inspection', {
        target_rental_id: form.rental.id,
        target_inspection_type: form.inspection_type,
        target_mileage: Number(form.mileage),
        target_fuel_level: form.fuel_level || null,
        target_observations: form.observations || null,
        target_damages: form.damagesText
          ? form.damagesText
              .split('\n')
              .map((line: string) => line.trim())
              .filter(Boolean)
          : [],
      });
      if (result.error) throw result.error;
      await this.uploadPhotos((result.data as { id: string }).id);
      this.closeForm();
      this.message.set(
        'Inspection enregistrée. Elle est maintenant visible dans votre historique et dans celui du Responsable.',
      );
      await this.load();
    } catch (error) {
      this.error.set(this.auth.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  async savePhotos() {
    const inspection = this.photoInspection();
    if (!inspection) return;
    if (!this.files.size) {
      this.error.set('Choisissez au moins une photo avant l’envoi.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    try {
      await this.uploadPhotos(inspection.id);
      this.closePhotoForm();
      this.message.set('Photos ajoutées à l’inspection.');
      await this.load();
      await this.show(inspection);
    } catch (error) {
      this.error.set(this.auth.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  private async uploadPhotos(inspectionId: string) {
    for (const [type, file] of this.files) {
      const path = `inspections/${inspectionId}/${type}-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const form = new FormData();
      form.append('inspection_id', inspectionId);
      form.append('photo_type', type);
      form.append('file', file, file.name);
      const result = await this.auth
        .supabase()
        .functions.invoke('client-inspection-photo', { body: form });
      const upload = result.error;
      if (upload) throw upload;
    }
  }
  async show(inspection: any) {
    this.error.set('');
    this.selected.set(inspection);
    this.photos.set([]);
    const result = await this.auth
      .supabase()
      .functions.invoke('client-inspection-photo', { body: { inspection_id: inspection.id } });
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.photos.set(result.data?.photos ?? []);
  }
  async openPhoto(photo: any) {
    const result = await this.auth
      .supabase()
      .storage.from('inspection-photos')
      .createSignedUrl(photo.storage_path, 60);
    if (result.error) this.error.set(this.auth.errorMessage(result.error));
    else window.open(result.data.signedUrl, '_blank', 'noopener');
  }
}
