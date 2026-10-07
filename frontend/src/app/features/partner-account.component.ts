import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { DigitsOnlyDirective } from '../shared/digits-only.directive';

@Component({
  standalone: true,
  imports: [FormsModule, DigitsOnlyDirective],
  template: `
    <div class="page-heading"><div><p class="eyebrow">MON PROFIL</p><h1>Mes informations</h1><p>Ces informations servent à vous contacter et à vous reverser vos gains.</p></div></div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> } @if (message()) { <div class="alert alert-success">{{ message() }}</div> }
    @if (loading()) { <div class="empty-state">Chargement…</div> }
    @else if (form()) { <section class="card form-card"><div class="card-body">
      <div class="row g-3">
        <div class="col-md-6"><label>Nom de l'entreprise</label><input class="form-control" [(ngModel)]="form()!.company_name"></div>
        <div class="col-md-6"><label>Nom du contact <span class="required">*</span></label><input class="form-control" [(ngModel)]="form()!.contact_name"></div>
        <div class="col-md-6"><label>Téléphone <span class="required">*</span></label><input class="form-control" type="tel" inputmode="numeric" appDigitsOnly [(ngModel)]="form()!.phone"></div>
        <div class="col-md-6"><label>E-mail</label><input class="form-control" [(ngModel)]="form()!.email"></div>
        <div class="col-12"><label>Coordonnées de versement (banque, mobile money…)</label><textarea class="form-control" rows="2" [(ngModel)]="form()!.payout_details"></textarea></div>
      </div>
      <button class="btn btn-primary mt-4" [disabled]="saving()" (click)="save()">{{ saving() ? 'Enregistrement…' : 'Enregistrer' }}</button>
    </div></section> }
  `
})
export class PartnerAccountComponent implements OnInit {
  form = signal<any>(null); loading = signal(false); saving = signal(false); error = signal(''); message = signal('');
  constructor(private auth: AuthService) {}
  async ngOnInit() {
    this.loading.set(true); this.error.set('');
    const result = await this.auth.supabase().from('partners').select('*').eq('profile_id', this.auth.profile()?.id ?? '').maybeSingle();
    this.loading.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    this.form.set(result.data ?? { company_name: '', contact_name: '', phone: '', email: '', payout_details: '' });
  }
  async save() {
    const value = this.form();
    if (!value.contact_name?.trim() || !value.phone?.trim()) { this.error.set('Nom du contact et téléphone obligatoires.'); return; }
    this.saving.set(true); this.error.set('');
    const result = await this.auth.supabase().rpc('ensure_partner_profile', { target_company_name: value.company_name || null, target_contact_name: value.contact_name, target_phone: value.phone, target_email: value.email || null });
    this.saving.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    this.form.set(result.data); this.message.set('Informations enregistrées.');
  }
}
