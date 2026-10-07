import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .invite{min-height:100vh;display:grid;place-items:center;padding:16px;background:linear-gradient(135deg,#062b35,#0792a4)}
    .invite-card{width:min(100%,470px);background:#fff;border-radius:24px;padding:28px;box-shadow:0 22px 60px rgba(0,0,0,.24)}
    .invite-card img{height:54px;width:auto;margin-bottom:12px}
    .invite-card span{font-size:.72rem;letter-spacing:.13em;color:#0792a4;font-weight:800}
    .invite-card h1{font-size:1.55rem;margin:.3rem 0}
    .invite-card p{color:#6b7c81;margin-bottom:15px}
    .invite-card label{font-weight:700;font-size:.88rem;margin-bottom:4px;display:block}
    .invite-card .form-control{min-height:46px;border-radius:12px;margin-bottom:14px}
    .invite-card .alert{font-size:.9rem}
  `],
  template: `
    <main class="invite"><section class="invite-card">
      <img src="/fima-auto-logo.jpg" alt="FIMA AUTO">
      <div><span>ESPACE PROFESSIONNEL</span><h1>Bienvenue chez FIMA AUTO</h1></div>
      @if (checking()) {
        <p>Vérification de votre invitation…</p>
      } @else if (!ready()) {
        <div class="alert alert-danger">Ce lien d'invitation est invalide ou a expiré. Demandez à votre Super Admin de vous envoyer une nouvelle invitation.</div>
      } @else {
        <p>Définissez votre mot de passe pour activer votre compte Responsable.</p>
        @if (error) { <p class="alert alert-danger">{{ error }}</p> }
        <label>Mot de passe <span class="required">*</span></label>
        <input class="form-control" type="password" [(ngModel)]="password" autocomplete="new-password" minlength="8">
        <label>Confirmer le mot de passe <span class="required">*</span></label>
        <input class="form-control" type="password" [(ngModel)]="confirm" autocomplete="new-password" minlength="8">
        <button class="btn btn-primary w-100" [disabled]="saving()" (click)="submit()">{{ saving() ? 'Activation…' : 'Activer mon compte' }}</button>
      }
    </section></main>
  `
})
export class InviteComponent implements OnInit {
  checking = signal(true); ready = signal(false); saving = signal(false);
  password = ''; confirm = ''; error = '';

  constructor(private auth: AuthService, private router: Router) {}

  async ngOnInit() {
    const { data } = await this.auth.supabase().auth.getSession();
    this.ready.set(!!data.session);
    this.checking.set(false);
  }

  async submit() {
    this.error = '';
    if (!this.password || this.password.length < 8) { this.error = 'Le mot de passe doit contenir au moins 8 caractères.'; return; }
    if (this.password !== this.confirm) { this.error = 'Les deux mots de passe ne correspondent pas.'; return; }
    this.saving.set(true);
    const result = await this.auth.supabase().auth.updateUser({ password: this.password });
    this.saving.set(false);
    if (result.error) { this.error = this.auth.errorMessage(result.error); return; }
    await this.auth.load();
    await this.router.navigateByUrl('/dashboard');
  }
}
