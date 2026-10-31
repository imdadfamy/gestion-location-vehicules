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
import SignaturePad from 'signature_pad';
import { jsPDF } from 'jspdf';
import { AuthService } from '../../core/auth.service';
import { ClientsService } from '../../core/data/clients.service';
import { CompanyService } from '../../core/data/company.service';
import { ContractsService } from '../../core/data/contracts.service';
import { StorageService } from '../../core/data/storage.service';

@Component({
  standalone: true,
  imports: [FormsModule, DatePipe],
  styleUrl: './contracts.component.scss',
  templateUrl: './contracts.component.html',
})
export class ContractsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('clientCanvas') clientCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('responsableCanvas') responsableCanvas?: ElementRef<HTMLCanvasElement>;
  clientPad?: SignaturePad;
  responsablePad?: SignaturePad;
  contracts = signal<any[]>([]);
  rentals = signal<any[]>([]);
  current = signal<any>(null);
  brandLogo = signal('/fima-auto-logo.jpg');
  licenseAvailable = signal(false);
  loading = signal(false);
  saving = signal(false);
  creating = signal(false);
  error = signal('');
  message = signal('');
  rentalId = '';
  constructor(
    public auth: AuthService,
    private contractsData: ContractsService,
    private clientsData: ClientsService,
    private companyData: CompanyService,
    private storage: StorageService,
  ) {}
  async ngOnInit() {
    await this.load();
  }
  ngAfterViewInit() {
    this.initPads();
    window.addEventListener('resize', this.resizePads);
  }
  ngOnDestroy() {
    window.removeEventListener('resize', this.resizePads);
  }
  company() {
    return this.current()?.generated_content?.company ?? {};
  }
  client() {
    return this.current()?.generated_content?.client ?? {};
  }
  vehicle() {
    return this.current()?.generated_content?.vehicle ?? {};
  }
  rental() {
    return this.current()?.generated_content?.rental ?? {};
  }
  sections() {
    return this.current()?.generated_content?.template?.sections ?? [];
  }
  money(v: any) {
    return (
      Number(v ?? 0)
        .toLocaleString('en-US')
        .replace(/,/g, ' ') + ' FCFA'
    );
  }
  duration() {
    const a = this.rental()?.departure_date,
      b = this.rental()?.return_date;
    if (!a || !b) return 'Non renseignée';
    const h = Math.max(1, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 3600000)),
      d = Math.floor(h / 24),
      r = h % 24;
    return d ? d + ' jour' + (d > 1 ? 's' : '') + (r ? ' et ' + r + ' h' : '') : h + ' h';
  }
  status(v: string) {
    return (
      (
        {
          draft: 'Brouillon',
          pending_signature: 'En attente des signatures',
          signed: 'Signé',
          cancelled: 'Annulé',
        } as Record<string, string>
      )[v] ?? v
    );
  }
  tone(v: string) {
    return (
      (
        {
          draft: 'secondary',
          pending_signature: 'warning',
          signed: 'success',
          cancelled: 'dark',
        } as Record<string, string>
      )[v] ?? 'secondary'
    );
  }
  private fail(v: unknown) {
    this.error.set(v instanceof Error ? v.message : this.auth.errorMessage(v));
    this.message.set('');
  }
  private reset() {
    this.error.set('');
    this.message.set('');
  }
  private initPads() {
    if (this.clientCanvas) this.clientPad = this.pad(this.clientCanvas.nativeElement);
    if (this.responsableCanvas)
      this.responsablePad = this.pad(this.responsableCanvas.nativeElement);
  }
  private pad(c: HTMLCanvasElement) {
    const p = new SignaturePad(c, { minWidth: 0.7, maxWidth: 2.2, penColor: '#102f38' });
    this.resize(c, p);
    return p;
  }
  private resizePads = () => {
    if (this.clientCanvas && this.clientPad)
      this.resize(this.clientCanvas.nativeElement, this.clientPad);
    if (this.responsableCanvas && this.responsablePad)
      this.resize(this.responsableCanvas.nativeElement, this.responsablePad);
  };
  private resize(c: HTMLCanvasElement, p: SignaturePad) {
    const w = c.getBoundingClientRect().width;
    if (!w) return;
    const r = Math.max(devicePixelRatio || 1, 1);
    c.width = Math.floor(w * r);
    c.height = 180 * r;
    c.getContext('2d')?.scale(r, r);
    p.clear();
  }
  async load() {
    this.loading.set(true);
    const r = await this.contractsData.list();
    this.loading.set(false);
    if (r.error) return this.fail(r.error);
    this.contracts.set(r.data ?? []);
  }
  async openCreation() {
    this.reset();
    this.current.set(null);
    const candidates = await this.contractsData.rentalsWithoutContract();
    if (candidates.error) return this.fail(candidates.error);
    this.rentals.set(candidates.data ?? []);
    this.creating.set(true);
  }
  async create() {
    this.reset();
    const rental = this.rentals().find((x) => x.id === this.rentalId);
    if (!rental) return this.fail(new Error('Sélectionnez une location valide.'));
    this.saving.set(true);
    try {
      const already = await this.contractsData.existingFor(rental.id);
      if (already.error) throw already.error;
      if (already.data)
        throw new Error(
          'Un contrat existe déjà pour cette location (' +
            (already.data.contract_number ?? 'sans numéro') +
            ').',
        );
      const version = await this.contractsData.latestTemplateVersion();
      if (version.error) throw version.error;
      const company = await this.companyData.get();
      if (company.error) throw company.error;
      const content = {
        template: version.data.content,
        company: company.data,
        client: rental.clients,
        vehicle: rental.vehicles,
        rental,
      };
      const made = await this.contractsData.create({
        rental_id: rental.id,
        template_id: version.data.template_id,
        template_version_id: version.data.id,
        status: 'pending_signature',
        generated_content: content,
        generated_html: this.render(content),
      });
      if (made.error) throw made.error;
      this.current.set(made.data);
      this.creating.set(false);
      this.message.set('Contrat créé : le numéro est attribué par PostgreSQL.');
      await this.load();
      await this.assets();
      setTimeout(() => this.initPads());
    } catch (e) {
      this.fail(e);
    } finally {
      this.saving.set(false);
    }
  }
  async select(c: any) {
    this.reset();
    this.current.set(c);
    await this.assets();
    setTimeout(() => this.initPads());
  }
  private render(c: any) {
    return (c.template?.sections ?? [])
      .map((x: any) => [x.title, ...(x.clauses ?? [])].join('\n'))
      .join('\n\n');
  }
  clear(t: 'client' | 'responsable') {
    (t === 'client' ? this.clientPad : this.responsablePad)?.clear();
  }
  async sign(t: 'client' | 'responsable') {
    this.reset();
    const p = t === 'client' ? this.clientPad : this.responsablePad;
    if (!p || p.isEmpty())
      return this.fail(new Error('La signature manuscrite ne peut pas être vide.'));
    this.saving.set(true);
    try {
      const blob = await (await fetch(p.toDataURL('image/png'))).blob();
      const client = this.client(),
        profile = this.auth.profile();
      const signerName =
        t === 'client'
          ? ((client.first_name ?? '') + ' ' + (client.last_name ?? '')).trim() || 'Locataire'
          : (profile?.full_name ?? 'Responsable');
      const failure = await this.contractsData.addSignature(this.current().id, t, signerName, blob);
      if (failure) throw failure;
      this.message.set('Signature enregistrée.');
      p.clear();
    } catch (e) {
      this.fail(e);
    } finally {
      this.saving.set(false);
    }
  }
  async finalize() {
    this.reset();
    const contract = this.current();
    this.saving.set(true);
    try {
      const s = await this.contractsData.signatures(contract.id);
      if (s.error) throw s.error;
      if ((s.data ?? []).length < 2)
        throw new Error('Les signatures du locataire et du responsable sont requises.');
      const pdf = await this.pdf(contract, s.data ?? []);
      const saved = await this.contractsData.archiveSignedPdf(
        contract.id,
        this.pdfFileName(),
        pdf.output('blob'),
      );
      if (saved.error) throw saved.error;
      this.current.set(saved.data);
      this.message.set('Contrat finalisé et PDF archivé.');
    } catch (e) {
      this.fail(e);
    } finally {
      this.saving.set(false);
      await this.load();
    }
  }
  private async pdf(contract: any, signatures: any[]) {
    const logo = await this.logo(),
      pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    let y = this.header(pdf, logo, contract);
    const heading = (v: string) => {
        if (y + 11 > 276) page();
        pdf.setFillColor(235, 246, 247);
        pdf.roundedRect(15, y - 5, 180, 8, 1, 1, 'F');
        pdf.setTextColor(14, 105, 119);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text(v, 18, y);
        y += 9;
      },
      page = (title?: string) => {
        pdf.addPage();
        y = this.header(pdf, logo, contract);
        if (title) heading(title);
      },
      text = (v: string, size = 8.7, indent = 16) => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(size);
        pdf.setTextColor(37, 57, 63);
        const lines = pdf.splitTextToSize(v, 178);
        if (y + lines.length * 4.45 > 277) page();
        pdf.text(lines, indent, y);
        y += lines.length * 4.45 + 1.6;
      },
      c = this.company(),
      client = this.client(),
      vehicle = this.vehicle(),
      rental = this.rental();
    heading('PARTIES AU CONTRAT');
    text(
      'Entreprise : ' +
        (c.company_name ?? 'À configurer') +
        ' | Adresse : ' +
        (c.address ?? 'À configurer') +
        ' | Téléphone : ' +
        (c.phone ?? '') +
        ' | RCCM : ' +
        (c.rccm ?? '') +
        ' | IFU : ' +
        (c.ifu ?? ''),
    );
    text(
      'Locataire : ' +
        (client.first_name ?? '') +
        ' ' +
        (client.last_name ?? '') +
        ' | Téléphone : ' +
        (client.phone ?? 'Non renseigné'),
    );
    text(
      'Résidence : ' +
        (client.residence ?? 'Non renseignée') +
        ' | Adresse / maison / quartier : ' +
        (client.address ?? 'Non renseignée'),
    );
    text(
      'Pièce d’identité : ' +
        (client.id_document_type ?? 'Document') +
        ' ' +
        (client.id_document_number ?? 'Non renseignée'),
    );
    text(
      'Permis : ' +
        (client.driving_license_number ?? 'Non renseigné') +
        ' | Expire le : ' +
        (client.driving_license_expiry_date ?? 'Non renseigné'),
    );
    text(
      'Contact d’urgence : ' +
        (client.emergency_contact_name ?? 'Non renseigné') +
        ' ' +
        (client.emergency_contact_phone ?? ''),
    );
    heading('VÉHICULE ET LOCATION');
    text(
      'Véhicule : ' +
        (vehicle.make ?? '') +
        ' ' +
        (vehicle.model ?? '') +
        ' | Immatriculation : ' +
        (vehicle.registration_number ?? '') +
        ' | Couleur : ' +
        (vehicle.color ?? ''),
    );
    text(
      'Durée : ' +
        this.duration() +
        ' | Départ : ' +
        this.date(rental.departure_date) +
        ' | Retour prévu : ' +
        this.date(rental.return_date),
    );
    text(
      'Lieu de départ : ' +
        (rental.departure_location ?? 'Non renseigné') +
        ' | Lieu de retour : ' +
        (rental.return_location ?? 'Non renseigné'),
    );
    text('Zone de conduite déclarée : ' + (rental.driving_zone ?? 'Non renseignée'));
    text('Prix de location : ' + this.money(rental.rental_price), 9.5);
    text('Caution : ' + this.money(rental.deposit_amount), 9.5);
    heading('CONDITIONS GÉNÉRALES');
    for (const section of this.sections()) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      const sl = pdf.splitTextToSize(section.title, 178);
      let h = sl.length * 4.8 + 6;
      for (const clause of section.clauses ?? [])
        h += pdf.splitTextToSize('• ' + clause, 175).length * 4.45 + 1.6;
      if (y + h > 277) page('CONDITIONS GÉNÉRALES — SUITE');
      pdf.setTextColor(18, 74, 85);
      pdf.text(sl, 16, y);
      y += sl.length * 4.8 + 1;
      for (const clause of section.clauses ?? []) text('• ' + clause, 8.7, 18);
      y += 1.5;
    }
    if (y + 22 > 277) page();
    heading('ACCEPTATION');
    text(
      'Le locataire reconnaît avoir lu les présentes conditions générales, les accepter et recevoir un exemplaire du présent contrat de location.',
    );
    for (const document of await this.documentImages()) {
      if (y + 86 > 277) page();
      heading(document.title);
      const p = pdf.getImageProperties(document.image),
        scale = Math.min(155 / p.width, 70 / p.height),
        w = p.width * scale,
        h = p.height * scale;
      pdf.addImage(document.image, this.format(document.image), 105 - w / 2, y, w, h);
      y += h + 7;
    }
    if (y + 85 > 277) page();
    heading('SIGNATURES');
    for (const s of signatures.sort((a, b) => a.signer_type.localeCompare(b.signer_type))) {
      if (y + 38 > 277) page('SIGNATURES — SUITE');
      const file = await this.contractsData.signatureImage(s.signature_storage_path);
      pdf.setDrawColor(173, 201, 205);
      pdf.roundedRect(15, y - 4, 180, 34, 2, 2, 'S');
      pdf.setTextColor(18, 74, 85);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text(s.signer_type === 'client' ? 'LOCATAIRE' : 'RESPONSABLE / PROPRIÉTAIRE', 19, y + 3);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(60, 80, 85);
      pdf.setFontSize(8);
      pdf.text('Signé le ' + this.date(s.signed_at), 19, y + 10);
      if (!file.error) {
        const image = await this.data(file.data);
        pdf.addImage(image, this.format(image), 115, y - 1, 62, 23);
      }
      y += 40;
    }
    this.footer(pdf, contract.contract_number);
    return pdf;
  }
  private header(pdf: jsPDF, logo: string | null, c: any) {
    if (logo) pdf.addImage(logo, this.format(logo), 15, 10, 26, 23);
    pdf.setTextColor(17, 119, 135);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(
      (this.company().company_name ?? 'FIMA AUTO').toUpperCase() + ' · LOCATION DE VÉHICULES',
      46,
      16,
    );
    pdf.setTextColor(13, 48, 58);
    pdf.setFontSize(16);
    pdf.text('CONTRAT DE LOCATION', 46, 23);
    pdf.setFontSize(9);
    pdf.text('N° ' + (c.contract_number ?? ''), 155, 23);
    pdf.setDrawColor(21, 147, 165);
    pdf.line(15, 37, 195, 37);
    pdf.setFont('helvetica', 'normal');
    return 46;
  }
  private footer(pdf: jsPDF, n: string) {
    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setDrawColor(222, 233, 235);
      pdf.line(15, 287, 195, 287);
      pdf.setTextColor(102, 126, 132);
      pdf.setFontSize(7);
      pdf.text(
        'Contrat ' + n + ' · Document généré par ' + (this.company().company_name ?? 'FIMA AUTO'),
        15,
        292,
      );
      pdf.text('Page ' + i + ' / ' + total, 180, 292, { align: 'right' });
    }
  }
  private date(v: any) {
    return v ? new Date(v).toLocaleString('fr-FR').replace(/\\u202f/g, ' ') : 'Non renseignée';
  }
  private format(v: string) {
    return v.startsWith('data:image/png')
      ? 'PNG'
      : v.startsWith('data:image/webp')
        ? 'WEBP'
        : 'JPEG';
  }
  private data(b: Blob) {
    return new Promise<string>((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => no(r.error);
      r.readAsDataURL(b);
    });
  }
  private pdfFileName() {
    const client = this.client();
    const clean = (value: any) =>
      String(value ?? '')
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const name = [clean(client.first_name), clean(client.last_name)].filter(Boolean).join('-');
    return 'contrat-' + (name || 'client') + '.pdf';
  }
  private async docs() {
    const id = this.client()?.id;
    if (!id) return [];
    const r = await this.clientsData.identityDocuments(id);
    return r.error ? [] : (r.data ?? []);
  }
  private async documentImages() {
    const images: { title: string; image: string }[] = [];
    for (const d of await this.docs()) {
      if (!String(d.mime_type ?? '').startsWith('image/')) continue;
      const f = await this.storage.download('rental-documents', d.storage_path);
      if (!f.error)
        images.push({
          title:
            d.document_type === 'identity_document'
              ? 'PIÈCE D’IDENTITÉ DU LOCATAIRE'
              : 'PERMIS DE CONDUIRE DU LOCATAIRE',
          image: await this.data(f.data),
        });
    }
    return images;
  }
  private async assets() {
    this.brandLogo.set((await this.logo()) ?? '/fima-auto-logo.jpg');
    this.licenseAvailable.set((await this.docs()).length > 0);
  }
  private async logo(): Promise<string | null> {
    try {
      let path = this.company()?.logo_storage_path;
      if (!path) path = (await this.companyData.get('logo_storage_path')).data?.logo_storage_path;
      const url = await this.companyData.logoUrl(path, 60);
      if (url) return this.data(await (await fetch(url)).blob());
      return this.data(await (await fetch('/fima-auto-logo.jpg')).blob());
    } catch {
      return null;
    }
  }
  async download() {
    this.reset();
    const r = await this.contractsData.pdfUrl(this.current().final_pdf_storage_path);
    if (r.error) this.fail(r.error);
    else window.open(r.data.signedUrl, '_blank', 'noopener');
  }
}
