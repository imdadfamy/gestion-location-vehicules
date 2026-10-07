import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ScrollRevealDirective } from '../shared/scroll-reveal.directive';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ScrollRevealDirective],
  styles: [`
    :host{
      --bg:#f4f8f9;--surface:#ffffff;--border:#e1ebed;--border-strong:#cfe3e6;
      --text:#15323a;--muted:#5f7a80;--muted-soft:#8198a0;
      --primary:#0792a4;--primary-dark:#06707f;--primary-soft:#e4f4f6;
      --petrol:#123943;--petrol-deep:#0b2429;--ring:rgba(7,146,164,.22);
      --radius-sm:12px;--radius-md:16px;--radius-lg:22px;--radius-full:999px;
      --shadow-sm:0 2px 8px rgba(13,41,49,.06);
      --shadow-md:0 12px 28px rgba(13,41,49,.10);
      --shadow-lg:0 22px 48px rgba(13,41,49,.16);
      --ease:cubic-bezier(.22,1,.36,1);
      display:block;
    }
    .public-page{min-height:100dvh;background:var(--bg);color:var(--text)}
    .reveal{opacity:0;transform:translateY(18px);transition:opacity .6s var(--ease),transform .6s var(--ease)}
    .reveal-visible{opacity:1;transform:none}
    @media (prefers-reduced-motion: reduce){.reveal{transition:none;opacity:1;transform:none}}

    .topbar{position:fixed;top:0;left:0;right:0;width:100%;z-index:40;color:#fff;padding:12px 5%;display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px}
    .topbar::before{content:'';position:absolute;inset:0;z-index:-1;background:rgba(18,57,67,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid rgba(255,255,255,.08)}
    .header-spacer{height:78px}
    .logo{display:block;height:36px;width:auto;object-fit:contain}
    .nav{display:flex;flex-wrap:wrap;gap:10px 14px;margin-left:auto;align-items:center}
    .nav a:not(.btn){color:rgba(255,255,255,.88);text-decoration:none;font-weight:600;font-size:.92rem;transition:color .2s var(--ease)}
    .nav a:not(.btn):hover{color:#fff}
    .btn-pill{border-radius:var(--radius-full);font-weight:650;transition:transform .15s var(--ease),box-shadow .2s var(--ease)}
    .nav .btn-outline-light{border-color:rgba(255,255,255,.5);color:#fff}
    .nav .btn-outline-light:hover{background:rgba(255,255,255,.12);border-color:#fff;color:#fff}
    .nav .btn-light{background:#fff;color:#0b2429;border-color:#fff}
    .nav .btn-light:hover{background:#eaf7f8}
    .btn-pill:active{transform:scale(.97)}

    .wrap{max-width:1180px;margin:auto;padding:46px 5% 80px}
    .page-heading h1{font-weight:800;letter-spacing:-.01em}
    .page-heading p{color:var(--muted)}
    .eyebrow{font-size:.72rem;font-weight:800;letter-spacing:.14em;color:var(--primary);text-transform:uppercase}

    .filters{display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:12px;background:var(--surface);padding:18px;border-radius:var(--radius-lg);box-shadow:var(--shadow-sm);border:1px solid var(--border);margin:22px 0 8px}
    .filters label{font-size:.72rem;font-weight:800;letter-spacing:.03em;color:var(--muted);text-transform:uppercase;display:block;margin-bottom:5px}
    .filters .form-control,.filters .form-select{border-radius:var(--radius-sm);border:1px solid var(--border-strong);min-height:46px;transition:border-color .2s var(--ease),box-shadow .2s var(--ease)}
    .filters .form-control:focus,.filters .form-select:focus{border-color:var(--primary);box-shadow:0 0 0 4px var(--ring)}
    .btn-refresh{border:1px solid var(--border-strong);background:var(--surface);color:var(--text);border-radius:var(--radius-sm);min-height:46px;font-weight:700;transition:all .2s var(--ease)}
    .btn-refresh:hover{background:var(--petrol);border-color:var(--petrol);color:#fff}

    .cat-wrap{display:flex;justify-content:center;margin:22px 0 30px}
    .cat-group{display:inline-flex;gap:3px;padding:4px;background:#eaf2f3;border-radius:var(--radius-full)}
    .cat-pill{border:0;background:transparent;color:var(--muted);border-radius:var(--radius-full);padding:9px 18px;font-size:.85rem;font-weight:700;cursor:pointer;transition:background-color .25s var(--ease),color .25s var(--ease),box-shadow .25s var(--ease)}
    .cat-pill.active{background:var(--surface);color:var(--text);box-shadow:var(--shadow-sm)}

    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
    .cardx{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;display:flex;flex-direction:column;transition:transform .25s var(--ease),box-shadow .25s var(--ease)}
    .cardx:hover{transform:translateY(-5px);box-shadow:var(--shadow-md)}
    .cardx-media{height:170px;background:linear-gradient(135deg,#e7f1f3,#d4e7ea);overflow:hidden}
    .cardx-media img{width:100%;height:100%;object-fit:cover;display:block}
    .cardx-media .placeholder{display:grid;place-items:center;height:100%;font-size:2.6rem;color:#54818a}
    .cardx-body{padding:18px 22px 22px;display:flex;flex-direction:column;gap:6px}
    .badge-cat{align-self:flex-start;background:var(--primary-soft);color:var(--primary-dark);font-weight:750;font-size:.7rem;letter-spacing:.03em;text-transform:uppercase;border-radius:var(--radius-full);padding:5px 12px;margin-bottom:6px}
    .cardx h2{font-size:1.08rem;font-weight:750;margin:0}
    .price{color:var(--primary-dark);font-weight:800;margin-top:6px}
    .card-actions{display:flex;gap:8px;margin-top:4px}
    .card-actions .btn{flex:1}
    .btn-outline-cta{border:1px solid var(--border-strong);color:var(--text);background:var(--surface);border-radius:var(--radius-sm);font-weight:700;transition:all .2s var(--ease)}
    .btn-outline-cta:hover{background:var(--petrol);border-color:var(--petrol);color:#fff}
    .btn-reserve{background:var(--primary);border:1px solid var(--primary);color:#fff;border-radius:var(--radius-sm);font-weight:700;transition:background-color .2s var(--ease),transform .15s var(--ease),box-shadow .2s var(--ease);box-shadow:0 8px 16px rgba(7,146,164,.26)}
    .btn-reserve:hover{background:var(--primary-dark);border-color:var(--primary-dark)}
    .btn-reserve:active{transform:scale(.97)}
    .empty-state{color:var(--muted);text-align:center;padding:44px;border:1px dashed var(--border-strong);border-radius:var(--radius-md);grid-column:1/-1}

    @keyframes drawerInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}
    @keyframes drawerInBottom{from{transform:translateY(100%)}to{transform:translateY(0)}}
    @keyframes drawerFade{from{opacity:0}to{opacity:1}}
    .drawer-overlay{position:fixed;inset:0;z-index:1055;display:flex;justify-content:flex-end;background:rgba(5,29,35,.55);animation:drawerFade .2s ease}
    .drawer-panel{width:min(460px,100%);height:100dvh;background:#fff;display:flex;flex-direction:column;box-shadow:-20px 0 60px rgba(0,0,0,.25);animation:drawerInRight .28s cubic-bezier(.22,1,.36,1)}
    .drawer-head{display:flex;justify-content:flex-end;padding:14px 16px 0;flex:0 0 auto}
    .drawer-close{border:0;background:rgba(10,40,48,.06);width:36px;height:36px;border-radius:50%;font-size:1.25rem;line-height:1;color:#14323a;cursor:pointer}
    .drawer-close:hover{background:rgba(10,40,48,.12)}
    .drawer-body{flex:1;overflow-y:auto;padding:2px 24px 24px}
    .drawer-gallery-main{height:230px;border-radius:16px;overflow:hidden;background:#dbe9eb;margin-bottom:10px}
    .drawer-gallery-main img{width:100%;height:100%;object-fit:cover;display:block}
    .drawer-gallery-empty{display:grid;place-items:center;height:100%;font-size:3.4rem;color:#6d969e}
    .drawer-thumbs{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px}
    .drawer-thumb{width:62px;height:46px;flex:0 0 auto;padding:0;border:2px solid transparent;border-radius:9px;overflow:hidden;background:#fff}
    .drawer-thumb.active{border-color:#0792a4}
    .drawer-thumb img{width:100%;height:100%;object-fit:cover}
    .drawer-eyebrow{margin:16px 0 2px}
    .drawer-info h2{margin:0 0 4px;font-size:1.4rem;color:#14323a}
    .drawer-meta{color:#6a7f85;font-size:.9rem;margin:0 0 14px}
    .pill-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:6px}
    .pill{padding:6px 12px;border-radius:999px;background:#f1f6f7;color:#2a4850;font-size:.8rem;font-weight:650}
    .price-line{display:flex;align-items:baseline;justify-content:space-between;padding:14px 0;border-top:1px solid #e7eef0;border-bottom:1px solid #e7eef0;margin-top:14px}
    .price-line .label{color:#6a7f85;font-size:.85rem}
    .price-line strong{font-size:1.3rem;color:#0b2429}
    .deposit-note{color:#6a7f85;font-size:.82rem;margin:8px 0 18px}
    .drawer-reserve{width:100%;min-height:48px}
    @media(max-width:700px){
      .drawer-overlay{align-items:flex-end;justify-content:center}
      .drawer-panel{width:100%;height:auto;max-height:92dvh;border-radius:22px 22px 0 0;animation:drawerInBottom .28s cubic-bezier(.22,1,.36,1)}
      .drawer-gallery-main{height:200px}
      .drawer-body{padding:2px 18px 18px}
    }

    @media(max-width:900px){.filters{grid-template-columns:1fr 1fr}.grid{grid-template-columns:1fr 1fr}}
    @media(max-width:560px){
      .topbar{padding:10px 4%;gap:8px}
      .nav a:not(.btn){display:none}
      .nav{gap:8px}
      .nav .btn{padding:.42rem .85rem;font-size:.8rem;white-space:nowrap}
      .logo{height:30px}
      .header-spacer{height:60px}
    }
    @media(max-width:600px){.filters{grid-template-columns:1fr}.grid{grid-template-columns:1fr}}
  `],
  template: `
    <main class="public-page">
      <header class="topbar">
        <a routerLink="/"><img class="logo" src="/logo-horizontal-white.png" alt="FIMA AUTO"></a>
        <nav class="nav">
          <a routerLink="/">Accueil</a>
          <a routerLink="/client/login" class="btn btn-pill btn-outline-light btn-sm">Se connecter</a>
          <a routerLink="/client/register" class="btn btn-pill btn-light btn-sm">Créer un compte</a>
        </nav>
      </header>
      <div class="header-spacer" aria-hidden="true"></div>
      <div class="wrap">
        <div class="page-heading" appReveal><p class="eyebrow">CATALOGUE</p><h1>Nos véhicules disponibles</h1><p>Choisissez vos dates pour voir les véhicules réellement disponibles. La connexion n'est demandée qu'au moment de réserver.</p></div>

        <div class="filters" appReveal>
          <div><label>Départ</label><input class="form-control" type="datetime-local" [(ngModel)]="departure" (change)="load()"></div>
          <div><label>Retour</label><input class="form-control" type="datetime-local" [(ngModel)]="returnDate" (change)="load()"></div>
          <div><label>Boîte</label><select class="form-select" [(ngModel)]="transmission"><option value="">Toutes</option><option value="automatic">Automatique</option><option value="manual">Manuelle</option></select></div>
          <div><label>Tri</label><select class="form-select" [(ngModel)]="sort"><option value="">Pertinence</option><option value="asc">Prix croissant</option><option value="desc">Prix décroissant</option></select></div>
          <button class="btn btn-refresh" (click)="load()">Actualiser</button>
        </div>

        <div class="cat-wrap"><div class="cat-group">
          <button class="cat-pill" [class.active]="category===''" (click)="category=''">Toutes</button>
          <button class="cat-pill" [class.active]="category==='Citadine'" (click)="category='Citadine'">Citadine</button>
          <button class="cat-pill" [class.active]="category==='Berline'" (click)="category='Berline'">Berline</button>
          <button class="cat-pill" [class.active]="category==='SUV'" (click)="category='SUV'">SUV</button>
        </div></div>

        @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
        @if (loading()) { <div class="empty-state">Recherche des véhicules…</div> }
        @else if (!visibleVehicles().length) { <div class="empty-state">Aucun véhicule disponible pour cette période.</div> }
        @else {
          <div class="grid">
            @for (v of visibleVehicles(); track v.id; let i = $index) {
              <article class="cardx" [appReveal]="i * 60">
                <div class="cardx-media">
                  @if (v.photoUrl) { <img [src]="v.photoUrl" alt="{{ v.make }} {{ v.model }}"> }
                  @else { <div class="placeholder" aria-label="Aucune photo disponible">🚘</div> }
                </div>
                <div class="cardx-body">
                  <span class="badge-cat">{{ v.category || 'Véhicule' }}</span>
                  <h2>{{ v.make }} {{ v.model }}</h2>
                  <p class="text-muted small mb-0">{{ v.transmission === 'automatic' ? 'Boîte automatique' : v.transmission === 'manual' ? 'Boîte manuelle' : 'Boîte non renseignée' }} · {{ v.fuel_type || 'Carburant non renseigné' }}</p>
                  <p class="price">À partir de {{ money(v.rental_price) }} / jour</p>
                  <div class="card-actions">
                    <button class="btn btn-outline-cta" (click)="openProduct(v)">Voir la fiche</button>
                    <button class="btn btn-reserve" (click)="reserve(v)">Réserver</button>
                  </div>
                </div>
              </article>
            }
          </div>
        }
      </div>
    </main>
    @if(product()){
      <div class="drawer-overlay" (click)="closeProduct()">
        <section class="drawer-panel" role="dialog" aria-modal="true" aria-label="Fiche véhicule" (click)="$event.stopPropagation()">
          <div class="drawer-head"><button class="drawer-close" (click)="closeProduct()" aria-label="Fermer">×</button></div>
          <div class="drawer-body">
            <div class="drawer-gallery-main">
              @if(activePhoto()){<img [src]="activePhoto()!" alt="{{product().make}} {{product().model}}">}
              @else{<div class="drawer-gallery-empty">🚘</div>}
            </div>
            @if(product().photos?.length>1){
              <div class="drawer-thumbs">
                @for(photo of product().photos;track photo;let i=$index){
                  <button class="drawer-thumb" [class.active]="activePhoto()===photo" (click)="activePhoto.set(photo)" [attr.aria-label]="'Voir la photo '+(i+1)"><img [src]="photo" alt="Photo {{i+1}} du véhicule"></button>
                }
              </div>
            }
            <div class="drawer-info">
              <p class="eyebrow drawer-eyebrow">FICHE VÉHICULE</p>
              <h2>{{product().make}} {{product().model}}</h2>
              <p class="drawer-meta">{{product().color||'Couleur non renseignée'}}</p>
              <div class="pill-row">
                <span class="pill">{{product().category||'Catégorie non renseignée'}}</span>
                <span class="pill">{{product().transmission==='automatic'?'Automatique':product().transmission==='manual'?'Manuelle':'Boîte non renseignée'}}</span>
                <span class="pill">{{product().fuel_type||'Carburant non renseigné'}}</span>
                <span class="pill">{{product().year||'Année non renseignée'}}</span>
              </div>
              <div class="price-line"><span class="label">Tarif de location</span><strong>{{money(product().rental_price)}} / jour</strong></div>
              <p class="deposit-note">Caution : {{money(product().deposit_amount)}}</p>
              <button class="btn btn-reserve drawer-reserve" (click)="closeProduct();reserve(product())">Réserver ce véhicule</button>
            </div>
          </div>
        </section>
      </div>
    }
  `
})
export class PublicVehiclesComponent implements OnInit {
  vehicles = signal<any[]>([]); loading = signal(false); error = signal('');
  product = signal<any>(null); activePhoto = signal<string | null>(null);
  departure = ''; returnDate = ''; category = ''; transmission = ''; sort = '';

  constructor(private auth: AuthService, private router: Router, private route: ActivatedRoute) {}

  ngOnInit() {
    const q = this.route.snapshot.queryParamMap;
    this.departure = q.get('depart') ?? '';
    this.returnDate = q.get('retour') ?? '';
    this.category = q.get('category') ?? '';
    void this.load();
  }

  money(value: any) { return Number(value ?? 0).toLocaleString('fr-FR') + ' FCFA'; }

  visibleVehicles() {
    const rows = this.vehicles().filter(v =>
      (!this.category || String(v.category ?? '').toLowerCase() === this.category.toLowerCase()) &&
      (!this.transmission || String(v.transmission ?? '').toLowerCase().includes(this.transmission))
    );
    return this.sort ? rows.sort((a, b) => (Number(a.rental_price) - Number(b.rental_price)) * (this.sort === 'asc' ? 1 : -1)) : rows;
  }

  async load() {
    this.loading.set(true); this.error.set('');
    const result = await this.auth.supabase().rpc('public_available_vehicles', {
      target_departure: this.departure ? new Date(this.departure).toISOString() : null,
      target_return: this.returnDate ? new Date(this.returnDate).toISOString() : null
    });
    this.loading.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    const rows = await Promise.all((result.data ?? []).map(async (vehicle: any) => {
      const paths: string[] = vehicle.photo_storage_paths ?? [];
      const urls = await Promise.all(paths.map(async (path: string) => {
        const signed = await this.auth.supabase().storage.from('rental-documents').createSignedUrl(path, 600);
        return signed.data?.signedUrl ?? null;
      }));
      const photos = urls.filter(Boolean) as string[];
      return { ...vehicle, photos, photoUrl: photos[0] ?? null };
    }));
    this.vehicles.set(rows);
  }

  openProduct(vehicle: any) { this.product.set(vehicle); this.activePhoto.set(vehicle.photos?.[0] ?? null); }
  closeProduct() { this.product.set(null); this.activePhoto.set(null); }

  async reserve(vehicle: any) {
    if (!this.departure || !this.returnDate) { this.error.set('Choisissez d’abord les dates et heures de départ et de retour.'); return; }
    if (new Date(this.returnDate) <= new Date(this.departure)) { this.error.set('La date de retour doit être postérieure au départ.'); return; }
    await this.auth.init();
    const target = { vehicle: vehicle.id, depart: this.departure, retour: this.returnDate };
    if (this.auth.profile()?.role === 'client') { await this.router.navigate(['/client/vehicles'], { queryParams: target }); return; }
    await this.router.navigate(['/client/login'], { queryParams: target });
  }
}
