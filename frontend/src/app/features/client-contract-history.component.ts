import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="page-heading"><div><p class="eyebrow">HISTORIQUE</p><h1>Mes contrats</h1><p>Retrouvez vos contrats signés et téléchargez leur PDF officiel.</p></div></div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    @if (loading()) { <div class="empty-state">Chargement de vos contrats…</div> }
    @else if (!contracts().length) { <div class="empty-state">Aucun contrat n’est encore disponible.</div> }
    @else { <div class="row g-3">@for (contract of contracts(); track contract.id) { <div class="col-md-6"><article class="card h-100"><div class="card-body"><span class="badge text-bg-{{ contract.status === 'signed' ? 'success' : 'warning' }}">{{ contract.status === 'signed' ? 'Signé et finalisé' : 'En attente de signature' }}</span><h2 class="h5 mt-3">{{ contract.contract_number || 'Contrat en préparation' }}</h2><p class="mb-1"><strong>{{ contract.generated_content?.vehicle?.make }} {{ contract.generated_content?.vehicle?.model }}</strong><br><span class="text-muted">{{ contract.generated_content?.vehicle?.registration_number }}</span></p><p class="small text-muted mb-3">Créé le {{ contract.created_at | date:'medium' }}</p>@if (contract.final_pdf_storage_path) { <button class="btn btn-primary" (click)="download(contract)">Télécharger le PDF signé</button> } @else { <p class="small text-muted mb-0">Le PDF sera disponible après la signature du Responsable.</p> }</div></article></div> }</div> }
  `
})
export class ClientContractHistoryComponent implements OnInit {
  contracts = signal<any[]>([]); loading = signal(false); error = signal('');
  constructor(private auth: AuthService) {}
  async ngOnInit() {
    this.loading.set(true); this.error.set('');
    const result = await this.auth.supabase().from('contracts').select('*').order('created_at', { ascending: false });
    this.loading.set(false); if (result.error) this.error.set(this.auth.errorMessage(result.error)); else this.contracts.set(result.data ?? []);
  }
  async download(contract: any) {
    const result = await this.auth.supabase().functions.invoke('client-contract-download', { body: { contract_id: contract.id } });
    if (result.error) this.error.set(this.auth.errorMessage(result.error)); else window.open(result.data.signedUrl, '_blank', 'noopener');
  }
}
