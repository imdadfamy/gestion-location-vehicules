import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { AdministrationService } from '../../core/data/administration.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  templateUrl: './my-profile.component.html',
  styleUrl: './my-profile.component.scss',
})
export class MyProfileComponent implements OnInit {
  form = { first_name: '', last_name: '', email: '' };
  saving = signal(false);
  error = signal('');
  message = signal('');
  constructor(
    public auth: AuthService,
    private admin: AdministrationService,
  ) {}
  ngOnInit() {
    const profile = this.auth.profile() ?? {};
    const parts = this.fallbackParts(profile);
    this.form = {
      first_name: profile.first_name ?? parts.first_name,
      last_name: profile.last_name ?? parts.last_name,
      email: profile.email ?? '',
    };
  }
  private fallbackParts(profile: any) {
    const text = String(profile.full_name ?? '').includes('@')
      ? ''
      : String(profile.full_name ?? '').trim();
    const parts = text.split(/\s+/).filter(Boolean);
    return { first_name: parts.shift() ?? '', last_name: parts.join(' ') };
  }
  initials() {
    return (
      [this.form.first_name, this.form.last_name]
        .filter(Boolean)
        .map((value) => value[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'FA'
    );
  }
  async save() {
    this.error.set('');
    this.message.set('');
    if (!this.form.first_name.trim() || !this.form.last_name.trim()) {
      this.error.set('Veuillez renseigner votre prénom et votre nom.');
      return;
    }
    this.saving.set(true);
    const result = await this.admin.updateOwnName(
      this.auth.profile()?.id,
      this.form.first_name.trim(),
      this.form.last_name.trim(),
    );
    this.saving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    await this.auth.load();
    this.message.set('Vos informations ont été mises à jour.');
  }
}
