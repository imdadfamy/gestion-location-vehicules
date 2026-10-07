import { Component, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  styles: [`
    :host{--radius-sm:12px;--radius-md:16px;--radius-full:999px;--shadow-sm:0 2px 8px rgba(13,41,49,.06);--shadow-lg:0 18px 45px rgba(5,35,42,.22);--ease:cubic-bezier(.22,1,.36,1)}
    .portal{min-height:100dvh;display:flex;flex-direction:column;background:radial-gradient(circle at 88% -10%,#e2f4f6 0,transparent 34%),var(--app-bg,#f4f8f9);color:var(--app-text,#15323a);overflow-x:clip}
    .portal-nav{position:sticky;top:0;z-index:30;background:linear-gradient(110deg,#102f38,#174754);color:#fff;padding:14px max(18px,calc((100vw - 1180px)/2));display:flex;align-items:center;gap:12px;min-width:0;box-shadow:var(--shadow-sm)}
    .brand{display:flex;align-items:center;gap:11px;min-width:0;margin-right:auto;text-decoration:none;white-space:nowrap}.brand img{display:block;height:48px;width:auto;object-fit:contain;background:#fff;border-radius:var(--radius-sm);padding:6px 10px;box-shadow:var(--shadow-sm)}
    .menu-toggle{display:inline-flex;align-items:center;gap:8px;min-height:42px;border-radius:var(--radius-full);border-color:rgba(213,229,232,.7);color:#fff;background:rgba(255,255,255,.08)}.menu-toggle:hover,.menu-toggle[aria-expanded='true']{background:rgba(142,211,223,.22);border-color:#8ed3df}.menu-icon{display:grid;gap:4px;width:17px}.menu-icon i{display:block;width:17px;height:2px;border-radius:2px;background:currentColor}
    .portal-menu{position:absolute;right:max(18px,calc((100vw - 1180px)/2));top:calc(100% + 8px);width:min(300px,calc(100vw - 28px));padding:9px;background:#fff;border:1px solid #d8e8ea;border-radius:var(--radius-md);box-shadow:var(--shadow-lg)}.portal-menu:not(.open){display:none}.portal-menu a{display:flex;align-items:center;gap:10px;padding:12px 13px;color:#18353d;text-decoration:none;border-radius:11px;font-weight:700}.portal-menu a:hover,.portal-menu a.active{color:#073c46;background:#e6f5f6}
    .logout{flex:0 0 auto;border-radius:var(--radius-full)}
    .portal-main{flex:1;max-width:1180px;width:100%;margin:auto;padding:38px 20px max(72px,calc(40px + env(safe-area-inset-bottom)))}
    @media(min-width:900px){.menu-toggle{display:none}.portal-menu{display:flex!important;position:static;width:auto;padding:0;border:0;box-shadow:none;background:transparent;gap:4px}.portal-menu a{color:rgba(255,255,255,.88);padding:9px 12px}.portal-menu a:hover,.portal-menu a.active{color:#fff;background:transparent}}
  `],
  template: `
    <div class="portal"><header class="portal-nav">
      <a routerLink="/partner/vehicles" class="brand" aria-label="FIMA AUTO" (click)="menuOpen.set(false)"><img src="/logo.jpg" alt="Logo FIMA AUTO"></a>
      <button class="btn btn-sm menu-toggle" type="button" [attr.aria-expanded]="menuOpen()" aria-controls="partner-navigation" (click)="menuOpen.set(!menuOpen())"><span class="menu-icon" aria-hidden="true"><i></i><i></i><i></i></span><span>Menu</span></button>
      <button class="btn btn-sm btn-outline-light logout" (click)="logout()">Déconnexion</button>
      <nav id="partner-navigation" class="portal-menu" [class.open]="menuOpen()" aria-label="Navigation partenaire"><a routerLink="/partner/vehicles" routerLinkActive="active" (click)="menuOpen.set(false)">Mes véhicules</a><a routerLink="/partner/maintenance" routerLinkActive="active" (click)="menuOpen.set(false)">Maintenance</a><a routerLink="/partner/inspections" routerLinkActive="active" (click)="menuOpen.set(false)">Inspections</a><a routerLink="/partner/earnings" routerLinkActive="active" (click)="menuOpen.set(false)">Mes revenus</a><a routerLink="/partner/account" routerLinkActive="active" (click)="menuOpen.set(false)">Mon profil</a></nav>
    </header><main class="portal-main"><router-outlet/></main></div>
  `
})
export class PartnerShellComponent implements OnInit {
  menuOpen = signal(false);
  constructor(private auth: AuthService) {}
  ngOnInit() {}
  async logout() { await this.auth.logout(); location.assign('/partner/login'); }
}
