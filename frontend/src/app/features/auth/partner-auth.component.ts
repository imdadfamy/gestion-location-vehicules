import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { DigitsOnlyDirective } from '../../shared/digits-only.directive';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, DigitsOnlyDirective],
  styleUrl: './partner-auth.component.scss',
  templateUrl: './partner-auth.component.html',
})
export class PartnerAuthComponent {
  register = signal(false);
  showPassword = signal(false);
  loading = signal(false);
  error = signal('');
  message = signal('');
  companyName = '';
  contactName = '';
  phone = '';
  email = '';
  password = '';
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {
    this.register.set(location.pathname.endsWith('/register'));
  }

  async submit() {
    this.error.set('');
    this.message.set('');
    if (!this.email.trim() || !this.password) {
      this.error.set('Adresse e-mail et mot de passe obligatoires.');
      return;
    }
    if (this.register()) {
      if (!this.contactName.trim() || !this.phone.trim()) {
        this.error.set('Nom du contact et téléphone obligatoires.');
        return;
      }
      this.loading.set(true);
      const r = await this.auth.supabase().auth.signUp({
        email: this.email.trim(),
        password: this.password,
        options: {
          data: {
            full_name: this.companyName.trim() || this.contactName.trim(),
            requested_role: 'partner',
          },
        },
      });
      this.loading.set(false);
      if (r.error) {
        this.error.set(this.auth.errorMessage(r.error));
        return;
      }
      if (r.data.session) {
        await this.auth.load();
        const p = await this.auth.supabase().rpc('ensure_partner_profile', {
          target_company_name: this.companyName || '',
          target_contact_name: this.contactName,
          target_phone: this.phone,
          target_email: this.email,
        });
        if (p.error) {
          this.error.set(this.auth.errorMessage(p.error));
          return;
        }
        await this.router.navigate(['/partner/vehicles']);
      } else this.message.set('Compte créé. Vérifiez votre e-mail puis connectez-vous.');
      return;
    }
    this.loading.set(true);
    const e = await this.auth.login(this.email.trim(), this.password);
    this.loading.set(false);
    if (e) {
      this.error.set(this.auth.errorMessage(e));
      return;
    }
    if (this.auth.profile()?.role !== 'partner') {
      await this.auth.logout();
      this.error.set('Ce compte n’est pas un compte partenaire.');
      return;
    }
    await this.router.navigate(['/partner/vehicles']);
  }
}
