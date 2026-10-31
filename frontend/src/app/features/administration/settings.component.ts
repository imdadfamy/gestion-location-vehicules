import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DigitsOnlyDirective } from '../../shared/digits-only.directive';
@Component({
  standalone: true,
  imports: [FormsModule, DigitsOnlyDirective],
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
  form = signal<any>(null);
  error = signal('');
  message = signal('');
  logoUrl = signal('');
  constructor(private auth: AuthService) {}
  async ngOnInit() {
    const r = await this.auth
      .supabase()
      .from('company_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (r.error) this.error.set(this.auth.errorMessage(r.error));
    else {
      this.form.set(r.data);
      if (r.data?.logo_storage_path) this.loadLogo(r.data.logo_storage_path);
    }
  }
  create() {
    this.form.set({
      company_name: '',
      address: '',
      phone: '',
      secondary_phone: '',
      whatsapp_phone: '',
      business_hours: '',
      email: '',
      rccm: '',
      ifu: '',
      default_rental_price: 0,
      default_deposit_amount: 0,
      partner_minimum_margin: 5000,
      settings: {},
    });
  }
  async loadLogo(path: string) {
    const r = await this.auth
      .supabase()
      .storage.from('rental-documents')
      .createSignedUrl(path, 300);
    if (r.data?.signedUrl) this.logoUrl.set(r.data.signedUrl);
  }
  async uploadLogo(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0],
      f = this.form();
    if (!file || !f) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      this.error.set('Le logo doit être une image PNG, JPEG ou WebP.');
      return;
    }
    const id = f.id || crypto.randomUUID(),
      path = `company/${id}/${crypto.randomUUID()}-${file.name}`;
    const r = await this.auth
      .supabase()
      .storage.from('rental-documents')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (r.error) {
      this.error.set(this.auth.errorMessage(r.error));
      return;
    }
    this.form.set({ ...f, id: f.id, logo_storage_path: path });
    await this.loadLogo(path);
    this.message.set('Logo chargé. Enregistrez les paramètres pour le conserver.');
  }
  async save() {
    const f = this.form();
    const r = f.id
      ? await this.auth
          .supabase()
          .from('company_settings')
          .update(f)
          .eq('id', f.id)
          .select()
          .single()
      : await this.auth.supabase().from('company_settings').insert(f).select().single();
    if (r.error) this.error.set(this.auth.errorMessage(r.error));
    else if (r.data) {
      this.form.set(r.data);
      this.message.set('Paramètres enregistrés.');
      if (r.data.logo_storage_path) this.loadLogo(r.data.logo_storage_path);
    }
  }
}
