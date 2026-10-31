import { Component, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  styleUrl: './client-shell.component.scss',
  templateUrl: './client-shell.component.html',
})
export class ClientShellComponent implements OnInit {
  menuOpen = signal(false);
  company = signal<any>({});
  logoUrl = signal('/logo-horizontal-white.png');
  constructor(private auth: AuthService) {}
  async ngOnInit() {
    const result = await this.auth
      .supabase()
      .from('company_settings')
      .select('company_name,phone,secondary_phone,whatsapp_phone,logo_storage_path')
      .limit(1)
      .maybeSingle();
    if (result.data) {
      this.company.set(result.data);
      if (result.data.logo_storage_path) {
        const signed = await this.auth
          .supabase()
          .storage.from('rental-documents')
          .createSignedUrl(result.data.logo_storage_path, 300);
        if (signed.data?.signedUrl) this.logoUrl.set(signed.data.signedUrl);
      }
    }
  }
  async logout() {
    await this.auth.logout();
    location.assign('/client/login');
  }
}
