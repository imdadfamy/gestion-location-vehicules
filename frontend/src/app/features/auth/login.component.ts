import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  email = '';
  password = '';
  error = '';
  constructor(
    private a: AuthService,
    private r: Router,
  ) {}
  async go() {
    const result = await this.a.login(this.email, this.password);
    this.error = result ? this.a.errorMessage(result) : '';
    if (!this.error) this.r.navigateByUrl('/dashboard');
  }
}
