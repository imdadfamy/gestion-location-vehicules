import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DigitsOnlyDirective } from '../../shared/digits-only.directive';

@Component({
  standalone: true,
  imports: [FormsModule, DigitsOnlyDirective, DatePipe],
  styleUrl: './partners.component.scss',
  templateUrl: './partners.component.html',
})
export class PartnersComponent implements OnInit {
  vehicles = signal<any[]>([]);
  partners = signal<any[]>([]);
  rentals = signal<any[]>([]);
  allPhotos = signal<Record<string, any[]>>({});
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  message = signal('');
  view = signal<'vehicles' | 'partners'>('vehicles');
  search = '';
  statusFilter = '';
  selectedVehicle = signal<any>(null);
  selectedPartner = signal<any>(null);
  lightboxUrl = signal<string | null>(null);
  rejecting = signal(false);
  finalPrice = 0;
  finalDeposit = 0;
  rejectionReason = '';
  partnerForm: any = {};
  minMargin = signal(5000);
  constructor(private auth: AuthService) {}

  async ngOnInit() {
    await this.load();
  }
  pending() {
    return this.vehicles().filter((v) => v.approval_status === 'pending');
  }
  approvedCount() {
    return this.vehicles().filter((v) => v.approval_status === 'approved').length;
  }
  activePartnersCount() {
    return this.partners().filter((p) => p.profiles?.is_active).length;
  }
  photosFor(vehicleId: string) {
    return this.allPhotos()[vehicleId] ?? [];
  }
  partnerLabel(p: any) {
    return p?.company_name || p?.contact_name || 'Partenaire';
  }
  vehicleCountFor(partnerId: string) {
    return this.vehicles().filter((v) => v.partner_id === partnerId).length;
  }
  statusLabel(status: string) {
    return (
      ({ pending: 'En attente', approved: 'Validé', rejected: 'Refusé' } as Record<string, string>)[
        status
      ] ?? status
    );
  }
  money(value: any) {
    return Number(value ?? 0).toLocaleString('fr-FR') + ' FCFA';
  }
  margin() {
    const v = this.selectedVehicle();
    return Number(this.finalPrice || 0) - Number(v?.partner_requested_price || 0);
  }
  marginTooLow() {
    return this.margin() < this.minMargin();
  }

  filteredVehicles() {
    const q = this.search.trim().toLowerCase();
    return this.vehicles().filter(
      (v) =>
        (!this.statusFilter || v.approval_status === this.statusFilter) &&
        (!q ||
          `${v.make} ${v.model} ${v.registration_number} ${this.partnerLabel(v.partners)}`
            .toLowerCase()
            .includes(q)),
    );
  }
  filteredPartners() {
    const q = this.search.trim().toLowerCase();
    return this.partners().filter(
      (p) => !q || `${p.company_name ?? ''} ${p.contact_name} ${p.phone}`.toLowerCase().includes(q),
    );
  }

  totalCommission() {
    let total = 0;
    for (const v of this.vehicles()) {
      if (v.approval_status !== 'approved' || !v.commission_amount) continue;
      for (const r of this.rentals()) {
        if (r.vehicle_id !== v.id || r.status !== 'completed') continue;
        const days = Math.max(
          1,
          Math.ceil(
            (new Date(r.return_date).getTime() - new Date(r.departure_date).getTime()) / 86400000,
          ),
        );
        total += Number(v.commission_amount) * days;
      }
    }
    return total;
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    const [vehicles, partners, settings] = await Promise.all([
      this.auth
        .supabase()
        .from('vehicles')
        .select('*,partners(id,company_name,contact_name)')
        .eq('owner_type', 'partner')
        .order('submitted_at', { ascending: false }),
      this.auth
        .supabase()
        .from('partners')
        .select('*,profiles!partners_profile_id_fkey(is_active)')
        .order('created_at', { ascending: false }),
      this.auth
        .supabase()
        .from('company_settings')
        .select('partner_minimum_margin')
        .limit(1)
        .maybeSingle(),
    ]);
    if (vehicles.error) {
      this.loading.set(false);
      this.error.set(this.auth.errorMessage(vehicles.error));
      return;
    }
    this.vehicles.set(vehicles.data ?? []);
    if (!partners.error) this.partners.set(partners.data ?? []);
    if (settings.data?.partner_minimum_margin != null)
      this.minMargin.set(Number(settings.data.partner_minimum_margin));

    const vehicleIds = (vehicles.data ?? []).map((v: any) => v.id);
    if (vehicleIds.length) {
      const rentalsResult = await this.auth
        .supabase()
        .from('rentals')
        .select('vehicle_id,departure_date,return_date,status')
        .in('vehicle_id', vehicleIds);
      if (!rentalsResult.error) this.rentals.set(rentalsResult.data ?? []);
    }

    const pendingIds = (vehicles.data ?? [])
      .filter((v: any) => v.approval_status === 'pending')
      .map((v: any) => v.id);
    if (pendingIds.length) {
      const docs = await this.auth
        .supabase()
        .from('vehicle_documents')
        .select('*')
        .in('vehicle_id', pendingIds)
        .eq('document_type', 'photo');
      const byVehicle: Record<string, any[]> = {};
      for (const doc of docs.data ?? []) {
        const signed = await this.auth
          .supabase()
          .storage.from('rental-documents')
          .createSignedUrl((doc as any).storage_path, 600);
        const url = signed.data?.signedUrl ?? '';
        (byVehicle[(doc as any).vehicle_id] ??= []).push({ ...doc, url });
      }
      this.allPhotos.set(byVehicle);
    }
    this.loading.set(false);
  }

  openVehicle(vehicle: any) {
    this.error.set('');
    this.message.set('');
    this.rejecting.set(false);
    this.rejectionReason = '';
    this.finalPrice =
      vehicle.approval_status === 'approved'
        ? Number(vehicle.rental_price)
        : Number(vehicle.partner_requested_price) + this.minMargin();
    this.finalDeposit = Number(vehicle.deposit_amount || 0);
    this.selectedVehicle.set(vehicle);
  }
  openLightbox(url: string) {
    this.lightboxUrl.set(url);
  }
  openReject() {
    this.rejecting.set(true);
  }

  async decide(decision: 'approved' | 'rejected') {
    const vehicle = this.selectedVehicle();
    if (!vehicle) return;
    if (decision === 'approved' && !(Number(this.finalPrice) > 0)) {
      this.error.set('Indiquez un prix client valide.');
      return;
    }
    if (decision === 'rejected' && !this.rejectionReason.trim()) {
      this.error.set('Indiquez un motif de refus.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const payload: any =
      decision === 'approved'
        ? {
            approval_status: 'approved',
            status: 'available',
            rental_price: Number(this.finalPrice),
            deposit_amount: Number(this.finalDeposit || 0),
            commission_amount: Number(this.finalPrice) - Number(vehicle.partner_requested_price),
            reviewed_at: new Date().toISOString(),
            reviewed_by: this.auth.profile()?.id,
          }
        : {
            approval_status: 'rejected',
            rejection_reason: this.rejectionReason.trim(),
            reviewed_at: new Date().toISOString(),
            reviewed_by: this.auth.profile()?.id,
          };
    const result = await this.auth.supabase().from('vehicles').update(payload).eq('id', vehicle.id);
    this.saving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.selectedVehicle.set(null);
    this.message.set(decision === 'approved' ? 'Véhicule validé.' : 'Véhicule refusé.');
    await this.load();
  }

  async saveApprovedChanges() {
    const vehicle = this.selectedVehicle();
    if (!vehicle) return;
    if (!(Number(this.finalPrice) > 0)) {
      this.error.set('Indiquez un prix client valide.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const result = await this.auth
      .supabase()
      .from('vehicles')
      .update({
        rental_price: Number(this.finalPrice),
        deposit_amount: Number(this.finalDeposit || 0),
        commission_amount: Number(this.finalPrice) - Number(vehicle.partner_requested_price),
      })
      .eq('id', vehicle.id);
    this.saving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.message.set('Prix mis à jour.');
    this.selectedVehicle.set(null);
    await this.load();
  }

  async toggleAvailability() {
    const vehicle = this.selectedVehicle();
    if (!vehicle) return;
    this.saving.set(true);
    this.error.set('');
    const next = vehicle.status === 'available' ? 'unavailable' : 'available';
    const result = await this.auth
      .supabase()
      .from('vehicles')
      .update({ status: next })
      .eq('id', vehicle.id);
    this.saving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.message.set(next === 'available' ? 'Véhicule republié.' : 'Véhicule suspendu.');
    this.selectedVehicle.set(null);
    await this.load();
  }

  async resendToEvaluation() {
    const vehicle = this.selectedVehicle();
    if (!vehicle) return;
    if (
      !confirm(
        'Renvoyer ce véhicule en évaluation ? Il ne sera plus visible du public tant qu’il ne sera pas revalidé.',
      )
    )
      return;
    this.saving.set(true);
    this.error.set('');
    const result = await this.auth
      .supabase()
      .from('vehicles')
      .update({ approval_status: 'pending', status: 'unavailable' })
      .eq('id', vehicle.id);
    this.saving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.message.set('Véhicule renvoyé en évaluation.');
    this.selectedVehicle.set(null);
    await this.load();
  }

  openPartner(partner: any) {
    this.error.set('');
    this.message.set('');
    this.partnerForm = {
      company_name: partner.company_name,
      contact_name: partner.contact_name,
      phone: partner.phone,
      email: partner.email,
      payout_details: partner.payout_details,
      notes: partner.notes,
    };
    this.selectedPartner.set(partner);
  }

  async savePartner() {
    const partner = this.selectedPartner();
    if (!partner) return;
    if (!this.partnerForm.contact_name?.trim() || !this.partnerForm.phone?.trim()) {
      this.error.set('Nom du contact et téléphone sont obligatoires.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const result = await this.auth
      .supabase()
      .from('partners')
      .update(this.partnerForm)
      .eq('id', partner.id);
    this.saving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.message.set('Partenaire mis à jour.');
    this.selectedPartner.set(null);
    await this.load();
  }

  async togglePartnerAccess() {
    const partner = this.selectedPartner();
    if (!partner?.profile_id) {
      this.error.set('Ce partenaire n’a pas encore de compte de connexion.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const enable = !partner.profiles?.is_active;
    try {
      const result = await this.auth.supabase().functions.invoke('manage-users', {
        body: { action: 'update_partner_access', user_id: partner.profile_id, is_active: enable },
      });
      if (result.error) throw result.error;
      if (result.data?.error) throw new Error(result.data.error);
      this.message.set(enable ? 'Compte partenaire réactivé.' : 'Compte partenaire désactivé.');
      this.selectedPartner.set(null);
      await this.load();
    } catch (e) {
      this.error.set(this.auth.errorMessage(e));
    }
    this.saving.set(false);
  }
}
