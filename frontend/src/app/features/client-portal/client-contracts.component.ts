import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import SignaturePad from 'signature_pad';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink],
  styleUrl: './client-contracts.component.scss',
  templateUrl: './client-contracts.component.html',
})
export class ClientContractsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvas?: ElementRef<HTMLCanvasElement>;
  contract = signal<any>(null);
  historyContracts = signal<any[]>([]);
  reservation = signal<any>(null);
  client = signal<any>({});
  documents = signal<any[]>([]);
  step = signal(1);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  message = signal('');
  clientSigned = signal(false);
  correction = '';
  pad?: SignaturePad;
  readonly stepperItems = [
    { n: 1, label: 'Mes informations' },
    { n: 2, label: 'Vérification' },
    { n: 3, label: 'Signature' },
  ];

  constructor(private auth: AuthService) {}
  async ngOnInit() {
    await this.load();
  }
  ngAfterViewInit() {
    setTimeout(() => this.initPad());
  }
  ngOnDestroy() {
    window.removeEventListener('resize', this.resize);
  }
  title() {
    return this.step() === 1
      ? '1. Mes informations'
      : this.step() === 2
        ? '2. Informations de location'
        : '3. Signature';
  }
  content() {
    return this.contract()?.generated_content ?? {};
  }
  money(value: any) {
    return (
      Number(value ?? 0)
        .toLocaleString('en-US')
        .replace(/,/g, ' ') + ' FCFA'
    );
  }
  duration() {
    const rental = this.content().rental;
    return this.durationFrom(rental?.departure_date, rental?.return_date);
  }
  reservationDuration() {
    return this.durationFrom(
      this.reservation()?.planned_departure_date,
      this.reservation()?.planned_return_date,
    );
  }
  durationFrom(start: string, end: string) {
    if (!start || !end) return 'Non renseignée';
    const days = Math.max(
      1,
      Math.ceil(Math.max(0, new Date(end).getTime() - new Date(start).getTime()) / 86400000),
    );
    return days + ' jour' + (days > 1 ? 's' : '');
  }
  clientReady() {
    return this.missingClientInformation().length === 0;
  }
  missingClientInformation() {
    const client = this.client(),
      types = new Set(this.documents().map((document) => document.document_type)),
      missing: string[] = [];
    if (!client.first_name?.trim()) missing.push('prénom');
    if (!client.last_name?.trim()) missing.push('nom');
    if (!client.phone?.trim()) missing.push('téléphone');
    if (!client.id_document_type?.trim()) missing.push('type de pièce');
    if (!client.id_document_number?.trim()) missing.push('numéro de pièce');
    if (!client.address?.trim()) missing.push('adresse');
    if (!client.residence?.trim()) missing.push('résidence');
    if (!client.driving_license_number?.trim()) missing.push('numéro de permis');
    if (!client.driving_license_expiry_date) missing.push('expiration du permis');
    if (!client.emergency_contact_name?.trim()) missing.push('contact d’urgence');
    if (!client.emergency_contact_phone?.trim()) missing.push('numéro d’urgence');
    if (!types.has('identity_document')) missing.push('photo de la pièce d’identité');
    if (!types.has('driving_license')) missing.push('photo du permis');
    return missing;
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    const [historyResult, clientResult] = await Promise.all([
      this.auth.supabase().rpc('client_contract_history'),
      this.auth
        .supabase()
        .from('clients')
        .select('*')
        .eq('profile_id', this.auth.profile()?.id ?? '')
        .maybeSingle(),
    ]);
    const contracts = Array.isArray(historyResult.data) ? (historyResult.data as any[]) : [];
    this.historyContracts.set(
      contracts.filter((contract) => contract.status === 'signed' || contract.client_signed),
    );
    const contractResult = {
      data:
        contracts.find(
          (contract) => contract.status === 'pending_signature' && !contract.client_signed,
        ) ?? null,
      error: historyResult.error,
    };
    this.client.set(clientResult.data ?? {});
    if (clientResult.data?.id) {
      const documentsResult = await this.auth
        .supabase()
        .from('client_documents')
        .select('document_type')
        .eq('client_id', clientResult.data.id);
      this.documents.set(documentsResult.data ?? []);
    } else this.documents.set([]);
    if (contractResult.error) {
      this.loading.set(false);
      this.error.set(this.auth.errorMessage(contractResult.error));
      return;
    }
    this.contract.set(contractResult.data);
    this.reservation.set(null);
    if (contractResult.data) {
      const signature = await this.auth
        .supabase()
        .from('contract_signatures')
        .select('id')
        .eq('contract_id', contractResult.data.id)
        .eq('signer_type', 'client')
        .maybeSingle();
      this.clientSigned.set(!!signature.data);
    } else {
      const dossier = await this.auth.supabase().rpc('client_pending_contract_dossier');
      if (dossier.error) this.error.set(this.auth.errorMessage(dossier.error));
      else this.reservation.set(dossier.data);
    }
    this.loading.set(false);
    setTimeout(() => this.initPad());
  }

  initPad() {
    if (
      !this.canvas ||
      this.clientSigned() ||
      (!this.reservation() && this.contract()?.status !== 'pending_signature')
    )
      return;
    this.pad = new SignaturePad(this.canvas.nativeElement, {
      penColor: '#102f38',
      minWidth: 0.7,
      maxWidth: 2.2,
    });
    this.resize();
    window.addEventListener('resize', this.resize);
  }
  goToSignature() {
    this.error.set('');
    this.step.set(3);
    setTimeout(() => this.initPad());
  }
  resize = () => {
    const canvas = this.canvas?.nativeElement;
    if (!canvas || !this.pad) return;
    const width = canvas.getBoundingClientRect().width;
    if (!width) return;
    const ratio = Math.max(devicePixelRatio || 1, 1);
    canvas.width = width * ratio;
    canvas.height = 175 * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);
    this.pad.clear();
  };
  clear() {
    this.pad?.clear();
  }

  async refreshContract() {
    this.saving.set(true);
    this.error.set('');
    const result = await this.auth
      .supabase()
      .rpc('client_refresh_contract_content', { target_contract_id: this.contract().id });
    this.saving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.contract.set(result.data);
    this.step.set(2);
  }
  async reportCorrection() {
    if (!this.correction.trim()) {
      this.error.set('Décrivez la correction à transmettre au Responsable.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const result = await this.auth.supabase().rpc('report_contract_correction', {
      target_contract_id: this.contract().id,
      correction_message: this.correction.trim(),
    });
    this.saving.set(false);
    if (result.error) {
      this.error.set(this.auth.errorMessage(result.error));
      return;
    }
    this.correction = '';
    this.message.set('Votre demande de correction a été envoyée au Responsable.');
  }
  reportReservationCorrection() {
    if (!this.correction.trim()) {
      this.error.set('Décrivez la correction à transmettre au Responsable.');
      return;
    }
    this.error.set('');
    this.correction = '';
    this.message.set(
      'Votre demande de correction a été enregistrée. Contactez votre Responsable pour confirmer la modification.',
    );
  }
  async sign() {
    if (!this.pad || this.pad.isEmpty()) {
      this.error.set('Votre signature manuscrite ne peut pas être vide.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const fromReservation = !!this.reservation();
      const path = fromReservation
        ? `reservations/${this.reservation().id}/signatures/client.png`
        : `contracts/${this.contract().id}/signatures/client.png`;
      const blob = await (await fetch(this.pad.toDataURL('image/png'))).blob();
      const upload = await this.auth
        .supabase()
        .storage.from('contract-assets')
        .upload(path, blob, { upsert: false, contentType: 'image/png' });
      if (upload.error) throw upload.error;
      if (fromReservation) {
        const result = await this.auth.supabase().rpc('client_submit_reservation_contract', {
          target_reservation_id: this.reservation().id,
          client_signature_storage_path: path,
        });
        if (result.error) throw result.error;
        this.message.set(
          'Votre signature a été envoyée. La location et le contrat ont été créés ; le Responsable doit maintenant signer.',
        );
        await this.load();
        return;
      }
      const person = this.content().client ?? {};
      const insert = await this.auth
        .supabase()
        .from('contract_signatures')
        .insert({
          contract_id: this.contract().id,
          signer_type: 'client',
          signer_name: `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || 'Locataire',
          signature_storage_path: path,
          created_by: this.auth.profile().id,
          signer_user_agent: navigator.userAgent,
        });
      if (insert.error) throw insert.error;
      this.clientSigned.set(true);
      this.message.set(
        'Votre signature a été enregistrée. Le Responsable a été informé et doit maintenant signer.',
      );
    } catch (error) {
      this.error.set(this.auth.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }
  async download() {
    await this.downloadContract(this.contract());
  }
  async downloadContract(contract: any) {
    const result = await this.auth
      .supabase()
      .functions.invoke('client-contract-download', { body: { contract_id: contract.id } });
    if (result.error) this.error.set(this.auth.errorMessage(result.error));
    else window.open(result.data.signedUrl, '_blank', 'noopener');
  }
}
