import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import SignaturePad from 'signature_pad';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink],
  styles: [`
    .contract-preview { background:#fff; border-radius:18px; padding:28px; box-shadow:0 10px 32px rgba(11,50,58,.10); }
    .stepper{display:flex;align-items:center;gap:0;margin:4px 0 26px;max-width:460px}
    .step-item{display:flex;flex-direction:column;align-items:center;gap:6px;flex:0 0 auto}
    .step-dot{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:.9rem;background:#eaf2f3;color:#7e9398;border:2px solid #dfeaec;transition:all .25s ease}
    .step-label{font-size:.72rem;font-weight:700;color:#8198a0;white-space:nowrap;text-align:center}
    .step-item.active .step-dot{background:#0792a4;border-color:#0792a4;color:#fff;box-shadow:0 0 0 4px rgba(7,146,164,.18)}
    .step-item.active .step-label{color:#0b2429}
    .step-item.done .step-dot{background:#0b7180;border-color:#0b7180;color:#fff}
    .step-item.done .step-dot::after{content:'✓'}
    .step-item.done .step-dot{font-size:0}
    .step-item.done .step-dot::after{font-size:.95rem}
    .step-line{flex:1 1 32px;height:2px;background:#dfeaec;margin:0 6px 20px;transition:background-color .25s ease}
    .step-line.done{background:#0b7180}
    @media(max-width:500px){.stepper{max-width:100%}.step-label{display:none}.step-line{margin-bottom:0}}
    .review-grid { row-gap:1.15rem; }
    .review-card { background:#f3f8f8; border-radius:14px; padding:18px; min-height:120px; line-height:1.55; }
    .review-card strong { display:block; margin-bottom:6px; color:#18323b; }
    .review-card--full { min-height:0; }
    .clause { border-top:1px solid #e2ecee; padding:12px 0; overflow-wrap:anywhere; }
    .signature canvas { width:100%; height:175px; touch-action:none; background:#fff; }
    .correction { background:#fff8e8; border:1px solid #f0cf79; border-radius:14px; padding:16px; }
    .contract-preview .btn + .btn { margin-left: .5rem; }
    @media (max-width:600px) {
      .contract-preview { padding:18px; border-radius:14px; }
      .contract-preview h2 { font-size:1.3rem; }
      .contract-preview .btn { width:100%; min-height:46px; margin-left:0 !important; }
      .contract-preview .btn + .btn { margin-top:9px !important; }
      .signature canvas { height:155px; }
      .contract-preview .badge { align-self:flex-start; }
      .review-card { min-height:0; padding:16px; }
    }
  `],
  template: `
    <div class="page-heading">
      <div><p class="eyebrow">CONTRAT</p><h1>Mon contrat de location</h1><p>Complétez votre dossier, vérifiez les informations puis signez à l’écran.</p></div>
    </div>

    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    @if (message()) { <div class="alert alert-success">{{ message() }}</div> }
    @if (loading()) {
      <div class="empty-state">Chargement…</div>
    } @else if (!contract() && !reservation() && !historyContracts().length) {
      <div class="empty-state">Aucun dossier de contrat n’est disponible. Votre Responsable vous donnera accès après validation de votre réservation.</div>
    } @else if (reservation() && !contract()) {
      <section class="contract-preview">
        <div class="d-flex justify-content-between flex-wrap gap-2">
          <div><span class="eyebrow">DOSSIER À SIGNER</span><h2 class="h3">{{ title() }}</h2></div>
          <span class="badge text-bg-warning">En attente de votre signature</span>
        </div>
        <nav class="stepper" aria-label="Étapes du contrat">
          @for (item of stepperItems; track item.n) {
            <div class="step-item" [class.active]="step()===item.n" [class.done]="step()>item.n"><span class="step-dot">{{item.n}}</span><span class="step-label">{{item.label}}</span></div>
            @if (item.n < 3) { <div class="step-line" [class.done]="step()>item.n"></div> }
          }
        </nav>

        @if (step() === 1) {
          <p>Complétez ou corrigez vos informations avant la signature. Elles seront intégrées au contrat.</p>
          @if (!clientReady()) { <div class="alert alert-warning py-2 small">Informations obligatoires manquantes : {{ missingClientInformation() }}.</div> }
          <a class="btn btn-outline-primary" routerLink="/client/account">Compléter mes informations</a>
          <button class="btn btn-primary ms-2" [disabled]="!clientReady()" (click)="step.set(2)">Suivant : vérifier la location</button>
        }

        @if (step() === 2) {
          <div class="row g-3 review-grid">
            <div class="col-md-6"><div class="review-card"><strong>Client</strong>{{ client().first_name }} {{ client().last_name }}<br>{{ client().phone }}<br>{{ client().email || 'E-mail non renseigné' }}</div></div>
            <div class="col-md-6"><div class="review-card"><strong>Véhicule concerné</strong>{{ reservation().vehicles?.make }} {{ reservation().vehicles?.model }}<br>{{ reservation().vehicles?.registration_number }} · {{ reservation().vehicles?.color || 'Couleur non renseignée' }}<br>{{ reservation().vehicles?.category || 'Catégorie non renseignée' }} · {{ reservation().vehicles?.transmission || 'Transmission non renseignée' }}</div></div>
            <div class="col-md-6"><div class="review-card"><strong>Départ prévu</strong>{{ reservation().planned_departure_date | date:'medium' }}</div></div>
            <div class="col-md-6"><div class="review-card"><strong>Retour prévu</strong>{{ reservation().planned_return_date | date:'medium' }}</div></div>
            <div class="col-md-4"><div class="review-card"><strong>Durée</strong>{{ reservationDuration() }}</div></div>
            <div class="col-md-4"><div class="review-card"><strong>Prix</strong>{{ money(reservation().quoted_rental_price) }}</div></div>
            <div class="col-md-4"><div class="review-card"><strong>Caution</strong>{{ money(reservation().quoted_deposit_amount) }}</div></div>
            <div class="col-12"><div class="review-card review-card--full"><strong>Lieu et zone de conduite</strong>Ces informations seront précisées par le Responsable.</div></div>
          </div>
          <div class="correction mt-4"><strong>Une information est incorrecte ?</strong><p class="small mb-2">Vous ne pouvez pas modifier la période, le véhicule, le prix ou la caution.</p><textarea class="form-control" rows="2" [(ngModel)]="correction" placeholder="Décrivez la correction souhaitée"></textarea><button class="btn btn-outline-secondary btn-sm mt-2" (click)="reportReservationCorrection()">Signaler une correction au Responsable</button></div>
          <button class="btn btn-outline-secondary mt-3" (click)="step.set(1)">Précédent</button><button class="btn btn-primary mt-3 ms-2" (click)="goToSignature()">Suivant : signer</button>
        }

        @if (step() === 3) {
          <p>Je reconnais avoir lu et accepté les informations affichées. Signez : la location et le contrat seront alors créés, puis transmis au Responsable pour sa signature.</p>
          <div class="signature"><canvas #canvas class="border rounded" height="175"></canvas><div class="mt-2"><button class="btn btn-outline-secondary" (click)="clear()">Effacer / recommencer</button><button class="btn btn-success ms-2" [disabled]="saving()" (click)="sign()">{{ saving() ? 'Envoi…' : 'Signer et envoyer' }}</button></div></div>
          <button class="btn btn-link mt-3" (click)="step.set(2)">Précédent</button>
        }
      </section>
    } @else if (contract()) {
      <section class="contract-preview">
        <div class="d-flex justify-content-between flex-wrap gap-2"><div><span class="eyebrow">CONTRAT N° {{ contract().contract_number }}</span><h2 class="h3">{{ title() }}</h2></div><span class="badge" [class.text-bg-warning]="contract().status === 'pending_signature'" [class.text-bg-success]="contract().status === 'signed'">{{ contract().status === 'signed' ? 'Finalisé' : 'En attente de signature' }}</span></div>
        <nav class="stepper" aria-label="Étapes du contrat">
          @for (item of stepperItems; track item.n) {
            <div class="step-item" [class.active]="step()===item.n" [class.done]="step()>item.n"><span class="step-dot">{{item.n}}</span><span class="step-label">{{item.label}}</span></div>
            @if (item.n < 3) { <div class="step-line" [class.done]="step()>item.n"></div> }
          }
        </nav>
        @if (step() === 1) {
          <p>Vos informations peuvent être complétées ou corrigées avant la signature.</p><a class="btn btn-outline-primary" routerLink="/client/account">Compléter mes informations</a><button class="btn btn-primary ms-2" [disabled]="saving()" (click)="refreshContract()">{{ saving() ? 'Actualisation…' : 'Suivant : vérifier la location' }}</button>
        }
        @if (step() === 2) {
          <div class="row g-3 review-grid">
            <div class="col-md-6"><div class="review-card"><strong>Client</strong>{{ content().client?.first_name }} {{ content().client?.last_name }}<br>{{ content().client?.phone }}<br>{{ content().client?.email || 'E-mail non renseigné' }}</div></div>
            <div class="col-md-6"><div class="review-card"><strong>Véhicule concerné</strong>{{ content().vehicle?.make }} {{ content().vehicle?.model }}<br>{{ content().vehicle?.registration_number }} · {{ content().vehicle?.color || 'Couleur non renseignée' }}<br>{{ content().vehicle?.category || 'Catégorie non renseignée' }} · {{ content().vehicle?.transmission || 'Transmission non renseignée' }}</div></div>
            <div class="col-md-6"><div class="review-card"><strong>Départ</strong>{{ content().rental?.departure_date | date:'medium' }}<br>{{ content().rental?.departure_location || 'Lieu à préciser' }}</div></div>
            <div class="col-md-6"><div class="review-card"><strong>Retour prévu</strong>{{ content().rental?.return_date | date:'medium' }}<br>{{ content().rental?.return_location || 'Lieu à préciser' }}</div></div>
            <div class="col-md-4"><div class="review-card"><strong>Durée</strong>{{ duration() }}</div></div>
            <div class="col-md-4"><div class="review-card"><strong>Prix</strong>{{ money(content().rental?.rental_price) }}</div></div>
            <div class="col-md-4"><div class="review-card"><strong>Caution</strong>{{ money(content().rental?.deposit_amount) }}</div></div>
            <div class="col-12"><div class="review-card review-card--full"><strong>Zone de conduite</strong>{{ content().rental?.driving_zone || 'À préciser par le Responsable' }}</div></div>
          </div>
          <div class="correction mt-4"><strong>Une information est incorrecte ?</strong><p class="small mb-2">Vous ne pouvez pas modifier les données de location.</p><textarea class="form-control" rows="2" [(ngModel)]="correction" placeholder="Décrivez la correction souhaitée"></textarea><button class="btn btn-outline-secondary btn-sm mt-2" [disabled]="saving()" (click)="reportCorrection()">Signaler une correction au Responsable</button></div>
          <h3 class="h5 mt-4">Conditions générales</h3>@for (section of content().template?.sections || []; track section.title) { <section class="clause"><strong>{{ section.title }}</strong>@for (clause of section.clauses || []; track clause) { <p class="mb-1">{{ clause }}</p> }</section> }
          <button class="btn btn-outline-secondary mt-3" (click)="step.set(1)">Précédent</button><button class="btn btn-primary mt-3 ms-2" (click)="goToSignature()">Suivant : signer</button>
        }
        @if (step() === 3) {
          @if (clientSigned()) { <div class="alert alert-success mb-0"><strong>Contrat signé par le locataire.</strong><br>En attente de signature du Responsable.</div> }
          @else { <p>Je reconnais avoir lu et accepté le contrat ci-dessus. Signez dans le cadre.</p><div class="signature"><canvas #canvas class="border rounded" height="175"></canvas><div class="mt-2"><button class="btn btn-outline-secondary" (click)="clear()">Effacer / recommencer</button><button class="btn btn-success ms-2" [disabled]="saving()" (click)="sign()">{{ saving() ? 'Validation…' : 'Signer et envoyer' }}</button></div></div><button class="btn btn-link mt-3" (click)="step.set(2)">Précédent</button> }
        }
        @if (contract().final_pdf_storage_path) { <button class="btn btn-primary mt-4" (click)="download()">Télécharger mon PDF signé</button> }
      </section>
    }
    @if (historyContracts().length) { <section class="card mt-4"><div class="card-body"><h2 class="h5 mb-3">Historique des contrats</h2><div class="row g-3">@for (item of historyContracts(); track item.id) { <div class="col-md-6"><article class="border rounded-3 p-3 h-100"><div class="d-flex justify-content-between gap-2"><strong>{{ item.contract_number || 'Contrat en préparation' }}</strong><span class="badge text-bg-{{ item.status === 'signed' ? 'success' : 'warning' }}">{{ item.status === 'signed' ? 'Finalisé' : 'En attente de signature du Responsable' }}</span></div><p class="small text-muted mt-2 mb-3">{{ item.created_at | date:'medium' }} · {{ item.generated_content?.vehicle?.make }} {{ item.generated_content?.vehicle?.model }}</p>@if (item.status === 'signed' && item.final_pdf_storage_path) { <button class="btn btn-sm btn-primary" (click)="downloadContract(item)">Télécharger le PDF</button> } @else { <span class="small text-muted">Le PDF sera disponible après la signature du Responsable.</span> }</article></div> }</div></div></section> }
  `
})
export class ClientContractsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvas?: ElementRef<HTMLCanvasElement>;
  contract = signal<any>(null); historyContracts = signal<any[]>([]); reservation = signal<any>(null); client = signal<any>({}); documents = signal<any[]>([]);
  step = signal(1); loading = signal(false); saving = signal(false); error = signal(''); message = signal(''); clientSigned = signal(false);
  correction = ''; pad?: SignaturePad;
  readonly stepperItems = [{ n: 1, label: 'Mes informations' }, { n: 2, label: 'Vérification' }, { n: 3, label: 'Signature' }];

  constructor(private auth: AuthService) {}
  async ngOnInit() { await this.load(); }
  ngAfterViewInit() { setTimeout(() => this.initPad()); }
  ngOnDestroy() { window.removeEventListener('resize', this.resize); }
  title() { return this.step() === 1 ? '1. Mes informations' : this.step() === 2 ? '2. Informations de location' : '3. Signature'; }
  content() { return this.contract()?.generated_content ?? {}; }
  money(value: any) { return Number(value ?? 0).toLocaleString('en-US').replace(/,/g, ' ') + ' FCFA'; }
  duration() { const rental = this.content().rental; return this.durationFrom(rental?.departure_date, rental?.return_date); }
  reservationDuration() { return this.durationFrom(this.reservation()?.planned_departure_date, this.reservation()?.planned_return_date); }
  durationFrom(start: string, end: string) { if (!start || !end) return 'Non renseignée'; const days = Math.max(1, Math.ceil(Math.max(0, new Date(end).getTime() - new Date(start).getTime()) / 86400000)); return days + ' jour' + (days > 1 ? 's' : ''); }
  clientReady() { return this.missingClientInformation().length === 0; }
  missingClientInformation() {
    const client = this.client(), types = new Set(this.documents().map(document => document.document_type)), missing: string[] = [];
    if (!client.first_name?.trim()) missing.push('prénom'); if (!client.last_name?.trim()) missing.push('nom'); if (!client.phone?.trim()) missing.push('téléphone');
    if (!client.id_document_type?.trim()) missing.push('type de pièce'); if (!client.id_document_number?.trim()) missing.push('numéro de pièce');
    if (!client.address?.trim()) missing.push('adresse'); if (!client.residence?.trim()) missing.push('résidence');
    if (!client.driving_license_number?.trim()) missing.push('numéro de permis'); if (!client.driving_license_expiry_date) missing.push('expiration du permis');
    if (!client.emergency_contact_name?.trim()) missing.push('contact d’urgence'); if (!client.emergency_contact_phone?.trim()) missing.push('numéro d’urgence');
    if (!types.has('identity_document')) missing.push('photo de la pièce d’identité'); if (!types.has('driving_license')) missing.push('photo du permis');
    return missing;
  }

  async load() {
    this.loading.set(true); this.error.set('');
    const [historyResult, clientResult] = await Promise.all([
      this.auth.supabase().rpc('client_contract_history'),
      this.auth.supabase().from('clients').select('*').eq('profile_id', this.auth.profile()?.id ?? '').maybeSingle()
    ]);
    const contracts = Array.isArray(historyResult.data) ? historyResult.data : [];
    this.historyContracts.set(contracts.filter(contract => contract.status === 'signed' || contract.client_signed));
    const contractResult = { data: contracts.find(contract => contract.status === 'pending_signature' && !contract.client_signed) ?? null, error: historyResult.error };
    this.client.set(clientResult.data ?? {});
    if (clientResult.data?.id) {
      const documentsResult = await this.auth.supabase().from('client_documents').select('document_type').eq('client_id', clientResult.data.id);
      this.documents.set(documentsResult.data ?? []);
    } else this.documents.set([]);
    if (contractResult.error) { this.loading.set(false); this.error.set(this.auth.errorMessage(contractResult.error)); return; }
    this.contract.set(contractResult.data); this.reservation.set(null);
    if (contractResult.data) {
      const signature = await this.auth.supabase().from('contract_signatures').select('id').eq('contract_id', contractResult.data.id).eq('signer_type', 'client').maybeSingle();
      this.clientSigned.set(!!signature.data);
    } else {
      const dossier = await this.auth.supabase().rpc('client_pending_contract_dossier');
      if (dossier.error) this.error.set(this.auth.errorMessage(dossier.error)); else this.reservation.set(dossier.data);
    }
    this.loading.set(false); setTimeout(() => this.initPad());
  }

  initPad() {
    if (!this.canvas || this.clientSigned() || (!this.reservation() && this.contract()?.status !== 'pending_signature')) return;
    this.pad = new SignaturePad(this.canvas.nativeElement, { penColor: '#102f38', minWidth: .7, maxWidth: 2.2 });
    this.resize(); window.addEventListener('resize', this.resize);
  }
  goToSignature() { this.error.set(''); this.step.set(3); setTimeout(() => this.initPad()); }
  resize = () => { const canvas = this.canvas?.nativeElement; if (!canvas || !this.pad) return; const width = canvas.getBoundingClientRect().width; if (!width) return; const ratio = Math.max(devicePixelRatio || 1, 1); canvas.width = width * ratio; canvas.height = 175 * ratio; canvas.getContext('2d')?.scale(ratio, ratio); this.pad.clear(); };
  clear() { this.pad?.clear(); }

  async refreshContract() {
    this.saving.set(true); this.error.set(''); const result = await this.auth.supabase().rpc('client_refresh_contract_content', { target_contract_id: this.contract().id }); this.saving.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; } this.contract.set(result.data); this.step.set(2);
  }
  async reportCorrection() {
    if (!this.correction.trim()) { this.error.set('Décrivez la correction à transmettre au Responsable.'); return; }
    this.saving.set(true); this.error.set(''); const result = await this.auth.supabase().rpc('report_contract_correction', { target_contract_id: this.contract().id, correction_message: this.correction.trim() }); this.saving.set(false);
    if (result.error) { this.error.set(this.auth.errorMessage(result.error)); return; } this.correction = ''; this.message.set('Votre demande de correction a été envoyée au Responsable.');
  }
  reportReservationCorrection() {
    if (!this.correction.trim()) { this.error.set('Décrivez la correction à transmettre au Responsable.'); return; }
    this.error.set(''); this.correction = ''; this.message.set('Votre demande de correction a été enregistrée. Contactez votre Responsable pour confirmer la modification.');
  }
  async sign() {
    if (!this.pad || this.pad.isEmpty()) { this.error.set('Votre signature manuscrite ne peut pas être vide.'); return; }
    this.saving.set(true); this.error.set('');
    try {
      const fromReservation = !!this.reservation();
      const path = fromReservation ? `reservations/${this.reservation().id}/signatures/client.png` : `contracts/${this.contract().id}/signatures/client.png`;
      const blob = await (await fetch(this.pad.toDataURL('image/png'))).blob();
      const upload = await this.auth.supabase().storage.from('contract-assets').upload(path, blob, { upsert: false, contentType: 'image/png' });
      if (upload.error) throw upload.error;
      if (fromReservation) {
        const result = await this.auth.supabase().rpc('client_submit_reservation_contract', { target_reservation_id: this.reservation().id, client_signature_storage_path: path });
        if (result.error) throw result.error;
        this.message.set('Votre signature a été envoyée. La location et le contrat ont été créés ; le Responsable doit maintenant signer.'); await this.load(); return;
      }
      const person = this.content().client ?? {};
      const insert = await this.auth.supabase().from('contract_signatures').insert({ contract_id: this.contract().id, signer_type: 'client', signer_name: `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || 'Locataire', signature_storage_path: path, created_by: this.auth.profile().id, signer_user_agent: navigator.userAgent });
      if (insert.error) throw insert.error;
      this.clientSigned.set(true); this.message.set('Votre signature a été enregistrée. Le Responsable a été informé et doit maintenant signer.');
    } catch (error) { this.error.set(this.auth.errorMessage(error)); } finally { this.saving.set(false); }
  }
  async download() { await this.downloadContract(this.contract()); }
  async downloadContract(contract: any) { const result = await this.auth.supabase().functions.invoke('client-contract-download', { body: { contract_id: contract.id } }); if (result.error) this.error.set(this.auth.errorMessage(result.error)); else window.open(result.data.signedUrl, '_blank', 'noopener'); }
}
