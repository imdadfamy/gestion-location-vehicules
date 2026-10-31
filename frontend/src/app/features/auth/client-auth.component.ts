import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { DigitsOnlyDirective } from '../../shared/digits-only.directive';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, DigitsOnlyDirective],
  styleUrl: './client-auth.component.scss',
  templateUrl: './client-auth.component.html',
})
export class ClientAuthComponent {
  register = signal(false);
  showPassword = signal(false);
  acceptedTerms = false;
  loading = signal(false);
  error = signal('');
  message = signal('');
  firstName = '';
  lastName = '';
  phone = '';
  email = '';
  password = '';
  private returnTarget: any[] = ['/client/vehicles'];
  private returnParams: Record<string, string> = {};
  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.register.set(location.pathname.endsWith('/register'));
    const q = this.route.snapshot.queryParamMap;
    if (q.get('vehicle') || q.get('depart') || q.get('retour')) {
      this.returnParams = {
        ...(q.get('vehicle') ? { vehicle: q.get('vehicle')! } : {}),
        ...(q.get('depart') ? { depart: q.get('depart')! } : {}),
        ...(q.get('retour') ? { retour: q.get('retour')! } : {}),
      };
    }
  }
  private authError(error: any) {
    const message = this.auth.errorMessage(error);
    const code = String(error?.code ?? error?.status ?? '').trim();
    const raw = String(error?.message ?? '').trim();
    if (!message.startsWith('L’opération n’a pas pu')) return message;
    return code
      ? 'La création du compte a été refusée par Supabase (référence : ' + code + ').'
      : raw
        ? 'La création du compte a été refusée par Supabase : ' + raw + '.'
        : 'La création du compte a été refusée par Supabase. Réessayez après avoir rechargé la page.';
  }
  async submit() {
    this.error.set('');
    this.message.set('');
    if (!this.email.trim() || !this.password) {
      this.error.set('Adresse e-mail et mot de passe obligatoires.');
      return;
    }
    if (this.register()) {
      if (!this.firstName.trim() || !this.lastName.trim() || !this.phone.trim()) {
        this.error.set('Prénom, nom et téléphone obligatoires.');
        return;
      }
      this.loading.set(true);
      const r = await this.auth.supabase().auth.signUp({
        email: this.email.trim(),
        password: this.password,
        options: {
          data: {
            full_name: (this.firstName + ' ' + this.lastName).trim(),
            first_name: this.firstName.trim(),
            last_name: this.lastName.trim(),
            phone: this.phone.trim(),
          },
        },
      });
      this.loading.set(false);
      if (r.error) {
        this.error.set(this.authError(r.error));
        return;
      }
      if (r.data.session) {
        await this.auth.load();
        const p = await this.auth.supabase().rpc('ensure_client_profile', {
          target_first_name: this.firstName,
          target_last_name: this.lastName,
          target_phone: this.phone,
          target_email: this.email,
        });
        if (p.error) {
          this.error.set(this.authError(p.error));
          return;
        }
        await this.router.navigate(this.returnTarget, { queryParams: this.returnParams });
      } else this.message.set('Compte créé. Vérifiez votre e-mail puis connectez-vous.');
      return;
    }
    this.loading.set(true);
    const e = await this.auth.login(this.email.trim(), this.password);
    this.loading.set(false);
    if (e) {
      this.error.set(this.authError(e));
      return;
    }
    if (this.auth.profile()?.role !== 'client') {
      await this.auth.logout();
      this.error.set('Ce compte appartient à l’équipe interne. Utilisez l’accès équipe.');
      return;
    }
    await this.router.navigate(this.returnTarget, { queryParams: this.returnParams });
  }
}
