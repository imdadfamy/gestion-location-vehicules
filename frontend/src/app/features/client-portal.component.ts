import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .vehicle-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:22px}.vehicle-card{overflow:hidden;border:1px solid #dce8ea;border-radius:20px;box-shadow:0 12px 30px rgba(12,53,63,.09);cursor:pointer;transition:transform .18s ease,box-shadow .18s ease;background:#fff}.vehicle-card:hover,.vehicle-card:focus-within{transform:translateY(-4px);box-shadow:0 19px 38px rgba(12,53,63,.16)}.vehicle-media{position:relative;height:190px;background:linear-gradient(135deg,#e7f1f3,#d4e7ea);overflow:hidden}.vehicle-photo{height:100%;width:100%;object-fit:cover;display:block;cursor:pointer;transition:transform .25s ease}.vehicle-card:hover .vehicle-photo{transform:scale(1.025)}.placeholder{display:grid;place-items:center;font-size:3rem;color:#54818a;cursor:pointer}.photo-count{position:absolute;right:12px;bottom:12px;padding:5px 9px;border-radius:999px;background:rgba(12,40,48,.78);color:#fff;font-size:.75rem;font-weight:700}.vehicle-card .card-body{padding:20px}.vehicle-card h2{margin:0 0 5px;color:#14323a}.vehicle-meta{font-size:.9rem;color:#6a7f85}.vehicle-price{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:15px}.vehicle-price strong{font-size:1.06rem;color:#12323b}.details-link{border:0;padding:0;background:transparent;color:#087d8e;font-size:.86rem;font-weight:750;text-decoration:underline}.filters{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:12px;margin:18px 0 28px;padding:18px;border:1px solid #dfebed;border-radius:18px;background:rgba(255,255,255,.72);box-shadow:0 8px 24px rgba(9,44,51,.04)}.filters label{display:block;font-weight:700;font-size:.86rem;margin:0 0 6px}.filters .btn{min-height:45px}@keyframes drawerInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}
    @keyframes drawerInBottom{from{transform:translateY(100%)}to{transform:translateY(0)}}
    @keyframes drawerFade{from{opacity:0}to{opacity:1}}
    .drawer-overlay{position:fixed;inset:0;z-index:1055;display:flex;justify-content:flex-end;background:rgba(5,29,35,.55);animation:drawerFade .2s ease}
    .drawer-panel{width:min(460px,100%);height:100dvh;background:#fff;display:flex;flex-direction:column;box-shadow:-20px 0 60px rgba(0,0,0,.25);animation:drawerInRight .28s cubic-bezier(.22,1,.36,1)}
    .drawer-head{display:flex;justify-content:flex-end;padding:14px 16px 0;flex:0 0 auto}
    .drawer-close{border:0;background:rgba(10,40,48,.06);width:36px;height:36px;border-radius:50%;font-size:1.25rem;line-height:1;color:#14323a;cursor:pointer}
    .drawer-close:hover{background:rgba(10,40,48,.12)}
    .drawer-body{flex:1;overflow-y:auto;padding:2px 24px 20px}
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
    .drawer-body label{font-weight:700;font-size:.86rem;margin-bottom:5px;display:block}
    .drawer-footer{position:sticky;bottom:0;background:#fff;border-top:1px solid #e7eef0;padding:14px 24px calc(14px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px;flex:0 0 auto}
    .footer-total{display:flex;justify-content:space-between;font-size:.88rem;color:#14323a;font-weight:700}
    .footer-total small{color:#6a7f85;font-weight:600}
    @media(max-width:700px){
      .vehicle-grid{grid-template-columns:1fr;gap:16px}
      .filters{grid-template-columns:1fr;gap:10px;margin:14px 0 20px;padding:14px}
      .filters .btn{width:100%}
      .vehicle-media{height:215px}
      .vehicle-card .card-body{padding:18px}
      .drawer-overlay{align-items:flex-end;justify-content:center}
      .drawer-panel{width:100%;height:auto;max-height:92dvh;border-radius:22px 22px 0 0;animation:drawerInBottom .28s cubic-bezier(.22,1,.36,1)}
      .drawer-gallery-main{height:200px}
      .drawer-body{padding:2px 18px 16px}
      .drawer-footer{padding:14px 18px calc(14px + env(safe-area-inset-bottom))}
    }
  `],
  template: `
<div class="page-heading"><div><p class="eyebrow">RÉSERVATION EN LIGNE</p><h1>Véhicules disponibles</h1><p>Choisissez vos dates : seules les voitures réellement disponibles sont proposées.</p></div></div>
<div class="filters"><div><label>Départ prévu</label><input class="form-control" type="datetime-local" [(ngModel)]="departure" (change)="load()"></div><div><label>Retour prévu</label><input class="form-control" type="datetime-local" [(ngModel)]="returnDate" (change)="load()"></div><button class="btn btn-outline-primary align-self-end" (click)="load()">Actualiser</button></div><div class="filters"><div><label>Catégorie</label><select class="form-select" [(ngModel)]="category"><option value="">Toutes</option><option value="SUV">SUV</option><option value="Berline">Berline</option><option value="Citadine">Citadine</option></select></div><div><label>Boîte</label><select class="form-select" [(ngModel)]="transmission"><option value="">Toutes</option><option value="automatic">Automatique</option><option value="manual">Manuelle</option></select></div><div><label>Carburant</label><select class="form-select" [(ngModel)]="fuel"><option value="">Tous</option><option value="essence">Essence</option><option value="diesel">Diesel</option><option value="hybrid">Hybride</option></select></div><div><label>Tri</label><select class="form-select" [(ngModel)]="sort"><option value="">Pertinence</option><option value="asc">Prix croissant</option><option value="desc">Prix décroissant</option></select></div></div>
@if(error()){<div class="alert alert-danger">{{error()}}</div>}@if(message()){<div class="alert alert-success">{{message()}}</div>}@if(loading()){<div class="empty-state">Recherche des véhicules…</div>}@else if(!visibleVehicles().length){<div class="empty-state">Aucun véhicule disponible pour cette période.</div>}@else{<div class="vehicle-grid">@for(v of visibleVehicles();track v.id){<article class="vehicle-card" role="button" tabindex="0" (click)="openProduct(v)" (keydown.enter)="openProduct(v)"><div class="vehicle-media">@if(v.photos?.length){<img class="vehicle-photo" [src]="v.photos[0]" alt="{{v.make}} {{v.model}}">@if(v.photos.length>1){<span class="photo-count">{{v.photos.length}} photos</span>}}@else{<div class="vehicle-photo placeholder" aria-label="Aucune photo disponible">🚘</div>}</div><div class="card-body"><h2 class="h5">{{v.make}} {{v.model}}</h2><p class="vehicle-meta mb-0">{{v.registration_number}} · {{v.color||'Couleur non renseignée'}}</p><div class="vehicle-price"><strong>{{money(v.rental_price)}} / jour</strong><button class="details-link" (click)="$event.stopPropagation();openProduct(v)">Voir la fiche</button></div></div></article>}</div>}
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
        <p class="drawer-meta">{{product().registration_number}} · {{product().color||'Couleur non renseignée'}}</p>
        <div class="pill-row">
          <span class="pill">{{product().category||'Catégorie non renseignée'}}</span>
          <span class="pill">{{product().transmission==='automatic'?'Automatique':product().transmission==='manual'?'Manuelle':'Boîte non renseignée'}}</span>
          <span class="pill">{{product().fuel_type||'Carburant non renseigné'}}</span>
          <span class="pill">{{product().year||'Année non renseignée'}}</span>
        </div>
        <div class="price-line"><span class="label">Tarif de location</span><strong>{{money(product().rental_price)}} / jour</strong></div>
        <p class="deposit-note">Caution : {{money(product().deposit_amount)}}</p>
        @if(error()){<div class="alert alert-danger">{{error()}}</div>}
        <label>Observation facultative</label>
        <textarea class="form-control" rows="3" [(ngModel)]="observation"></textarea>
      </div>
    </div>
    <div class="drawer-footer">
      @if(departure && returnDate){<div class="footer-total"><small>{{bookingDays()}} jour{{bookingDays()>1?'s':''}}</small><span>{{money(bookingTotal())}}</span></div>}
      @else{<div class="footer-total"><small>Choisissez vos dates pour voir le total</small></div>}
      <button class="btn btn-primary" [disabled]="saving()" (click)="submitReservation()">{{saving()?'Envoi…':'Réserver ce véhicule'}}</button>
    </div>
  </section>
</div>
}`
})
export class ClientPortalComponent implements OnInit {
  vehicles = signal<any[]>([]); product = signal<any>(null); activePhoto = signal<string | null>(null); loading = signal(false); saving = signal(false); error = signal(''); message = signal(''); departure = ''; returnDate = ''; observation = ''; category = ''; transmission = ''; fuel = ''; sort = '';
  private pendingVehicleId: string | null = null;
  constructor(private auth: AuthService, private route: ActivatedRoute) {}
  ngOnInit(){ const q = this.route.snapshot.queryParamMap; this.departure = q.get('depart') ?? ''; this.returnDate = q.get('retour') ?? ''; this.pendingVehicleId = q.get('vehicle'); void this.load(); }
  money(value:any){ return Number(value ?? 0).toLocaleString('fr-FR').replace(/\\u202f/g, ' ')+' FCFA'; }
  bookingDays(){const start=new Date(this.departure).getTime(),end=new Date(this.returnDate).getTime();return Math.max(1,Math.ceil((end-start)/86400000));}
  bookingTotal(){return this.bookingDays()*Number(this.product()?.rental_price??0);}
  visibleVehicles(){const rows=this.vehicles().filter(v=>(!this.category||String(v.category??'').toLowerCase()===this.category.toLowerCase())&&(!this.transmission||String(v.transmission??'').toLowerCase().includes(this.transmission))&&(!this.fuel||String(v.fuel_type??'').toLowerCase().includes(this.fuel)));return this.sort?rows.sort((a,b)=>(Number(a.rental_price)-Number(b.rental_price))*(this.sort==='asc'?1:-1)):rows;}
  async load(){this.loading.set(true);this.error.set('');const result=await this.auth.supabase().rpc('client_available_vehicles',{target_departure:this.departure?new Date(this.departure).toISOString():null,target_return:this.returnDate?new Date(this.returnDate).toISOString():null});this.loading.set(false);if(result.error){this.error.set(this.auth.errorMessage(result.error));return}let failedPhotos=0;const rows=await Promise.all((result.data??[]).map(async(vehicle:any)=>{const paths:string[]=vehicle.photo_storage_paths??(vehicle.photo_storage_path?[vehicle.photo_storage_path]:[]);const urls=await Promise.all(paths.map(async path=>{const storage=this.auth.supabase().storage.from('rental-documents');const signed=await storage.createSignedUrl(path,600);if(signed.data?.signedUrl)return signed.data.signedUrl;const file=await storage.download(path);if(file.data)return URL.createObjectURL(file.data);failedPhotos++;return null}));return{...vehicle,photos:urls.filter(Boolean)}}));this.vehicles.set(rows);if(failedPhotos)this.error.set('Certaines photos du véhicule ne peuvent pas être chargées. Vérifiez que les fichiers ont bien été ajoutés dans « Photos du véhicule ».');if(this.pendingVehicleId){const match=rows.find(v=>v.id===this.pendingVehicleId);this.pendingVehicleId=null;if(match)this.openProduct(match)}}
  openProduct(vehicle:any){this.error.set('');this.observation='';this.product.set(vehicle);this.activePhoto.set(vehicle.photos?.[0]??null)} closeProduct(){this.product.set(null);this.activePhoto.set(null)}
  async submitReservation(){const vehicle=this.product();if(!vehicle)return;this.error.set('');this.message.set('');if(!this.departure||!this.returnDate){this.error.set('Choisissez d’abord les dates et heures de départ et de retour.');return}if(new Date(this.returnDate)<=new Date(this.departure)){this.error.set('La date de retour doit être postérieure au départ.');return}this.saving.set(true);const result=await this.auth.supabase().rpc('client_create_reservation',{target_vehicle_id:vehicle.id,target_departure:new Date(this.departure).toISOString(),target_return:new Date(this.returnDate).toISOString(),target_observation:this.observation||null});this.saving.set(false);if(result.error){this.error.set(this.auth.errorMessage(result.error));return}this.closeProduct();this.observation='';this.message.set('Votre réservation a été envoyée. Vous pouvez la suivre dans « Mes réservations ».');await this.load()}
}
