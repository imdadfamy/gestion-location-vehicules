import { Component, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ClientPortalService } from '../core/data/client-portal.service';

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
  constructor(
    private auth: AuthService,
    private portal: ClientPortalService,
  ) {}
  async ngOnInit() {
    // Les paramètres complets sont réservés au personnel (RLS) : le client lit les
    // coordonnées publiques ; le logo reste celui livré avec l'application.
    const result = await this.portal.companyContact();
    if (result.data) this.company.set(result.data);
  }
  async logout() {
    await this.auth.logout();
    location.assign('/client/login');
  }
}
