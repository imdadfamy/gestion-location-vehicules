import { Component, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  styles: [`
    :host{--radius-sm:12px;--radius-md:16px;--radius-full:999px;--shadow-sm:0 2px 8px rgba(13,41,49,.06);--shadow-md:0 12px 28px rgba(13,41,49,.10);--shadow-lg:0 18px 45px rgba(5,35,42,.22);--ease:cubic-bezier(.22,1,.36,1)}
    .portal{min-height:100dvh;display:flex;flex-direction:column;background:radial-gradient(circle at 88% -10%,#e2f4f6 0,transparent 34%),var(--app-bg,#f4f8f9);color:var(--app-text,#15323a);overflow-x:clip}
    .portal-nav{position:sticky;top:0;z-index:30;background:linear-gradient(110deg,#102f38,#174754);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff;padding:14px max(18px,calc((100vw - 1180px)/2));display:flex;align-items:center;gap:12px;min-width:0;box-shadow:var(--shadow-sm)}
    .brand{display:flex;align-items:center;gap:11px;min-width:0;margin-right:auto;font-weight:900;letter-spacing:.08em;color:#fff;text-decoration:none;white-space:nowrap}
    .brand img{display:block;height:48px;width:auto;object-fit:contain;background:#fff;border-radius:var(--radius-sm);padding:6px 10px;box-shadow:var(--shadow-sm)}
    .brand-copy{display:grid;min-width:0;line-height:1.05}.brand-copy small{font-size:.54rem;color:#8ed3df;letter-spacing:.13em;margin-bottom:4px}
    .menu-toggle{display:inline-flex;align-items:center;gap:8px;min-height:42px;border-radius:var(--radius-full);border-color:rgba(213,229,232,.7);color:#fff;background:rgba(255,255,255,.08);transition:background-color .2s var(--ease),border-color .2s var(--ease)}.menu-toggle:hover,.menu-toggle[aria-expanded='true']{color:#fff;background:rgba(142,211,223,.22);border-color:#8ed3df}.menu-icon{display:grid;gap:4px;width:17px}.menu-icon i{display:block;width:17px;height:2px;border-radius:2px;background:currentColor}
    .portal-menu{position:absolute;right:max(18px,calc((100vw - 1180px)/2));top:calc(100% + 8px);width:min(330px,calc(100vw - 28px));padding:9px;background:#fff;border:1px solid #d8e8ea;border-radius:var(--radius-md);box-shadow:var(--shadow-lg);animation:menu-in .16s ease-out}.portal-menu:not(.open){display:none}.portal-menu a{position:relative;display:flex;align-items:center;gap:10px;padding:12px 13px;color:#18353d;text-decoration:none;border-radius:11px;font-weight:700;transition:background-color .2s var(--ease),color .2s var(--ease)}.portal-menu a::before{content:'›';font-size:1.35rem;line-height:.7;color:#0a91a3}.portal-menu a:hover,.portal-menu a.active{color:#073c46;background:#e6f5f6}.menu-title{display:block;padding:6px 13px 8px;color:#6e858b;font-size:.67rem;font-weight:900;letter-spacing:.13em}@keyframes menu-in{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}
    .logout{flex:0 0 auto;border-radius:var(--radius-full);transition:transform .15s var(--ease)}.logout:active{transform:scale(.96)}
    .portal-footer{display:flex;justify-content:center;gap:22px;flex-wrap:wrap;padding:18px 20px;background:var(--app-surface-soft,#eaf3f4);color:var(--app-muted,#557178);font-size:.78rem}.portal-footer strong{color:var(--app-accent,#0b7180)}.portal-footer span{display:inline-block}.portal-main{flex:1;max-width:1180px;width:100%;margin:auto;padding:38px 20px max(72px,calc(40px + env(safe-area-inset-bottom)))}
    @media(min-width:900px){.menu-toggle{display:none}.portal-menu{display:flex!important;position:static;width:auto;padding:0;border:0;box-shadow:none;background:transparent;animation:none;gap:4px}.portal-menu .menu-title{display:none}.portal-menu a{color:rgba(255,255,255,.88);padding:9px 12px}.portal-menu a::after{content:'';position:absolute;left:12px;right:12px;bottom:3px;height:2px;background:#8ed3df;border-radius:2px;transform:scaleX(0);transform-origin:left;transition:transform .25s var(--ease)}.portal-menu a:hover,.portal-menu a.active{color:#fff;background:transparent}.portal-menu a:hover::after,.portal-menu a.active::after{transform:scaleX(1)}}
    @media(max-width:760px){.portal-nav{padding:10px 14px;gap:8px}.brand img{height:44px}.brand-copy small{font-size:.46rem}.brand{font-size:.92rem;letter-spacing:.055em}.menu-toggle{min-height:39px;padding-inline:10px}.menu-toggle span:not(.menu-icon){display:none}.logout{font-size:.74rem;padding:.35rem .48rem}.portal-menu{right:14px;top:calc(100% + 6px);width:min(340px,calc(100vw - 28px))}.portal-main{padding:24px 14px max(42px,calc(28px + env(safe-area-inset-bottom)))}}
  `],
  template: `
    <div class="portal"><header class="portal-nav">
      <a routerLink="/client/vehicles" class="brand" aria-label="FIMA AUTO" (click)="menuOpen.set(false)"><img [src]="logoUrl()" alt="Logo FIMA AUTO"></a>
      <button class="btn btn-sm menu-toggle" type="button" [attr.aria-expanded]="menuOpen()" aria-controls="client-navigation" (click)="menuOpen.set(!menuOpen())"><span class="menu-icon" aria-hidden="true"><i></i><i></i><i></i></span><span>Menu</span></button>
      <button class="btn btn-sm btn-outline-light logout" (click)="logout()">Déconnexion</button>
      <nav id="client-navigation" class="portal-menu" [class.open]="menuOpen()" aria-label="Navigation client"><span class="menu-title">ESPACE CLIENT</span><a routerLink="/client/vehicles" routerLinkActive="active" (click)="menuOpen.set(false)">Véhicules disponibles</a><a routerLink="/client/reservations" routerLinkActive="active" (click)="menuOpen.set(false)">Mes réservations</a><a routerLink="/client/contracts" routerLinkActive="active" (click)="menuOpen.set(false)">Contrats</a><a routerLink="/client/inspections" routerLinkActive="active" (click)="menuOpen.set(false)">Mes inspections</a><a routerLink="/client/account" routerLinkActive="active" (click)="menuOpen.set(false)">Mon profil</a></nav>
    </header><main class="portal-main"><router-outlet/></main><footer class="portal-footer"><strong>FIMA AUTO</strong><span>Location de véhicules · Téléphone : {{company().phone || company().secondary_phone || "Non renseigné"}} · WhatsApp : {{company().whatsapp_phone || company().phone || "Non renseigné"}}</span><span>© FIMA AUTO 2026</span></footer></div>
  `
})
export class ClientShellComponent implements OnInit {
  menuOpen = signal(false); company = signal<any>({}); logoUrl = signal("/logo.jpg");
  constructor(private auth: AuthService) {}
  async ngOnInit(){const result=await this.auth.supabase().from('company_settings').select('company_name,phone,secondary_phone,whatsapp_phone,logo_storage_path').limit(1).maybeSingle();if(result.data){this.company.set(result.data);if(result.data.logo_storage_path){const signed=await this.auth.supabase().storage.from('rental-documents').createSignedUrl(result.data.logo_storage_path,300);if(signed.data?.signedUrl)this.logoUrl.set(signed.data.signedUrl);}}}
  async logout() { await this.auth.logout(); location.assign('/client/login'); }
}




