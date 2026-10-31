import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { PartnerPortalService } from '../../core/data/partner-portal.service';

@Component({
  standalone: true,
  imports: [DatePipe],
  templateUrl: './partner-inspections.component.html',
})
export class PartnerInspectionsComponent implements OnInit {
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
    const result = await this.portal.inspections();
    this.loading.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.rows.set(result.data ?? []);
  }
}
