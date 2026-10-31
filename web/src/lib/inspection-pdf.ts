import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { damagesText, inspectionLabel, photoLabel, type InspectionDetail, type InspectionPhoto } from '@/lib/data/inspections';

type Db = SupabaseClient<Database>;

const asDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
const imageFormat = (value: string) =>
  value.startsWith('data:image/png') ? 'PNG' : value.startsWith('data:image/webp') ? 'WEBP' : 'JPEG';
const frDate = (value: unknown) => (value ? new Date(String(value)).toLocaleString('fr-FR') : 'Non renseigné');

/** Justificatif PDF d'inspection — même contenu que l'application Angular, téléchargé sur le poste. */
export async function downloadInspectionPdf(db: Db, inspection: InspectionDetail, photos: InspectionPhoto[]) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const rental = inspection.rentals;
  let y = 18;
  pdf.setTextColor(17, 119, 135);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(`JUSTIFICATIF D’INSPECTION ${inspectionLabel(inspection.inspection_type).toUpperCase()}`, 15, y);
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
  text(`Client : ${rental?.clients?.first_name ?? ''} ${rental?.clients?.last_name ?? ''}`);
  text(`Véhicule : ${rental?.vehicles?.make ?? ''} ${rental?.vehicles?.model ?? ''} — ${rental?.vehicles?.registration_number ?? ''}`);
  text(`Location : départ ${frDate(rental?.departure_date)} | retour ${frDate(rental?.return_date)}`);
  text(`Inspection : ${inspectionLabel(inspection.inspection_type)} | Date : ${frDate(inspection.inspection_date)}`);
  text(`Kilométrage : ${inspection.mileage} km | Carburant : ${inspection.fuel_level ?? 'Non renseigné'}`);
  text(`Dommages : ${damagesText(inspection)}`);
  text(`Observations : ${inspection.observations ?? 'Aucune'}`);
  for (const photo of photos) {
    const file = await db.storage.from('inspection-photos').download(photo.storage_path);
    if (file.error) continue;
    const image = await asDataUrl(file.data);
    const props = pdf.getImageProperties(image);
    const scale = Math.min(165 / props.width, 125 / props.height);
    const width = props.width * scale;
    const height = props.height * scale;
    if (y + height + 20 > 276) {
      pdf.addPage();
      y = 20;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(14, 105, 119);
    pdf.text(`Photo : ${photoLabel(photo.photo_type)}`, 16, y);
    y += 6;
    pdf.addImage(image, imageFormat(image), 105 - width / 2, y, width, height);
    y += height + 8;
  }
  if (!photos.length) text('Photos : aucune photo ajoutée.');
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setFontSize(7);
    pdf.setTextColor(102, 126, 132);
    pdf.text(`Justificatif inspection · Location ${inspection.rental_id ?? ''}`, 15, 292);
    pdf.text(`Page ${page} / ${pages}`, 180, 292, { align: 'right' });
  }
  pdf.save(`inspection-${inspection.inspection_type}-${inspection.id}.pdf`);
}
