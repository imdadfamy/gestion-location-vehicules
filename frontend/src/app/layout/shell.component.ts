import { Component, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
  <div class="app-shell">
    @if (menuOpen()) { <button class="mobile-backdrop" aria-label="Fermer le menu" (click)="closeMenu()"></button> }
    <aside class="app-sidebar" [class.open]="menuOpen()">
      <div class="brand-panel"><img src="/fima-auto-logo.jpg" alt="FIMA AUTO"><div><small>FIMA AUTO</small><strong>Gestion de flotte</strong></div><button class="close-menu" (click)="closeMenu()" aria-label="Fermer">×</button></div>
      <p class="nav-label">MENU PRINCIPAL</p>
      <nav class="nav-menu" (click)="closeMenu()">
        <a routerLink="/dashboard" routerLinkActive="active"><i>⌂</i><span>Tableau de bord</span></a>
        @if(a.can('vehicles')){<a routerLink="/vehicles" routerLinkActive="active"><i>◇</i><span>Véhicules</span></a>}
        @if(a.can('clients')){<a routerLink="/clients" routerLinkActive="active"><i>◎</i><span>Clients</span></a>}
        @if(a.can('reservations')){<a routerLink="/reservations" routerLinkActive="active"><i>◷</i><span>Réservations</span></a>}
        @if(a.can('rentals')){<a routerLink="/rentals" routerLinkActive="active"><i>▣</i><span>Locations</span></a>}
        @if(a.can('contracts')){<a routerLink="/contracts" routerLinkActive="active"><i>▤</i><span>Contrats</span></a>}
        @if(a.can('payments')){<a routerLink="/payments" routerLinkActive="active"><i>◫</i><span>Paiements</span></a>}
        @if(a.can('inspections')){<a routerLink="/inspections" routerLinkActive="active"><i>⌕</i><span>Inspections</span></a>}
        @if(a.can('maintenance')){<a routerLink="/maintenance" routerLinkActive="active"><i>✦</i><span>Maintenance</span></a>}
        @if(a.can('incidents')){<a routerLink="/incidents" routerLinkActive="active"><i>!</i><span>Incidents</span></a>}
      </nav>
      <p class="nav-label secondary">PILOTAGE</p>
      <nav class="nav-menu" (click)="closeMenu()">
        @if(a.can('notifications')){<a routerLink="/notifications" routerLinkActive="active"><i>●</i><span>Notifications</span>@if(unread()){<b class="notification-count">{{unread()}}</b>}</a>}
        @if(a.can('reports')){<a routerLink="/reports" routerLinkActive="active"><i>↗</i><span>Rapports</span></a>}
        @if(a.profile()?.role==='super_admin'){<a routerLink="/settings" routerLinkActive="active"><i>⚙</i><span>Paramètres</span></a><a routerLink="/contract-templates" routerLinkActive="active"><i>▤</i><span>Modèles</span></a><a routerLink="/activity-logs" routerLinkActive="active"><i>≡</i><span>Journal</span></a><a routerLink="/users" routerLinkActive="active"><i>♙</i><span>Utilisateurs</span></a>}
      </nav>
      <div class="user-panel"><div class="avatar">{{initials()}}</div><div><strong>{{a.profile()?.full_name||'Utilisateur'}}</strong><small>{{a.profile()?.role==='super_admin'?'Super Admin':'Responsable'}}</small></div><button (click)="out()" title="Déconnexion">↪</button></div>
    </aside>
    <main class="app-content"><header class="topbar"><button class="menu-toggle" (click)="openMenu()" aria-label="Ouvrir le menu"><span></span><span></span><span></span></button><div class="topbar-title"><span>FIMA AUTO /</span> Espace de gestion</div><div class="today">Mobilités premium</div></header><section class="page"><router-outlet/></section></main>
  </div>`,
  styles: [`
  .app-shell{display:flex;height:100dvh;overflow:hidden;background:#f4f7f8}.app-sidebar{box-sizing:border-box;width:278px;min-width:278px;background:linear-gradient(165deg,#052932,#0b3c47 58%,#062b35);color:#d9e8ea;padding:20px 14px 14px;display:flex;flex-direction:column;overflow-y:auto;overscroll-behavior:contain;box-shadow:16px 0 42px rgba(5,41,50,.12);z-index:20}.brand-panel{margin:0 6px 28px;padding:10px;display:flex;align-items:center;gap:12px}.brand-panel img{width:50px;height:50px;object-fit:cover;border-radius:14px;background:#fff;padding:2px}.brand-panel small{display:block;color:#4cd5dd;font-size:.62rem;letter-spacing:.16em;font-weight:800}.brand-panel strong{display:block;color:#fff;font-size:1rem;margin-top:3px}.close-menu{display:none}.nav-label{margin:0 12px 9px;color:#73a3aa;font-size:.62rem;letter-spacing:.16em;font-weight:800}.nav-label.secondary{margin-top:21px}.nav-menu{display:grid;gap:3px}.nav-menu a{display:flex;align-items:center;gap:13px;padding:10px 12px;text-decoration:none;color:#c7d9dc;border:1px solid transparent;border-radius:12px;font-weight:650;font-size:.92rem;transition:.22s ease}.nav-menu a i{font-style:normal;width:18px;text-align:center;color:#7cbfc7;font-size:1rem}.nav-menu a:hover{background:rgba(255,255,255,.07);color:#fff;transform:translateX(2px)}.nav-menu a.active{background:linear-gradient(100deg,rgba(16,164,177,.31),rgba(16,164,177,.12));border-color:rgba(93,224,231,.25);color:#fff;box-shadow:inset 3px 0 #4fd4dc}.notification-count{margin-left:auto;min-width:18px;padding:1px 5px;border-radius:999px;background:#f3b244;color:#20383e;font-size:.7rem;text-align:center}.user-panel{margin-top:auto;padding:14px 10px 4px;display:flex;gap:9px;align-items:center;border-top:1px solid rgba(255,255,255,.12)}.avatar{display:grid;place-items:center;width:33px;height:33px;border-radius:50%;background:#16a7b4;color:#fff;font-size:.72rem;font-weight:800}.user-panel strong,.user-panel small{display:block;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.user-panel strong{font-size:.78rem;color:#fff}.user-panel small{font-size:.68rem;color:#83aab0}.user-panel button{margin-left:auto;border:0;background:transparent;color:#9ec5ca;font-size:1.2rem}.app-content{flex:1;min-width:0;height:100dvh;overflow-y:auto;overscroll-behavior:contain}.topbar{height:74px;padding:0 40px;display:flex;align-items:center;gap:16px;background:rgba(255,255,255,.85);backdrop-filter:blur(12px);border-bottom:1px solid #e2ebed;color:#688087;font-size:.87rem;position:sticky;top:0;z-index:10}.topbar-title span{font-size:.68rem;font-weight:900;letter-spacing:.13em;color:#0b9cac}.today{margin-left:auto;font-size:.75rem;color:#8aa1a7}.menu-toggle{display:none;border:0;background:transparent;width:42px;height:42px;padding:10px;flex-direction:column;gap:5px;justify-content:center}.menu-toggle span{display:block;height:2px;border-radius:2px;background:#073640;width:22px}.page{padding:38px 42px;max-width:1700px;margin:auto}.mobile-backdrop{display:none}
  @media(max-width:980px){.app-sidebar{width:230px;min-width:230px}.page{padding:26px 24px}.topbar{padding:0 24px}}
  @media(max-width:760px){.app-sidebar{position:fixed;inset:0 auto 0 0;width:282px;min-width:282px;transform:translateX(-105%);transition:transform .22s ease;box-shadow:20px 0 50px rgba(0,0,0,.28)}.app-sidebar.open{transform:translateX(0)}.mobile-backdrop{display:block;position:fixed;inset:0;border:0;background:rgba(4,27,32,.46);z-index:19}.app-content{width:100%;min-width:0}.topbar{height:60px;padding:0 14px;gap:8px}.menu-toggle{display:flex}.topbar-title{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.78rem}.topbar-title span{font-size:.6rem}.today{display:none}.close-menu{display:block;margin-left:auto;border:0;background:transparent;color:#d9e8ea;font-size:1.65rem;line-height:1}.page{padding:20px 14px}.brand-panel{margin-bottom:18px}.nav-menu a{padding:11px 12px;font-size:.95rem}.user-panel{padding-bottom:8px}}
  `]
})
export class ShellComponent implements OnInit {unread=signal(0);menuOpen=signal(false);constructor(public a:AuthService){}async ngOnInit(){if(this.a.can('notifications')){const r=await this.a.supabase().from('notifications').select('id',{count:'exact',head:true}).eq('is_read',false);this.unread.set(r.count??0)}}openMenu(){this.menuOpen.set(true)}closeMenu(){this.menuOpen.set(false)}initials(){return(this.a.profile()?.full_name||'FA').split(' ').map((x:string)=>x[0]).join('').slice(0,2).toUpperCase()}async out(){await this.a.logout();location.assign('/login')}}
