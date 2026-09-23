import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
  <div class="page-heading"><div><p class="eyebrow">MON ESPACE</p><h1>Mes informations</h1><p>Vos informations internes utilisées dans le journal et les historiques.</p></div></div>
  @if(error()){<div class="alert alert-danger">{{error()}}</div>}@if(message()){<div class="alert alert-success">{{message()}}</div>}
  <section class="card form-card profile-card"><div class="card-body">
    <div class="profile-mark">{{initials()}}</div>
    <div><h2 class="h4 mb-1">{{auth.profile()?.role==='super_admin'?'Compte Super Admin':'Compte Responsable'}}</h2><p class="text-muted mb-0">Seul votre nom d’affichage est partagé dans les historiques internes.</p></div>
    <hr>
    <div class="row g-3"><div class="col-md-6"><label class="form-label required-label">Prénom</label><input class="form-control" [(ngModel)]="form.first_name" autocomplete="given-name"></div><div class="col-md-6"><label class="form-label required-label">Nom</label><input class="form-control" [(ngModel)]="form.last_name" autocomplete="family-name"></div><div class="col-12"><label class="form-label">E-mail</label><input class="form-control" [value]="form.email" readonly><small class="text-muted">L’adresse e-mail est gérée par le compte de connexion.</small></div></div>
    <button class="btn btn-primary mt-4" [disabled]="saving()" (click)="save()">{{saving()?'Enregistrement…':'Enregistrer mes informations'}}</button>
  </div></section>`,
  styles: [`.profile-card{max-width:760px}.profile-mark{display:grid;place-items:center;width:58px;height:58px;margin-bottom:1rem;border-radius:18px;background:linear-gradient(135deg,#0b8999,#46c9d1);color:#fff;font-weight:850;letter-spacing:.05em}`]
})
export class MyProfileComponent implements OnInit {
  form = { first_name: '', last_name: '', email: '' };
  saving = signal(false); error = signal(''); message = signal('');
  constructor(public auth: AuthService) {}
  ngOnInit() {
    const profile = this.auth.profile() ?? {};
    const parts = this.fallbackParts(profile);
    this.form = { first_name: profile.first_name ?? parts.first_name, last_name: profile.last_name ?? parts.last_name, email: profile.email ?? '' };
  }
  private fallbackParts(profile: any) {
    const text = String(profile.full_name ?? '').includes('@') ? '' : String(profile.full_name ?? '').trim();
    const parts = text.split(/\s+/).filter(Boolean);
    return { first_name: parts.shift() ?? '', last_name: parts.join(' ') };
  }
  initials() { return [this.form.first_name, this.form.last_name].filter(Boolean).map(value => value[0]).join('').slice(0, 2).toUpperCase() || 'FA'; }
  async save() {
    this.error.set(''); this.message.set('');
    if (!this.form.first_name.trim() || !this.form.last_name.trim()) { this.error.set('Veuillez renseigner votre prénom et votre nom.'); return; }
    this.saving.set(true);
    const result = await this.auth.supabase().from('profiles').update({ first_name: this.form.first_name.trim(), last_name: this.form.last_name.trim() }).eq('id', this.auth.profile()?.id);
    this.saving.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; }
    await this.auth.load();
    this.message.set('Vos informations ont été mises à jour.');
  }
}
