import { Component, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { jsPDF } from 'jspdf';
import { AuthService } from '../../core/auth.service';

type PhotoType = 'front' | 'rear' | 'left_side' | 'right_side' | 'interior';
const photoTypes: { key: PhotoType; label: string }[] = [
  { key: 'front', label: 'Avant' },
  { key: 'rear', label: 'Arrière' },
  { key: 'left_side', label: 'Côté gauche' },
  { key: 'right_side', label: 'Côté droit' },
  { key: 'interior', label: 'Intérieur' },
];
@Component({
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
  styleUrl: './inspections.component.scss',
  templateUrl: './inspections.component.html',
})
export class InspectionsComponent implements OnInit {
  photoTypes = photoTypes;
  inspections = signal<any[]>([]);
  rentals = signal<any[]>([]);
  form = signal<any>(null);
  comparison = signal<any>(null);
  detailInspection = signal<any>(null);
  detailPhotos = signal<any[]>([]);
  loading = signal(false);
  saving = signal(false);
  pdfSaving = signal(false);
  error = signal('');
  message = signal('');
  private files = new Map<PhotoType, File>();
  constructor(
    public auth: AuthService,
    private route: ActivatedRoute,
  ) {}
  async ngOnInit() {
    await this.load();
    const id = this.route.snapshot.queryParamMap.get('rental');
    if (id && this.auth.can('inspections', 'create')) await this.openForm(id);
  }
  private clear() {
    this.error.set('');
    this.message.set('');
  }
  private fail(e: unknown) {
    this.error.set(this.auth.errorMessage(e));
    this.message.set('');
  }
  label(type: string) {
    return type === 'departure' ? 'Départ' : 'Retour';
  }
  photoLabel(type: string) {
    return photoTypes.find((x) => x.key === type)?.label ?? 'Photo complémentaire';
  }
  async load() {
    this.loading.set(true);
    this.clear();
    const r = await this.auth
      .supabase()
      .from('vehicle_inspections')
      .select(
        '*,rentals(id,departure_date,clients(first_name,last_name),vehicles(registration_number))',
      )
      .order('inspection_date', { ascending: false });
    this.loading.set(false);
    if (r.error) return this.fail(r.error);
    this.inspections.set(r.data ?? []);
  }
  async openForm(id = '') {
    this.clear();
    this.closeDetail();
    this.comparison.set(null);
    this.files.clear();
    await this.auth.supabase().rpc('refresh_overdue_rentals');
    const r = await this.auth
      .supabase()
      .from('rentals')
      .select('id,status,vehicle_id,clients(first_name,last_name),vehicles(registration_number)')
      .in('status', ['pending', 'active', 'overdue']);
    if (r.error) return this.fail(r.error);
    this.rentals.set(r.data ?? []);
    this.form.set({
      rental_id: id,
      vehicle_id: '',
      inspection_type: 'departure',
      inspection_date: this.localDate(),
      mileage: 0,
      fuel_level: '',
      damagesText: '',
      observations: '',
    });
    this.selectRental();
  }
  selectRental() {
    const form = this.form(),
      rental = this.rentals().find((x) => x.id === form?.rental_id);
    if (rental) this.form.set({ ...form, vehicle_id: rental.vehicle_id });
  }
  choose(type: PhotoType, e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) this.files.set(type, f);
  }
  async save() {
    this.clear();
    const f = this.form();
    if (!f?.rental_id || !f.vehicle_id || Number(f.mileage) < 0)
      return this.fail(new Error('Location, véhicule et kilométrage valide sont requis.'));
    this.saving.set(true);
    try {
      const i = await this.auth
        .supabase()
        .from('vehicle_inspections')
        .insert({
          rental_id: f.rental_id,
          vehicle_id: f.vehicle_id,
          inspection_type: f.inspection_type,
          inspection_date: new Date(f.inspection_date).toISOString(),
          mileage: Number(f.mileage),
          fuel_level: f.fuel_level || null,
          observations: f.observations || null,
          damages: f.damagesText
            ? f.damagesText
                .split('\n')
                .map((x: string) => x.trim())
                .filter(Boolean)
            : [],
        })
        .select()
        .single();
      if (i.error) throw i.error;
      for (const [type, file] of this.files) {
        const path =
            'inspections/' +
            i.data.id +
            '/' +
            type +
            '-' +
            file.name.replace(/[^a-zA-Z0-9._-]/g, '_'),
          up = await this.auth
            .supabase()
            .storage.from('inspection-photos')
            .upload(path, file, { upsert: false, contentType: file.type });
        if (up.error)
          throw new Error(
            'Inspection créée, mais photo ' +
              this.photoLabel(type) +
              ' non envoyée : ' +
              this.auth.errorMessage(up.error),
          );
        const p = await this.auth
          .supabase()
          .from('inspection_photos')
          .insert({ inspection_id: i.data.id, photo_type: type, storage_path: path });
        if (p.error) throw p.error;
      }
      this.form.set(null);
      this.files.clear();
      this.message.set('Inspection et photos enregistrées.');
      await this.load();
      await this.detail(i.data);
    } catch (e) {
      this.fail(e);
    } finally {
      this.saving.set(false);
    }
  }
  async detail(item: any) {
    this.clear();
    const i = await this.auth
      .supabase()
      .from('vehicle_inspections')
      .select('*,rentals(*,clients(*),vehicles(*))')
      .eq('id', item.id)
      .single();
    if (i.error) return this.fail(i.error);
    const p = await this.auth
      .supabase()
      .from('inspection_photos')
      .select('*')
      .eq('inspection_id', item.id)
      .order('created_at');
    if (p.error) return this.fail(p.error);
    const photos = await Promise.all(
      (p.data ?? []).map(async (photo) => {
        const url = await this.auth
          .supabase()
          .storage.from('inspection-photos')
          .createSignedUrl(photo.storage_path, 300);
        return { ...photo, urls: url.data };
      }),
    );
    this.detailInspection.set(i.data);
    this.detailPhotos.set(photos);
    setTimeout(
      () =>
        document
          .querySelector('.inspection-sheet')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      0,
    );
  }
  async openPhoto(photo: any) {
    const r = await this.auth
      .supabase()
      .storage.from('inspection-photos')
      .createSignedUrl(photo.storage_path, 60);
    if (r.error) this.fail(r.error);
    else window.open(r.data.signedUrl, '_blank', 'noopener');
  }
  closeDetail() {
    this.detailInspection.set(null);
    this.detailPhotos.set([]);
  }
  async compare(rentalId: string) {
    this.clear();
    const r = await this.auth
      .supabase()
      .from('vehicle_inspections')
      .select('*')
      .eq('rental_id', rentalId);
    if (r.error) return this.fail(r.error);
    this.comparison.set({
      departure: r.data?.find((x) => x.inspection_type === 'departure'),
      return: r.data?.find((x) => x.inspection_type === 'return'),
    });
  }
  damages(i: any) {
    return Array.isArray(i?.damages) && i.damages.length ? i.damages.join('; ') : 'Aucun';
  }
  async downloadPdf() {
    const inspection = this.detailInspection();
    if (!inspection) return;
    this.pdfSaving.set(true);
    this.clear();
    try {
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      let y = 18;
      pdf.setTextColor(17, 119, 135);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text(
        'JUSTIFICATIF D’INSPECTION ' + this.label(inspection.inspection_type).toUpperCase(),
        15,
        y,
      );
      y += 10;
      pdf.setDrawColor(21, 147, 165);
      pdf.line(15, y, 195, y);
      y += 9;
      const text = (value: string) => {
        pdf.setTextColor(37, 57, 63);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        const lines = pdf.splitTextToSize(value, 178);
        if (y + lines.length * 5 > 276) {
          pdf.addPage();
          y = 20;
        }
        pdf.text(lines, 16, y);
        y += lines.length * 5 + 3;
      };
      text(
        'Client : ' +
          (inspection.rentals?.clients?.first_name ?? '') +
          ' ' +
          (inspection.rentals?.clients?.last_name ?? ''),
      );
      text(
        'Véhicule : ' +
          (inspection.rentals?.vehicles?.make ?? '') +
          ' ' +
          (inspection.rentals?.vehicles?.model ?? '') +
          ' — ' +
          (inspection.rentals?.vehicles?.registration_number ?? ''),
      );
      text(
        'Location : départ ' +
          this.date(inspection.rentals?.departure_date) +
          ' | retour ' +
          this.date(inspection.rentals?.return_date),
      );
      text(
        'Inspection : ' +
          this.label(inspection.inspection_type) +
          ' | Date : ' +
          this.date(inspection.inspection_date),
      );
      text(
        'Kilométrage : ' +
          inspection.mileage +
          ' km | Carburant : ' +
          (inspection.fuel_level ?? 'Non renseigné'),
      );
      text('Dommages : ' + this.damages(inspection));
      text('Observations : ' + (inspection.observations ?? 'Aucune'));
      for (const photo of this.detailPhotos()) {
        const file = await this.auth
          .supabase()
          .storage.from('inspection-photos')
          .download(photo.storage_path);
        if (file.error) continue;
        const image = await this.data(file.data);
        const props = pdf.getImageProperties(image),
          scale = Math.min(165 / props.width, 125 / props.height),
          w = props.width * scale,
          h = props.height * scale;
        if (y + h + 20 > 276) {
          pdf.addPage();
          y = 20;
        }
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(14, 105, 119);
        pdf.text('Photo : ' + this.photoLabel(photo.photo_type), 16, y);
        y += 6;
        pdf.addImage(image, this.format(image), 105 - w / 2, y, w, h);
        y += h + 8;
      }
      if (!this.detailPhotos().length) text('Photos : aucune photo ajoutée.');
      const pages = pdf.getNumberOfPages();
      for (let page = 1; page <= pages; page++) {
        pdf.setPage(page);
        pdf.setFontSize(7);
        pdf.setTextColor(102, 126, 132);
        pdf.text('Justificatif inspection · Location ' + (inspection.rental_id ?? ''), 15, 292);
        pdf.text('Page ' + page + ' / ' + pages, 180, 292, { align: 'right' });
      }
      pdf.save('inspection-' + inspection.inspection_type + '-' + inspection.id + '.pdf');
      this.message.set('Justificatif PDF téléchargé.');
    } catch (e) {
      this.fail(e);
    } finally {
      this.pdfSaving.set(false);
    }
  }
  private data(b: Blob) {
    return new Promise<string>((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => no(r.error);
      r.readAsDataURL(b);
    });
  }
  private format(v: string) {
    return v.startsWith('data:image/png')
      ? 'PNG'
      : v.startsWith('data:image/webp')
        ? 'WEBP'
        : 'JPEG';
  }
  private date(v: any) {
    return v ? new Date(v).toLocaleString('fr-FR') : 'Non renseigné';
  }
  private localDate() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }
}
