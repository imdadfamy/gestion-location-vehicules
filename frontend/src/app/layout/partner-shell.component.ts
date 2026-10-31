import { Component, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  styleUrl: './partner-shell.component.scss',
  templateUrl: './partner-shell.component.html',
})
export class PartnerShellComponent implements OnInit {
  menuOpen = signal(false);
  constructor(private auth: AuthService) {}
  ngOnInit() {}
  async logout() {
    await this.auth.logout();
    location.assign('/partner/login');
  }
}
