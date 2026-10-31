import { Component, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  menuOpen = signal(false);
  theme = signal<'light' | 'dark'>('light');
  private formObserver = new MutationObserver(() => {
    const form = document.querySelector('.form-card,.contract,.detail-card');
    if (form && !form.hasAttribute('data-auto-focused')) {
      form.setAttribute('data-auto-focused', 'true');
      setTimeout(() => form.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    }
    if (!form)
      document
        .querySelectorAll('[data-auto-focused]')
        .forEach((element) => element.removeAttribute('data-auto-focused'));
  });
  constructor(
    public a: AuthService,
    private router: Router,
  ) {
    this.formObserver.observe(document.body, { childList: true, subtree: true });
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.a.refreshUnreadNotifications());
  }
  async ngOnInit() {
    this.setTheme(localStorage.getItem('fima-theme') === 'dark' ? 'dark' : 'light');
    await this.a.refreshUnreadNotifications();
  }
  toggleTheme() {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }
  private setTheme(theme: 'light' | 'dark') {
    this.theme.set(theme);
    document.documentElement.dataset['theme'] = theme;
    localStorage.setItem('fima-theme', theme);
  }
  openMenu() {
    this.menuOpen.set(true);
  }
  closeMenu() {
    this.menuOpen.set(false);
  }
  displayName() {
    const p = this.a.profile() ?? {};
    const name =
      [p.first_name, p.last_name].filter(Boolean).join(' ').trim() ||
      (p.full_name && !String(p.full_name).includes('@') ? p.full_name : '') ||
      String(p.email ?? '').split('@')[0] ||
      'Utilisateur';
    return name;
  }
  initials() {
    return this.displayName()
      .split(' ')
      .map((x: string) => x[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  async out() {
    await this.a.logout();
    location.assign('/login');
  }
}
