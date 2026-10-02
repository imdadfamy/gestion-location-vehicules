import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  styles: [`
    .portal{min-height:100dvh;background:radial-gradient(circle at 88% -10%,#e2f4f6 0,transparent 34%),#f4f8f9;color:#15323a;overflow-x:clip}.portal-nav{position:relative;z-index:30;background:linear-gradient(110deg,#102f38,#174754);color:#fff;padding:14px max(18px,calc((100vw - 1180px)/2));display:flex;align-items:center;gap:12px;min-width:0;box-shadow:0 4px 16px rgba(6,43,53,.15)}
    .brand{display:flex;align-items:center;gap:11px;min-width:0;margin-right:auto;font-weight:900;letter-spacing:.08em;color:#fff;text-decoration:none;white-space:nowrap}.brand img{width:48px;height:48px;flex:0 0 auto;object-fit:contain;padding:3px;border-radius:13px;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.16)}.brand-copy{display:grid;min-width:0;line-height:1.05}.brand-copy small{font-size:.54rem;color:#8ed3df;letter-spacing:.13em;margin-bottom:4px}
    .menu-toggle{display:inline-flex;align-items:center;gap:8px;min-height:42px;border-color:rgba(213,229,232,.7);color:#fff;background:rgba(255,255,255,.08)}.menu-toggle:hover,.menu-toggle[aria-expanded='true']{color:#fff;background:rgba(142,211,223,.22);border-color:#8ed3df}.menu-icon{display:grid;gap:4px;width:17px}.menu-icon i{display:block;width:17px;height:2px;border-radius:2px;background:currentColor}
    .portal-menu{position:absolute;right:max(18px,calc((100vw - 1180px)/2));top:calc(100% + 8px);width:min(330px,calc(100vw - 28px));padding:9px;background:#fff;border:1px solid #d8e8ea;border-radius:16px;box-shadow:0 18px 45px rgba(5,35,42,.24);animation:menu-in .16s ease-out}.portal-menu:not(.open){display:none}.portal-menu a{display:flex;align-items:center;gap:10px;padding:12px 13px;color:#18353d;text-decoration:none;border-radius:11px;font-weight:700}.portal-menu a::before{content:'›';font-size:1.35rem;line-height:.7;color:#0a91a3}.portal-menu a:hover,.portal-menu a.active{color:#073c46;background:#e6f5f6}.menu-title{display:block;padding:6px 13px 8px;color:#6e858b;font-size:.67rem;font-weight:900;letter-spacing:.13em}@keyframes menu-in{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}
    .logout{flex:0 0 auto}.portal-main{max-width:1180px;margin:auto;padding:38px 20px max(72px,calc(40px + env(safe-area-inset-bottom)))}
    @media(min-width:900px){.menu-toggle{display:none}.portal-menu{display:flex!important;position:static;width:auto;padding:0;border:0;box-shadow:none;background:transparent;animation:none;gap:4px}.portal-menu .menu-title{display:none}.portal-menu a{color:#fff;padding:9px 10px}}@media(max-width:760px){.portal-nav{position:sticky;top:0;padding:10px 14px;gap:8px}.brand img{width:40px;height:40px;border-radius:11px}.brand-copy small{font-size:.46rem}.brand{font-size:.92rem;letter-spacing:.055em}.menu-toggle{min-height:39px;padding-inline:10px}.menu-toggle span:not(.menu-icon){display:none}.logout{font-size:.74rem;padding:.35rem .48rem}.portal-menu{right:14px;top:calc(100% + 6px);width:min(340px,calc(100vw - 28px))}.portal-main{padding:24px 14px max(42px,calc(28px + env(safe-area-inset-bottom)))}}
    @media(max-width:370px){.brand-copy small{font-size:.4rem}.brand{font-size:.83rem}.brand img{width:36px;height:36px}.menu-toggle{padding-inline:8px}.logout{font-size:.68rem;padding:.32rem .38rem}}
  `],
  template: `
    <div class="portal"><header class="portal-nav">
      <a routerLink="/client/vehicles" class="brand" aria-label="FIMA AUTO" (click)="menuOpen.set(false)"><img src="/fima-auto-logo.jpg" alt="Logo FIMA AUTO"><span class="brand-copy"><small>LOCATION DE VÉHICULES</small>FIMA AUTO</span></a>
      <button class="btn btn-sm menu-toggle" type="button" [attr.aria-expanded]="menuOpen()" aria-controls="client-navigation" (click)="menuOpen.set(!menuOpen())"><span class="menu-icon" aria-hidden="true"><i></i><i></i><i></i></span><span>Menu</span></button>
      <button class="btn btn-sm btn-outline-light logout" (click)="logout()">Déconnexion</button>
      <nav id="client-navigation" class="portal-menu" [class.open]="menuOpen()" aria-label="Navigation client"><span class="menu-title">ESPACE CLIENT</span><a routerLink="/client/vehicles" routerLinkActive="active" (click)="menuOpen.set(false)">Véhicules disponibles</a><a routerLink="/client/reservations" routerLinkActive="active" (click)="menuOpen.set(false)">Mes réservations</a><a routerLink="/client/contracts" routerLinkActive="active" (click)="menuOpen.set(false)">Contrats</a><a routerLink="/client/inspections" routerLinkActive="active" (click)="menuOpen.set(false)">Mes inspections</a><a routerLink="/client/account" routerLinkActive="active" (click)="menuOpen.set(false)">Mon profil</a></nav>
    </header><main class="portal-main"><router-outlet/></main></div>
  `
})
export class ClientShellComponent {
  menuOpen = signal(false);
  constructor(private auth: AuthService) {}
  async logout() { await this.auth.logout(); location.assign('/client/login'); }
}
