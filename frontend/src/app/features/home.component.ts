import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
    .landing{min-height:100dvh;background:var(--bg);color:var(--text);font-feature-settings:"tnum"}
    .reveal{opacity:0;transform:translateY(18px);transition:opacity .6s var(--ease),transform .6s var(--ease)}
    .reveal-visible{opacity:1;transform:none}
    @media (prefers-reduced-motion: reduce){.reveal{transition:none;opacity:1;transform:none}}

    /* ---------- header ---------- */
    .topbar{position:fixed;top:0;left:0;right:0;width:100%;z-index:40;color:#fff;padding:12px 5%;display:flex;flex-wrap:wrap;align-items:center;gap:12px 22px}
    .topbar::before{content:'';position:absolute;inset:0;z-index:-1;background:rgba(18,57,67,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid rgba(255,255,255,.08)}
    .header-spacer{height:78px}
    .brand{display:flex;align-items:center}
    .logo{display:block;height:48px;width:auto;object-fit:contain;background:#fff;border-radius:var(--radius-sm);padding:6px 10px;box-shadow:var(--shadow-sm)}
    .nav{display:flex;flex-wrap:wrap;gap:10px 18px;margin-left:auto;align-items:center}
    .nav-link{position:relative;color:rgba(255,255,255,.88);text-decoration:none;font-size:.92rem;font-weight:600;padding:4px 0;transition:color .2s var(--ease)}
    .nav-link::after{content:'';position:absolute;left:0;bottom:-2px;width:100%;height:2px;background:#8ed3df;border-radius:2px;transform:scaleX(0);transform-origin:left;transition:transform .25s var(--ease)}
    .nav-link:hover{color:#fff}.nav-link:hover::after{transform:scaleX(1)}
    .btn-pill{border-radius:var(--radius-full);font-weight:650;padding:.5rem 1.15rem;transition:transform .15s var(--ease),box-shadow .2s var(--ease),background-color .2s var(--ease),color .2s var(--ease)}
    .btn-pill:active{transform:scale(.97)}
    .btn-ghost-light{border:1px solid rgba(255,255,255,.35);color:#fff;background:transparent}
    .btn-ghost-light:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.55);color:#fff}
    .btn-solid-light{background:#fff;color:var(--petrol);border:1px solid #fff}
    .btn-solid-light:hover{background:#eaf7f8;box-shadow:var(--shadow-sm)}

    /* ---------- hero ---------- */
    .hero{position:relative;padding:64px 5% 130px;background:linear-gradient(100deg,rgba(6,33,40,.86) 0%,rgba(6,33,40,.58) 34%,rgba(6,33,40,.22) 56%,rgba(6,33,40,.05) 74%),url(/hero-banner.jpg) center/cover no-repeat;color:#fff;overflow:clip}
    .hero-inner{max-width:1180px;margin:auto;position:relative}
    .hero-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:.74rem;font-weight:800;letter-spacing:.12em;color:#bfe9ef;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);padding:6px 14px;border-radius:var(--radius-full)}
    .hero h1{max-width:760px;font-size:clamp(2.3rem,5.4vw,4.4rem);line-height:1.04;margin:18px 0 10px;font-weight:800;letter-spacing:-.01em}
    .hero p.lead{font-size:1.1rem;color:#d7eef0;max-width:560px}
    .search-card{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) auto;gap:12px;background:var(--surface);padding:16px;border-radius:var(--radius-lg);border:1px solid var(--border);box-shadow:var(--shadow-lg);max-width:1040px;margin-top:34px;color:var(--text);position:relative;top:0}
    .search-card .field label{font-size:.72rem;font-weight:800;letter-spacing:.03em;color:var(--muted);display:block;margin-bottom:5px;text-transform:uppercase}
    .search-card .form-control,.search-card .form-select{border-radius:var(--radius-sm);border:1px solid var(--border-strong);min-height:46px;transition:border-color .2s var(--ease),box-shadow .2s var(--ease)}
    .search-card .form-control:focus,.search-card .form-select:focus{border-color:var(--primary);box-shadow:0 0 0 4px var(--ring)}
    .btn-primary-cta{display:inline-flex;align-items:center;justify-content:center;background:var(--primary);border:1px solid var(--primary);border-radius:var(--radius-sm);font-weight:700;padding:0 22px;min-height:46px;transition:background-color .2s var(--ease),transform .15s var(--ease),box-shadow .2s var(--ease);box-shadow:0 8px 18px rgba(7,146,164,.3)}
    .btn-primary-cta:hover{background:var(--primary-dark);border-color:var(--primary-dark);box-shadow:0 10px 22px rgba(7,146,164,.38)}
    .btn-primary-cta:active{transform:scale(.97)}

    /* ---------- sections ---------- */
    .section,.cta{scroll-margin-top:90px}
    .section{max-width:1180px;margin:auto;padding:76px 5%}
    .section-head{text-align:center;max-width:620px;margin:0 auto 38px}
    .section-head .kicker{display:inline-block;font-size:.72rem;font-weight:800;letter-spacing:.14em;color:var(--primary);text-transform:uppercase;margin-bottom:8px}
    .section-head h2{font-size:clamp(1.6rem,3vw,2.2rem);font-weight:800;letter-spacing:-.01em;margin:0 0 8px}
    .section-head p{color:var(--muted);margin:0}

    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
    .cardx{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:24px;transition:transform .25s var(--ease),box-shadow .25s var(--ease),border-color .25s var(--ease)}
    .cardx:hover{transform:translateY(-5px);box-shadow:var(--shadow-md);border-color:var(--border-strong)}
    .icon{width:46px;height:46px;display:grid;place-items:center;border-radius:var(--radius-sm);background:var(--primary-soft);color:var(--primary);margin-bottom:14px;transition:transform .25s var(--ease),background-color .25s var(--ease)}
    .cardx:hover .icon{transform:scale(1.08) rotate(-3deg);background:var(--primary);color:#fff}
    .icon svg{width:22px;height:22px}
    .cardx h3{font-size:1.02rem;font-weight:750;margin:0 0 4px}
    .cardx p{color:var(--muted);font-size:.9rem;margin:0}

    /* category segmented control */
    .cat-group{display:inline-flex;gap:3px;padding:4px;background:#eaf2f3;border-radius:var(--radius-full);margin:0 auto 30px;}
    .cat-wrap{display:flex;justify-content:center}
    .cat-pill{border:0;background:transparent;color:var(--muted);border-radius:var(--radius-full);padding:9px 18px;font-size:.85rem;font-weight:700;cursor:pointer;transition:background-color .25s var(--ease),color .25s var(--ease),box-shadow .25s var(--ease)}
    .cat-pill.active{background:var(--surface);color:var(--text);box-shadow:var(--shadow-sm)}
    .cat-pill:not(.active):hover{color:var(--text)}

    .vehicles{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
    .vehicle-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:22px;display:flex;flex-direction:column;gap:6px;transition:transform .25s var(--ease),box-shadow .25s var(--ease)}
    .vehicle-card:hover{transform:translateY(-5px);box-shadow:var(--shadow-md)}
    .badge-cat{align-self:flex-start;background:var(--primary-soft);color:var(--primary-dark);font-weight:750;font-size:.7rem;letter-spacing:.03em;text-transform:uppercase;border-radius:var(--radius-full);padding:5px 12px;margin-bottom:6px}
    .vehicle-card h3{font-size:1.08rem;font-weight:750;margin:0}
    .vehicle-card .meta{color:var(--muted);font-size:.86rem;margin:0}
    .price{color:var(--primary-dark);font-weight:800;margin:6px 0 2px}
    .btn-outline-cta{border:1px solid var(--border-strong);color:var(--text);background:var(--surface);border-radius:var(--radius-sm);font-weight:700;padding:.5rem 1rem;align-self:flex-start;transition:all .2s var(--ease)}
    .btn-outline-cta:hover{background:var(--petrol);border-color:var(--petrol);color:#fff}
    .empty-note{color:var(--muted);text-align:center;grid-column:1/-1;padding:28px;border:1px dashed var(--border-strong);border-radius:var(--radius-md)}

    /* steps */
    .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;position:relative}
    .step{position:relative;text-align:center;padding:30px 20px;border-radius:var(--radius-md);background:var(--surface);border:1px solid var(--border);transition:transform .25s var(--ease),box-shadow .25s var(--ease)}
    .step:hover{transform:translateY(-5px);box-shadow:var(--shadow-md)}
    .step .icon{margin:0 auto 14px;width:52px;height:52px}
    .step .num{position:absolute;top:14px;right:16px;font-size:.72rem;font-weight:800;color:var(--muted-soft)}
    .step h3{font-weight:750;margin:0 0 4px}
    .step p{color:var(--muted);font-size:.9rem;margin:0}

    /* faq accordion */
    .faq{max-width:780px;margin:auto;display:grid;gap:0;border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;background:var(--surface)}
    .faq details{border-bottom:1px solid var(--border);border-radius:0;padding:0;background:transparent}
    .faq details:last-child{border-bottom:0}
    .faq summary{cursor:pointer;list-style:none;padding:18px 22px;font-weight:650;display:flex;justify-content:space-between;align-items:center;gap:12px;transition:background-color .2s var(--ease)}
    .faq summary:hover{background:#f6fafb}
    .faq summary::-webkit-details-marker{display:none}
    .faq summary::after{content:'';width:9px;height:9px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(45deg);transition:transform .25s var(--ease);flex:0 0 auto}
    .faq details[open] summary::after{transform:rotate(-135deg)}
    .faq details p{margin:0;padding:0 22px 18px;color:var(--muted)}

    /* partner section */
    .partner-hero{display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center;margin-bottom:60px}
    .partner-hero-text p{color:var(--muted);font-size:1.02rem;max-width:480px;margin:14px 0 26px}
    .partner-hero-media{border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-lg)}
    .partner-hero-media img{width:100%;height:100%;object-fit:cover;display:block;aspect-ratio:4/3}
    .partner-steps-wrap{position:relative;border-radius:var(--radius-lg);padding:52px 5%;margin-bottom:60px;background:linear-gradient(135deg,rgba(18,57,67,.86),rgba(7,112,127,.8)),url('/partner-steps-bg.jpg') center/cover no-repeat;box-shadow:var(--shadow-lg)}
    .partner-steps-wrap .section-head .kicker{color:#bfe9ef}
    .partner-steps-wrap .section-head h2{color:#fff}
    .partner-steps-wrap .section-head p{color:#d7eef0}
    .partner-steps-wrap .step{background:rgba(255,255,255,.97)}
    .partner-grid{margin-bottom:60px}

    /* cta */
    .cta{margin:0 5% 70px;padding:52px 5%;text-align:center;border-radius:var(--radius-lg);background:linear-gradient(135deg,var(--petrol),#1c6c7d);color:#fff;box-shadow:var(--shadow-lg)}
    .cta-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:14px;margin-top:8px}
    .cta h2{font-weight:800;margin-bottom:18px}

    /* footer */
    .footer-wrap{background:var(--petrol-deep)}
    .footer{color:#c9dee0;padding:52px 5% 0;max-width:1180px;margin:auto;display:grid;grid-template-columns:2fr 1fr 2fr;gap:30px}
    .footer .logo{background:#fff}
    .footer p{color:#9fb9bc;margin:10px 0 0;font-size:.9rem}
    .footer h4{font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:#7fa3a6;margin-bottom:14px}
    .footer a{position:relative;display:block;color:#c9dee0;text-decoration:none;margin:6px 0;font-size:.92rem;transition:color .2s var(--ease)}
    .footer a:hover{color:#fff}
    .footer-bottom{max-width:1180px;margin:30px auto 0;padding-top:20px;border-top:1px solid rgba(255,255,255,.08);font-size:.8rem;color:#6d8c8f;text-align:center}

    @media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}.vehicles{grid-template-columns:repeat(2,1fr)}.steps{grid-template-columns:1fr}.partner-hero{grid-template-columns:1fr}.partner-hero-media{order:-1}.partner-hero-media img{aspect-ratio:16/9}}
    @media(max-width:800px){.nav-link{display:none}}
    @media(max-width:560px){
      .topbar{padding:10px 4%;gap:8px}
      .logo{height:38px}
      .nav{gap:8px}
      .nav .btn-pill{padding:.42rem .85rem;font-size:.8rem;white-space:nowrap}
      .header-spacer{height:60px}
    }
    @media(max-width:360px){
      .nav .btn-pill{padding:.38rem .65rem;font-size:.74rem}
    }
    @media(max-width:700px){.search-card{grid-template-columns:1fr}}
    @media(max-width:600px){.grid{grid-template-columns:1fr}.vehicles{grid-template-columns:1fr}.footer{grid-template-columns:1fr;text-align:left}.hero{padding:48px 5% 110px}.cta-actions{flex-direction:column;align-items:stretch}.cta-actions .btn{width:100%}}
  `],
  template: `
<main class="landing">
  <header class="topbar">
    <a class="brand" routerLink="/"><img class="logo" src="/logo.jpg" alt="FIMA AUTO"></a>
    <nav class="nav">
      <a class="nav-link" href="#vehicles">Véhicules</a>
      <a class="nav-link" href="#how">Comment ça marche</a>
      <a class="nav-link" href="#contact">Contact</a>
      <a class="nav-link" href="#partners">Partenaires</a>
      <a routerLink="/client/login" class="btn btn-pill btn-ghost-light btn-sm">Se connecter</a>
      <a routerLink="/client/register" class="btn btn-pill btn-solid-light btn-sm">Créer un compte</a>
    </nav>
  </header>
  <div class="header-spacer" aria-hidden="true"></div>

  <section class="hero">
    <div class="hero-inner">
      <span class="hero-eyebrow">LOCATION DE VÉHICULES</span>
      <h1>Louez votre véhicule en quelques clics</h1>
      <p class="lead">Véhicules entretenus, contrat signé en ligne, sans frais cachés.</p>
      <form class="search-card" (ngSubmit)="search()">
        <div class="field"><label>Départ</label><input class="form-control" type="datetime-local" [(ngModel)]="depart" name="depart" required></div>
        <div class="field"><label>Retour</label><input class="form-control" type="datetime-local" [(ngModel)]="retour" name="retour" required></div>
        <div class="field"><label>Catégorie</label><select class="form-select" [(ngModel)]="category" name="category"><option value="">Toutes</option><option>Citadine</option><option>Berline</option><option>SUV</option></select></div>
        <button class="btn btn-primary-cta text-white">Voir les véhicules</button>
      </form>
    </div>
  </section>

  <section class="section">
    <div class="section-head" appReveal>
      <span class="kicker">Pourquoi FIMA AUTO</span>
      <h2>Une location simple et sans surprise</h2>
    </div>
    <div class="grid">
      <article class="cardx" appReveal="0">
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16M7 16l9-9 3 3-9 9H7v-3Z"/></svg></div>
        <h3>Contrat en ligne</h3><p>Signature simple et sécurisée.</p>
      </article>
      <article class="cardx" appReveal="80">
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z"/><path d="M9 12l2 2 4-4"/></svg></div>
        <h3>Véhicules contrôlés</h3><p>Inspectés avant chaque location.</p>
      </article>
      <article class="cardx" appReveal="160">
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10 12 2 4 10v10h6v-6h4v6h6V10Z"/></svg></div>
        <h3>Prix clairs</h3><p>Tarif, caution et total affichés avant de réserver.</p>
      </article>
      <article class="cardx" appReveal="240">
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.5 8.5 0 1 1-3.8-7.1M21 4l-5 5"/><path d="M4 20l1.6-4A8.5 8.5 0 0 1 4 11.5"/></svg></div>
        <h3>Assistance WhatsApp</h3><p>Une équipe disponible.</p>
      </article>
    </div>
  </section>

  <section class="section" id="vehicles">
    <div class="section-head" appReveal>
      <span class="kicker">Catalogue</span>
      <h2>Nos véhicules</h2>
      <p>Des modèles entretenus, prêts à partir.</p>
    </div>
    <div class="cat-wrap"><div class="cat-group">
      <button class="cat-pill" [class.active]="categoryFilter===''" (click)="categoryFilter=''">Toutes</button>
      <button class="cat-pill" [class.active]="categoryFilter==='Citadine'" (click)="categoryFilter='Citadine'">Citadine</button>
      <button class="cat-pill" [class.active]="categoryFilter==='Berline'" (click)="categoryFilter='Berline'">Berline</button>
      <button class="cat-pill" [class.active]="categoryFilter==='SUV'" (click)="categoryFilter='SUV'">SUV</button>
    </div></div>
    <div class="vehicles">
      <article class="vehicle-card" *ngFor="let v of visibleVehicles(); let i = index" [appReveal]="i * 70">
        <span class="badge-cat">{{v.category||'Véhicule'}}</span>
        <h3>{{v.make}} {{v.model}}</h3>
        <p class="meta">{{v.transmission==='automatic'?'Boîte automatique':v.transmission==='manual'?'Boîte manuelle':'Boîte non renseignée'}}</p>
        <p class="price">À partir de {{money(v.rental_price)}} / jour</p>
        <a routerLink="/vehicules" class="btn btn-outline-cta">Voir</a>
      </article>
      <p *ngIf="!vehicles().length" class="empty-note">Les véhicules disponibles s'affichent ici dès qu'ils sont publiés.</p>
    </div>
  </section>

  <section class="section" id="how">
    <div class="section-head" appReveal>
      <span class="kicker">Simplicité</span>
      <h2>Comment ça marche</h2>
    </div>
    <div class="steps">
      <article class="step" appReveal="0"><span class="num">01</span>
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg></div>
        <h3>Réservez</h3><p>Choisissez vos dates.</p>
      </article>
      <article class="step" appReveal="100"><span class="num">02</span>
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16M7 16l9-9 3 3-9 9H7v-3Z"/></svg></div>
        <h3>Signez</h3><p>Signez votre contrat en ligne.</p>
      </article>
      <article class="step" appReveal="200"><span class="num">03</span>
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M4 18h2l2-8h8l3 4v4h-1M8 10l2-4h4"/></svg></div>
        <h3>Récupérez</h3><p>Partez sereinement.</p>
      </article>
    </div>
  </section>

  <section class="section">
    <div class="section-head" appReveal>
      <span class="kicker">Besoin d'aide</span>
      <h2>Questions fréquentes</h2>
    </div>
    <div class="faq" appReveal>
      <details><summary>Quels documents fournir ?</summary><p>Une pièce d'identité et un permis valides.</p></details>
      <details><summary>Comment fonctionne la caution ?</summary><p>Elle est affichée avant réservation.</p></details>
      <details><summary>Puis-je annuler ?</summary><p>Contactez l'agence.</p></details>
      <details><summary>Le carburant est-il inclus ?</summary><p>Le niveau est indiqué au contrat.</p></details>
      <details><summary>Y a-t-il un âge minimum ?</summary><p>Les conditions sont précisées à la réservation.</p></details>
      <details><summary>Livrez-vous le véhicule ?</summary><p>Contactez l'agence pour connaître les options de livraison disponibles selon votre zone.</p></details>
    </div>
  </section>

  <section class="section" id="partners">
    <div class="partner-hero" appReveal>
      <div class="partner-hero-text">
        <span class="kicker">Devenez partenaire</span>
        <h2>Rentabilisez votre véhicule inutilisé</h2>
        <p>Proposez votre véhicule avec vos photos et le prix que vous souhaitez toucher. Nous l'évaluons, le publions et vous reversons votre part à chaque location.</p>
        <a routerLink="/partner/register" class="btn btn-primary-cta text-white">Devenir partenaire</a>
      </div>
      <div class="partner-hero-media"><img src="/partner-hero.jpg" alt="Remise de clés entre un partenaire et un client FIMA AUTO"></div>
    </div>

    <div class="partner-steps-wrap">
      <div class="section-head" appReveal>
        <span class="kicker">Comment ça marche</span>
        <h2>De votre véhicule à vos revenus</h2>
      </div>
      <div class="steps">
        <article class="step" appReveal="0"><span class="num">01</span>
          <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10 12 2 4 10v10h6v-6h4v6h6V10Z"/></svg></div>
          <h3>Proposez</h3><p>Photos, conditions et prix souhaité.</p>
        </article>
        <article class="step" appReveal="100"><span class="num">02</span>
          <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z"/><path d="M9 12l2 2 4-4"/></svg></div>
          <h3>On évalue</h3><p>Prix et état du véhicule vérifiés.</p>
        </article>
        <article class="step" appReveal="200"><span class="num">03</span>
          <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 10h3.8a1.7 1.7 0 1 1 0 3.4H9.5"/></svg></div>
          <h3>Vous touchez vos revenus</h3><p>À chaque location, automatiquement suivi.</p>
        </article>
      </div>
    </div>

    <div class="grid partner-grid">
      <article class="cardx" appReveal="0">
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        <h3>Revenu sans effort</h3><p>Vous fixez votre prix, on gère le reste.</p>
      </article>
      <article class="cardx" appReveal="80">
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16M7 16l9-9 3 3-9 9H7v-3Z"/></svg></div>
        <h3>Contrats pris en charge</h3><p>Signatures et formalités gérées par nous.</p>
      </article>
      <article class="cardx" appReveal="160">
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z"/><path d="M9 12l2 2 4-4"/></svg></div>
        <h3>Vous gardez le contrôle</h3><p>Déclarez une maintenance à tout moment.</p>
      </article>
      <article class="cardx" appReveal="240">
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg></div>
        <h3>Suivi en temps réel</h3><p>Vos locations et revenus dans votre espace.</p>
      </article>
    </div>

    <div class="section-head" appReveal>
      <span class="kicker">Questions fréquentes</span>
      <h2>Pour les partenaires</h2>
    </div>
    <div class="faq" appReveal>
      <details><summary>Comment est fixé le prix final ?</summary><p>Vous indiquez le prix que vous souhaitez toucher ; nous ajoutons notre marge pour fixer le prix affiché au client.</p></details>
      <details><summary>Comment et quand suis-je payé ?</summary><p>Vous suivez vos locations et vos revenus directement depuis votre espace partenaire.</p></details>
      <details><summary>Quels documents dois-je fournir ?</summary><p>Les photos du véhicule et ses informations ; le reste est géré lors de l'évaluation.</p></details>
      <details><summary>Puis-je retirer mon véhicule à tout moment ?</summary><p>Oui, contactez l'agence pour toute demande de retrait.</p></details>
    </div>
  </section>

  <section class="cta" id="contact" appReveal>
    <h2 class="h3">Prêt à partir ?</h2>
    <div class="cta-actions">
      <a routerLink="/client/register" class="btn btn-pill btn-solid-light">Créer mon compte</a>
      <a [href]="whatsappLink()" target="_blank" class="btn btn-pill btn-ghost-light">Nous contacter sur WhatsApp</a>
    </div>
  </section>

  <footer class="footer-wrap">
    <div class="footer">
      <div><img class="logo" src="/logo.jpg" alt="FIMA AUTO"><p>Location de véhicules, mobilités premium.</p></div>
      <div><h4>Liens</h4><a href="#vehicles">Véhicules</a><a href="#how">FAQ</a><a href="#contact">Contact</a><a routerLink="/partner/login">Espace partenaire</a></div>
      <div>
        <h4>Contact</h4>
        <p>Téléphone : {{company().phone||'Non renseigné'}}</p>
        <p>WhatsApp : {{company().whatsapp_phone||'Non renseigné'}}</p>
        <p>{{company().address||'Adresse à configurer'}}</p>
        <p>Horaires : à préciser</p>
      </div>
    </div>
    <div class="footer-bottom">© {{ year }} FIMA AUTO — Tous droits réservés</div>
  </footer>
</main>
`
})
export class HomeComponent implements OnInit {
  vehicles = signal<any[]>([]); company = signal<any>({});
  depart = ''; retour = ''; category = ''; categoryFilter = '';
  year = new Date().getFullYear();

  constructor(private auth: AuthService, private router: Router) {}

  async ngOnInit() {
    const c = await this.auth.supabase().rpc('public_company_contact');
    if (!c.error && c.data?.[0]) this.company.set(c.data[0]);
    const v = await this.auth.supabase().rpc('public_available_vehicles', {});
    if (!v.error) this.vehicles.set((v.data ?? []).slice(0, 6));
  }

  visibleVehicles() {
    return this.vehicles().filter(v => !this.categoryFilter || String(v.category ?? '').toLowerCase() === this.categoryFilter.toLowerCase());
  }

  money(value: any) { return Number(value ?? 0).toLocaleString('fr-FR') + ' FCFA'; }

  whatsappLink() {
    const number = String(this.company().whatsapp_phone ?? '').replace(/[^\d+]/g, '');
    return number ? 'https://wa.me/' + number.replace(/^\+/, '') : 'https://wa.me/';
  }

  search() {
    const q: Record<string, string> = {};
    if (this.depart) q['depart'] = this.depart;
    if (this.retour) q['retour'] = this.retour;
    if (this.category) q['category'] = this.category;
    this.router.navigate(['/vehicules'], { queryParams: q });
  }
}
