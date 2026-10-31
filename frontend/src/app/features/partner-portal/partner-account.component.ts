import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { PartnerPortalService } from '../../core/data/partner-portal.service';
import { DigitsOnlyDirective } from '../../shared/digits-only.directive';

@Component({
  standalone: true,
  imports: [FormsModule, DigitsOnlyDirective],
  templateUrl: './partner-account.component.html',
})
export class PartnerAccountComponent implements OnInit {
  form = signal<any>(null);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  message = signal('');
  constructor(
    private auth: AuthService,
    private portal: PartnerPortalService,
  ) {}
  async ngOnInit() {
    this.loading.set(true);
    this.error.set('');
    const result = await this.portal.myPartner(this.auth.profile()?.id ?? '');
    this.loading.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.form.set(
      result.data ?? {
        company_name: '',
        contact_name: '',
        phone: '',
        email: '',
        payout_details: '',
      },
    );
  }
  async save() {
    const value = this.form();
    if (!value.contact_name?.trim() || !value.phone?.trim()) {
      this.error.set('Nom du contact et téléphone obligatoires.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const result = await this.portal.saveProfile(value);
    this.saving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.form.set(result.data);
    this.message.set('Informations enregistrées.');
  }
}
