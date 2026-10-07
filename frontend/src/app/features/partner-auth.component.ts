import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { DigitsOnlyDirective } from '../shared/digits-only.directive';

@Component({standalone:true,imports:[FormsModule,RouterLink,DigitsOnlyDirective],styles:[`
  :host{--radius-sm:12px;--radius-md:16px;--radius-lg:22px;--shadow-md:0 12px 28px rgba(13,41,49,.10);--shadow-lg:0 22px 48px rgba(13,41,49,.16);--ease:cubic-bezier(.22,1,.36,1);display:block}
  .auth-page{min-height:100dvh;display:grid;grid-template-columns:1fr 1fr;background:#f4f8f9}
  .auth-aside{position:relative;background:radial-gradient(circle at 85% -10%,rgba(142,211,223,.18),transparent 46%),linear-gradient(135deg,#123943,#1c6c7d 70%,#0792a4);color:#fff;padding:48px 52px;display:flex;flex-direction:column;overflow:clip}
  .back-link{display:inline-flex;align-items:center;gap:6px;color:rgba(255,255,255,.82);text-decoration:none;font-size:.88rem;font-weight:650;width:fit-content}.back-link:hover{color:#fff}.back-link svg{width:16px;height:16px}
  .aside-logo{width:150px;height:52px;object-fit:contain;background:#fff;border-radius:var(--radius-sm);padding:6px 10px;box-shadow:var(--shadow-md);margin:32px 0 28px;display:block}
  .aside-title{font-size:1.7rem;font-weight:800;letter-spacing:-.01em;max-width:380px;line-height:1.2;margin-bottom:10px}
  .aside-sub{color:#d7eef0;max-width:360px;margin-bottom:34px}
  .perk{display:flex;align-items:flex-start;gap:12px;margin-bottom:18px}.perk .icon{flex:0 0 auto;width:34px;height:34px;display:grid;place-items:center;border-radius:var(--radius-sm);background:rgba(255,255,255,.12);color:#bfe9ef}.perk .icon svg{width:17px;height:17px}.perk strong{display:block;font-size:.92rem}.perk span{color:#c9e4e6;font-size:.84rem}
  .auth-main{display:flex;align-items:center;justify-content:center;padding:32px 18px}
  .auth-card{width:min(100%,460px);padding:38px;border:0;border-radius:0;box-shadow:none;background:transparent}
  .mobile-back{display:none}
  .auth-card h1{font-weight:800;letter-spacing:-.01em}
  .password-wrap{position:relative}.password-wrap .form-control{padding-right:54px}
  .password-eye{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:#5f7a80;font-size:1.3rem;line-height:1;padding:8px}
  .auth-card label{display:block;margin-bottom:6px;font-size:.88rem;font-weight:700}
  .auth-card .form-control{min-height:46px;border-radius:var(--radius-sm)}
  .btn-submit{background:#0792a4;border:1px solid #0792a4;border-radius:var(--radius-sm);font-weight:700;min-height:48px}.btn-submit:hover{background:#06707f;border-color:#06707f}
  .switch-line a{color:#06707f;font-weight:700;text-decoration:none}.switch-line a:hover{text-decoration:underline}
  @media(max-width:900px){.auth-page{grid-template-columns:1fr}.auth-aside{display:none}.auth-main{padding:0}.mobile-back{display:flex;align-items:center;gap:6px;color:#5f7a80;text-decoration:none;font-size:.86rem;font-weight:650;padding:calc(18px + env(safe-area-inset-top)) 20px 0}.mobile-back svg{width:16px;height:16px}.auth-card{width:100%;min-height:100dvh;border-radius:0;box-shadow:none;padding:14px 20px calc(34px + env(safe-area-inset-bottom))}.btn-submit{width:100%}}
  @media(min-width:900px){.auth-page{height:100dvh!important;overflow:hidden}.auth-aside{overflow-y:auto;min-height:0}.auth-main{overflow-y:auto;min-height:0}}
`],template:`
<div class="auth-page">
  <aside class="auth-aside">
    <a class="back-link" routerLink="/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>Retour à l'accueil</a>
    <img class="aside-logo" src="/fima-auto-logo.jpg" alt="Logo FIMA AUTO">
    <h2 class="aside-title">Proposez vos véhicules</h2>
    <p class="aside-sub">Ajoutez vos véhicules, fixez votre prix, nous les évaluons et les publions.</p>
    <div class="perk"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10 12 2 4 10v10h6v-6h4v6h6V10Z"/></svg></div><div><strong>Vous fixez votre prix</strong><span>Nous ajoutons notre marge avant publication.</span></div></div>
    <div class="perk"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z"/><path d="M9 12l2 2 4-4"/></svg></div><div><strong>Contrôle qualité</strong><span>Chaque véhicule est évalué avant publication.</span></div></div>
    <div class="perk"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg></div><div><strong>Suivi des revenus</strong><span>Consultez vos gains à tout moment.</span></div></div>
  </aside>
  <main class="auth-main">
    <a class="mobile-back" routerLink="/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>Retour à l'accueil</a>
    <section class="auth-card">
      <h1 class="h3">{{register()?'Devenir partenaire':'Espace partenaire'}}</h1>
      <p class="text-muted">{{register()?'Créez votre accès pour proposer vos véhicules.':'Connectez-vous pour gérer vos véhicules.'}}</p>
      @if(error()){<div class="alert alert-danger">{{error()}}</div>}
      @if(message()){<div class="alert alert-success">{{message()}}</div>}
      @if(register()){
        <div class="row g-3">
          <div class="col-12"><label>Nom de l'entreprise (facultatif)</label><input class="form-control" [(ngModel)]="companyName"></div>
          <div class="col-md-6"><label>Nom du contact <span class="required">*</span></label><input class="form-control" required [(ngModel)]="contactName"></div>
          <div class="col-md-6"><label>Téléphone <span class="required">*</span></label><input class="form-control" type="tel" inputmode="numeric" required appDigitsOnly [(ngModel)]="phone"></div>
        </div>
      }
      <div class="mt-3"><label>E-mail <span class="required">*</span></label><input class="form-control" type="email" [(ngModel)]="email"></div>
      <div class="mt-3"><label>Mot de passe <span class="required">*</span></label>
        <div class="password-wrap">
          <input class="form-control" [type]="showPassword() ? 'text' : 'password'" [(ngModel)]="password" minlength="8">
          <button type="button" class="password-eye" (click)="showPassword.set(!showPassword())" aria-label="Afficher/masquer">&#128065;</button>
        </div>
      </div>
      <button class="btn btn-submit text-white w-100 mt-4" [disabled]="loading()" (click)="submit()">{{loading()?'Traitement…':register()?'Créer mon compte partenaire':'Se connecter'}}</button>
      <p class="switch-line text-center mt-3 mb-0">@if(register()){Déjà partenaire ? <a routerLink="/partner/login">Se connecter</a>}@else{Nouveau partenaire ? <a routerLink="/partner/register">Créer un compte</a>}</p>
    </section>
  </main>
</div>
`})
export class PartnerAuthComponent {
  register = signal(false); showPassword = signal(false); loading = signal(false); error = signal(''); message = signal('');
  companyName = ''; contactName = ''; phone = ''; email = ''; password = '';
  constructor(private auth: AuthService, private router: Router) { this.register.set(location.pathname.endsWith('/register')); }

  async submit() {
    this.error.set(''); this.message.set('');
    if (!this.email.trim() || !this.password) { this.error.set('Adresse e-mail et mot de passe obligatoires.'); return; }
    if (this.register()) {
      if (!this.contactName.trim() || !this.phone.trim()) { this.error.set('Nom du contact et téléphone obligatoires.'); return; }
      this.loading.set(true);
      const r = await this.auth.supabase().auth.signUp({ email: this.email.trim(), password: this.password, options: { data: { full_name: this.companyName.trim() || this.contactName.trim(), requested_role: 'partner' } } });
      this.loading.set(false);
      if (r.error) { this.error.set(this.auth.errorMessage(r.error)); return; }
      if (r.data.session) {
        await this.auth.load();
        const p = await this.auth.supabase().rpc('ensure_partner_profile', { target_company_name: this.companyName || null, target_contact_name: this.contactName, target_phone: this.phone, target_email: this.email });
        if (p.error) { this.error.set(this.auth.errorMessage(p.error)); return; }
        await this.router.navigate(['/partner/vehicles']);
      } else this.message.set('Compte créé. Vérifiez votre e-mail puis connectez-vous.');
      return;
    }
    this.loading.set(true);
    const e = await this.auth.login(this.email.trim(), this.password);
    this.loading.set(false);
    if (e) { this.error.set(this.auth.errorMessage(e)); return; }
    if (this.auth.profile()?.role !== 'partner') { await this.auth.logout(); this.error.set('Ce compte n’est pas un compte partenaire.'); return; }
    await this.router.navigate(['/partner/vehicles']);
  }
}
