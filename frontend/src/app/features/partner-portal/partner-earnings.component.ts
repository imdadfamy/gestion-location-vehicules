import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { PartnerPortalService } from '../../core/data/partner-portal.service';

@Component({
  standalone: true,
  imports: [DatePipe],
  templateUrl: './partner-earnings.component.html',
})
export class PartnerEarningsComponent implements OnInit {
  rows = signal<any[]>([]);
  loading = signal(false);
  error = signal('');
  constructor(
    private auth: AuthService,
    private portal: PartnerPortalService,
  ) {}
  async ngOnInit() {
    this.loading.set(true);
    this.error.set('');
    const result = await this.portal.earnings();
    this.loading.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.rows.set(result.data ?? []);
  }
  statusLabel(status: string) {
    return (
      (
        {
          pending: 'En attente',
          active: 'En cours',
          overdue: 'En retard',
          completed: 'Terminée',
        } as Record<string, string>
      )[status] ?? status
    );
  }
  statusTone(status: string) {
    return (
      (
        {
          pending: 'warning',
          active: 'primary',
          overdue: 'danger',
          completed: 'success',
        } as Record<string, string>
      )[status] ?? 'secondary'
    );
  }
  money(value: any) {
    return Number(value ?? 0).toLocaleString('fr-FR') + ' FCFA';
  }
  payout(item: any) {
    return Number(item.payout ?? 0);
  }
  totalEarned() {
    return this.rows()
      .filter((item) => item.status === 'completed')
      .reduce((sum, item) => sum + this.payout(item), 0);
  }
}
