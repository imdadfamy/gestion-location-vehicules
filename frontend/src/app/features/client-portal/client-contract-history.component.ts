import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [DatePipe],
  templateUrl: './client-contract-history.component.html',
})
export class ClientContractHistoryComponent implements OnInit {
  contracts = signal<any[]>([]);
  loading = signal(false);
  error = signal('');
  constructor(private auth: AuthService) {}
  async ngOnInit() {
    this.loading.set(true);
    this.error.set('');
    const result = await this.auth
      .supabase()
      .from('contracts')
      .select('*')
      .order('created_at', { ascending: false });
    this.loading.set(false);
    if (result.error) this.error.set(this.auth.errorMessage(result.error));
    else this.contracts.set(result.data ?? []);
  }
  async download(contract: any) {
    const result = await this.auth
      .supabase()
      .functions.invoke('client-contract-download', { body: { contract_id: contract.id } });
    if (result.error) this.error.set(this.auth.errorMessage(result.error));
    else window.open(result.data.signedUrl, '_blank', 'noopener');
  }
}
