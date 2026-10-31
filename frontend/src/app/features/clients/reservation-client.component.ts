import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { DigitsOnlyDirective } from '../../shared/digits-only.directive';

@Component({
  standalone: true,
  imports: [FormsModule, DigitsOnlyDirective],
  templateUrl: './reservation-client.component.html',
})
export class ReservationClientComponent implements OnInit {
  reservation = signal<any>(null);
  matches = signal<any[]>([]);
  form = signal<any>({});
  loading = signal(true);
  saving = signal(false);
  error = signal('');
  message = signal('');
  private id = '';
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
  ) {}
  async ngOnInit() {
    this.id = this.route.snapshot.queryParamMap.get('reservation') ?? '';
    if (!this.id) {
      this.loading.set(false);
      return;
    }
    const result = await this.auth
      .supabase()
      .from('reservations')
      .select('*')
      .eq('id', this.id)
      .in('status', ['pending', 'validated'])
      .maybeSingle();
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      this.loading.set(false);
      return;
    }
    this.reservation.set(result.data);
    if (result.data) {
      this.form.set({
        first_name: result.data.first_name,
        last_name: result.data.last_name,
        phone: result.data.phone,
        address: '',
        email: '',
        id_document_number: '',
        driving_license_number: '',
        driving_license_expiry_date: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
      });
      const matches = await this.auth
        .supabase()
        .from('clients')
        .select('*')
        .eq('phone', result.data.phone)
        .order('last_name');
      this.matches.set(matches.data ?? []);
    }
    this.loading.set(false);
  }
  use(client: any) {
    this.form.set({ ...client });
    this.message.set('Client existant sélectionné. Vérifiez ses informations avant de continuer.');
  }
  async save() {
    const value = this.form();
    if (!value.first_name?.trim() || !value.last_name?.trim() || !value.phone?.trim()) {
      this.error.set('Prénom, nom et téléphone sont obligatoires.');
      return;
    }
    this.saving.set(true);
    const result = value.id
      ? await this.auth
          .supabase()
          .from('clients')
          .update(value)
          .eq('id', value.id)
          .select()
          .single()
      : await this.auth.supabase().from('clients').insert(value).select().single();
    this.saving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    await this.router.navigate(['/reservation-rental'], {
      queryParams: { reservation: this.id, client: result.data.id },
    });
  }
  back() {
    void this.router.navigate(['/reservations']);
  }
}
