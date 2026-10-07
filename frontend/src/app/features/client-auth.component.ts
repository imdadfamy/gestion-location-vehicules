import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({standalone:true,imports:[FormsModule,RouterLink],styles:[`
  :host{
    --bg:#f4f8f9;--surface:#ffffff;--border:#e1ebed;--border-strong:#cfe3e6;
    --text:#15323a;--muted:#5f7a80;
    --primary:#0792a4;--primary-dark:#06707f;--primary-soft:#e4f4f6;
    --petrol:#123943;--petrol-deep:#0b2429;--ring:rgba(7,146,164,.22);
    --radius-sm:12px;--radius-md:16px;--radius-lg:22px;--radius-full:999px;
    --shadow-md:0 12px 28px rgba(13,41,49,.10);--shadow-lg:0 22px 48px rgba(13,41,49,.16);
    --ease:cubic-bezier(.22,1,.36,1);
    display:block;
  }
  .auth-page{min-height:100dvh;display:grid;grid-template-columns:1fr 1fr;background:var(--bg)}
  .auth-aside{position:relative;background:radial-gradient(circle at 85% -10%,rgba(142,211,223,.18),transparent 46%),linear-gradient(135deg,var(--petrol),#1c6c7d 70%,var(--primary));color:#fff;padding:48px 52px;display:flex;flex-direction:column;overflow:clip}
  .back-link{display:inline-flex;align-items:center;gap:6px;color:rgba(255,255,255,.82);text-decoration:none;font-size:.88rem;font-weight:650;transition:color .2s var(--ease);width:fit-content}
  .back-link:hover{color:#fff}
  .back-link svg{width:16px;height:16px}
  .aside-logo{height:48px;width:auto;object-fit:contain;background:#fff;border-radius:var(--radius-sm);padding:6px 10px;box-shadow:var(--shadow-md);margin:32px 0 28px;display:block}
  .aside-title{font-size:1.7rem;font-weight:800;letter-spacing:-.01em;max-width:380px;line-height:1.2;margin-bottom:10px}
  .aside-sub{color:#d7eef0;max-width:360px;margin-bottom:34px}
  .perk{display:flex;align-items:flex-start;gap:12px;margin-bottom:18px}
  .perk .icon{flex:0 0 auto;width:34px;height:34px;display:grid;place-items:center;border-radius:var(--radius-sm);background:rgba(255,255,255,.12);color:#bfe9ef}
  .perk .icon svg{width:17px;height:17px}
  .perk strong{display:block;font-size:.92rem}
  .perk span{color:#c9e4e6;font-size:.84rem}
  .auth-main{display:flex;align-items:center;justify-content:center;padding:32px 18px}
  .auth-card{width:min(100%,460px);padding:38px;border:0;border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);background:var(--surface)}
  .mobile-back{display:none}
  .brand{display:flex;align-items:center;gap:12px;margin-bottom:22px}
  .brand img{height:44px;width:auto;object-fit:contain;background:#fff;border-radius:var(--radius-sm);padding:4px 8px;border:1px solid var(--border);display:none}
  .auth-card h1{font-weight:800;letter-spacing:-.01em}
  .auth-card .text-muted{color:var(--muted)!important}
  .password-wrap{position:relative}
  .password-wrap .form-control{padding-right:54px}
  .password-eye{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:var(--muted);font-size:1.3rem;line-height:1;padding:8px}
  .auth-card label{display:block;margin-bottom:6px;font-size:.88rem;font-weight:700;color:var(--text)}
  .auth-card .form-control{min-height:46px;border-radius:var(--radius-sm);border:1px solid var(--border-strong);transition:border-color .2s var(--ease),box-shadow .2s var(--ease)}
  .auth-card .form-control:focus{border-color:var(--primary);box-shadow:0 0 0 4px var(--ring)}
  .auth-card .alert{font-size:.9rem;overflow-wrap:anywhere;border-radius:var(--radius-sm)}
  .btn-submit{background:var(--primary);border:1px solid var(--primary);border-radius:var(--radius-sm);font-weight:700;min-height:48px;transition:background-color .2s var(--ease),transform .15s var(--ease),box-shadow .2s var(--ease);box-shadow:0 10px 22px rgba(7,146,164,.3)}
  .btn-submit:hover{background:var(--primary-dark);border-color:var(--primary-dark)}
  .btn-submit:active{transform:scale(.98)}
  .switch-line a{color:var(--primary-dark);font-weight:700;text-decoration:none}
  .switch-line a:hover{text-decoration:underline}
  @media(max-width:900px){
    .auth-page{grid-template-columns:1fr}
    .auth-aside{display:none}
    .auth-main{padding:0}
    .mobile-back{display:flex;align-items:center;gap:6px;color:var(--muted);text-decoration:none;font-size:.86rem;font-weight:650;padding:calc(18px + env(safe-area-inset-top)) 20px 0}
    .mobile-back svg{width:16px;height:16px}
    .brand img{display:block}
    .auth-card{width:100%;min-height:100dvh;border-radius:0;box-shadow:none;padding:14px 20px calc(34px + env(safe-area-inset-bottom))}
    .auth-card h1{font-size:1.5rem}
    .auth-card .row{--bs-gutter-y:.75rem}
    .btn-submit{width:100%}
  }
`],template:`
<div class="auth-page">
  <aside class="auth-aside">
    <a class="back-link" routerLink="/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>Retour à l'accueil</a>
    <img class="aside-logo" src="/fima-auto-logo.jpg" alt="Logo FIMA AUTO">
    <h2 class="aside-title">Votre location commence ici</h2>
    <p class="aside-sub">Réservez un véhicule, signez votre contrat et suivez vos locations depuis votre espace client.</p>
    <div class="perk"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16M7 16l9-9 3 3-9 9H7v-3Z"/></svg></div><div><strong>Contrat en ligne</strong><span>Signature simple et sécurisée.</span></div></div>
    <div class="perk"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z"/><path d="M9 12l2 2 4-4"/></svg></div><div><strong>Véhicules contrôlés</strong><span>Inspectés avant chaque location.</span></div></div>
    <div class="perk"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10 12 2 4 10v10h6v-6h4v6h6V10Z"/></svg></div><div><strong>Prix clairs</strong><span>Tarif, caution et total affichés avant de réserver.</span></div></div>
  </aside>
  <main class="auth-main">
    <a class="mobile-back" routerLink="/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>Retour à l'accueil</a>
    <section class="card auth-card">
      <div class="brand"><img src="/fima-auto-logo.jpg" alt="Logo FIMA AUTO"></div>
      <h1 class="h3">{{register()?'Créer mon compte client':'Espace client'}}</h1>
      <p class="text-muted">{{register()?'Créez votre accès pour réserver un véhicule en ligne.':'Connectez-vous pour suivre vos réservations et signer votre contrat.'}}</p>
      @if(error()){<div class="alert alert-danger">{{error()}}</div>}
      @if(message()){<div class="alert alert-success">{{message()}}</div>}
      @if(register()){
        <div class="row g-3">
          <div class="col-md-6"><label>Prénom <span class="required">*</span></label><input class="form-control" autocomplete="given-name" required [(ngModel)]="firstName"></div>
          <div class="col-md-6"><label>Nom <span class="required">*</span></label><input class="form-control" autocomplete="family-name" required [(ngModel)]="lastName"></div>
          <div class="col-12"><label>Téléphone <span class="required">*</span></label><input class="form-control" type="tel" autocomplete="tel" required [(ngModel)]="phone"></div>
        </div>
      }
      <div class="mt-3"><label>E-mail <span class="required">*</span></label><input class="form-control" type="email" autocomplete="email" required [(ngModel)]="email"></div>
      <div class="mt-3"><label>Mot de passe <span class="required">*</span></label>
        <div class="password-wrap">
          <input class="form-control" [type]="showPassword() ? 'text' : 'password'" [(ngModel)]="password" autocomplete="new-password" minlength="8" required>
          <button type="button" class="password-eye" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"><span aria-hidden="true">&#128065;</span></button>
        </div>
      </div>
      <button class="btn btn-submit text-white w-100 mt-4" [disabled]="loading()" (click)="submit()">{{loading()?'Traitement…':register()?'Créer mon compte':'Se connecter'}}</button>
      <p class="switch-line text-center mt-3 mb-0">@if(register()){Déjà inscrit ? <a routerLink="/client/login">Se connecter</a>}@else{Nouveau client ? <a routerLink="/client/register">Créer un compte</a>}</p>
    </section>
  </main>
</div>
`})
export class ClientAuthComponent { register=signal(false); showPassword=signal(false); acceptedTerms=false; loading=signal(false); error=signal(''); message=signal(''); firstName='';lastName='';phone='';email='';password=''; private returnTarget:any[]=['/client/vehicles']; private returnParams:Record<string,string>={}; constructor(private auth:AuthService,private router:Router,private route:ActivatedRoute){this.register.set(location.pathname.endsWith('/register'));const q=this.route.snapshot.queryParamMap;if(q.get('vehicle')||q.get('depart')||q.get('retour')){this.returnParams={...(q.get('vehicle')?{vehicle:q.get('vehicle')!}:{}),...(q.get('depart')?{depart:q.get('depart')!}:{}),...(q.get('retour')?{retour:q.get('retour')!}:{})};}}
 private authError(error: any){const message=this.auth.errorMessage(error);const code=String(error?.code??error?.status??'').trim();const raw=String(error?.message??'').trim();if(!message.startsWith('L’opération n’a pas pu'))return message;return code?'La création du compte a été refusée par Supabase (référence : '+code+').':raw?'La création du compte a été refusée par Supabase : '+raw+'.':'La création du compte a été refusée par Supabase. Réessayez après avoir rechargé la page.'}
 async submit(){this.error.set('');this.message.set('');if(!this.email.trim()||!this.password){this.error.set('Adresse e-mail et mot de passe obligatoires.');return}if(this.register()){if(!this.firstName.trim()||!this.lastName.trim()||!this.phone.trim()){this.error.set('Prénom, nom et téléphone obligatoires.');return}this.loading.set(true);const r=await this.auth.supabase().auth.signUp({email:this.email.trim(),password:this.password,options:{data:{full_name:(this.firstName+' '+this.lastName).trim(),first_name:this.firstName.trim(),last_name:this.lastName.trim(),phone:this.phone.trim()}}});this.loading.set(false);if(r.error){this.error.set(this.authError(r.error));return}if(r.data.session){await this.auth.load();const p=await this.auth.supabase().rpc('ensure_client_profile',{target_first_name:this.firstName,target_last_name:this.lastName,target_phone:this.phone,target_email:this.email});if(p.error){this.error.set(this.authError(p.error));return}await this.router.navigate(this.returnTarget,{queryParams:this.returnParams});}else this.message.set('Compte créé. Vérifiez votre e-mail puis connectez-vous.');return}this.loading.set(true);const e=await this.auth.login(this.email.trim(),this.password);this.loading.set(false);if(e){this.error.set(this.authError(e));return}if(this.auth.profile()?.role!=='client'){await this.auth.logout();this.error.set('Ce compte appartient à l’équipe interne. Utilisez l’accès équipe.');return}await this.router.navigate(this.returnTarget,{queryParams:this.returnParams});}}
