import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  styleUrl: './invite.component.scss',
  templateUrl: './invite.component.html',
})
export class InviteComponent implements OnInit {
  checking = signal(true);
  ready = signal(false);
  saving = signal(false);
  password = '';
  confirm = '';
  error = '';

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  async ngOnInit() {
    this.ready.set(await this.auth.hasSession());
    this.checking.set(false);
  }

  async submit() {
    this.error = '';
    if (!this.password || this.password.length < 8) {
      this.error = 'Le mot de passe doit contenir au moins 8 caractères.';
      return;
    }
    if (this.password !== this.confirm) {
      this.error = 'Les deux mots de passe ne correspondent pas.';
      return;
    }
    this.saving.set(true);
    const result = await this.auth.setPassword(this.password);
    this.saving.set(false);
    if (result.error) {
      this.error = this.auth.errorMessage(result.error);
      return;
    }
    await this.auth.load();
    await this.router.navigateByUrl('/dashboard');
  }
}
