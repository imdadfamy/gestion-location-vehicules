import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { PartnerPortalService } from '../../core/data/partner-portal.service';
import { VehiclesService } from '../../core/data/vehicles.service';

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
  constructor(
    private auth: AuthService,
    private portal: PartnerPortalService,
    private vehiclesData: VehiclesService,
  ) {}

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
    const partner = await this.portal.myPartner(this.auth.profile()?.id ?? '', 'id');
    this.partnerId = partner.data?.id ?? '';
    const result = await this.portal.vehicles();
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
    const result = await this.portal.saveVehicle(value.id, payload);
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
    const result = await this.portal.photos(vehicle.id);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.photos.set(result.data ?? []);
  }

  async uploadPhotos(event: Event) {
    const vehicle = this.photoVehicle();
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    if (!vehicle || !files.length) return;
    this.error.set('');
    for (const file of files) {
      const failure = await this.vehiclesData.uploadDocument(vehicle.id, 'photo', file);
      if (failure) this.error.set(this.auth.errorMessage(failure));
    }
    (event.target as HTMLInputElement).value = '';
    await this.managePhotos(vehicle);
  }
}
