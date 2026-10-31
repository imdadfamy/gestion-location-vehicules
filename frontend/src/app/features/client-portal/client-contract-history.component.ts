import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { ClientPortalService } from '../../core/data/client-portal.service';

@Component({
  standalone: true,
  imports: [DatePipe],
  templateUrl: './client-contract-history.component.html',
})
export class ClientContractHistoryComponent implements OnInit {
  contracts = signal<any[]>([]);
  loading = signal(false);
  error = signal('');
  constructor(
    private auth: AuthService,
    private portal: ClientPortalService,
  ) {}
  async ngOnInit() {
    this.loading.set(true);
    this.error.set('');
    const result = await this.portal.contracts();
    this.loading.set(false);
    if (result.error) this.error.set(this.auth.errorMessage(result.error));
    else this.contracts.set(result.data ?? []);
  }
  async download(contract: any) {
    const result = await this.portal.contractPdfUrl(contract.id);
    if (result.error || !result.url) this.error.set(this.auth.errorMessage(result.error));
    else window.open(result.url, '_blank', 'noopener');
  }
}
