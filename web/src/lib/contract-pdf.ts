import type { SupabaseClient } from '@supabase/supabase-js';
import type { jsPDF as JsPdf } from 'jspdf';
import type { Database } from '@/lib/database.types';
import { contentOf, contractDriver, contractDuration, contractMoney, identityDocuments, type Contract } from '@/lib/data/contracts';

type Db = SupabaseClient<Database>;
type Signature = Database['public']['Tables']['contract_signatures']['Row'];

/**
 * PDF du contrat signé — même mise en page que l'application Angular (A4, en-tête
 * avec logo, parties, véhicule, conditions générales, pièces du client, signatures).
 * Exécuté dans le navigateur uniquement.
 */

const asDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const imageFormat = (value: string) =>
  value.startsWith('data:image/png') ? 'PNG' : value.startsWith('data:image/webp') ? 'WEBP' : 'JPEG';

const frDate = (value: unknown) =>
  value ? new Date(String(value)).toLocaleString('fr-FR').replace(/ /g, ' ') : 'Non renseignée';

/** Logo de l'entreprise (paramètres), sinon le logo FIMA AUTO du site. */
export async function companyLogo(db: Db, contract?: Contract | null): Promise<string | null> {
  try {
    const company = contract ? contentOf(contract).company : null;
    let path = company?.logo_storage_path;
    // Contrat d'un partenaire sans logo : jamais le logo de l'agence.
    if (!path && company?.is_partner) return null;
    if (!path) path = (await db.from('company_settings').select('logo_storage_path').limit(1).maybeSingle()).data?.logo_storage_path;
    if (path) {
      // Logo d'un partenaire : stocké avec les documents de contrat ; celui de l'agence, avec les documents de l'entreprise.
      const signed = await db.storage.from(path.startsWith('partners/') ? 'contract-assets' : 'rental-documents').createSignedUrl(path, 60);
      if (signed.data?.signedUrl) return asDataUrl(await (await fetch(signed.data.signedUrl)).blob());
    }
    return asDataUrl(await (await fetch('/logo.jpg')).blob());
  } catch {
    return null;
  }
}

/** Photos (pas les PDF) de la pièce d'identité et du permis, à joindre au contrat. */
async function documentImages(db: Db, clientId: string | null | undefined) {
  if (!clientId) return [];
  const { data, error } = await identityDocuments(db, clientId);
  if (error) return [];
  const images: { title: string; image: string }[] = [];
  for (const document of data ?? []) {
    if (!String(document.mime_type ?? '').startsWith('image/')) continue;
    const file = await db.storage.from('rental-documents').download(document.storage_path);
    if (!file.error)
      images.push({
        title: document.document_type === 'identity_document' ? 'PIÈCE D’IDENTITÉ DU LOCATAIRE' : 'PERMIS DE CONDUIRE DU LOCATAIRE',
        image: await asDataUrl(file.data),
      });
  }
  return images;
}

/** Nom du fichier archivé : contrat-prenom-nom.pdf */
export function contractFileName(contract: Contract) {
  const client = contentOf(contract).client ?? {};
  const clean = (value: unknown) =>
    String(value ?? '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const name = [clean(client.first_name), clean(client.last_name)].filter(Boolean).join('-');
  return `contrat-${name || 'client'}.pdf`;
}

export async function buildContractPdf(db: Db, contract: Contract, signatures: Signature[]) {
  const { jsPDF } = await import('jspdf');
  const content = contentOf(contract);
  const c = content.company ?? {};
  const client = content.client ?? {};
  const vehicle = content.vehicle ?? {};
  const rental = content.rental ?? {};
  const companyName = c.company_name ?? 'FIMA AUTO';
  const logo = await companyLogo(db, contract);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  const header = (doc: JsPdf) => {
    if (logo) doc.addImage(logo, imageFormat(logo), 15, 10, 26, 23);
    doc.setTextColor(17, 119, 135);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`${companyName.toUpperCase()} · LOCATION DE VÉHICULES`, 46, 16);
    doc.setTextColor(13, 48, 58);
    doc.setFontSize(16);
    doc.text('CONTRAT DE LOCATION', 46, 23);
    doc.setFontSize(9);
    doc.text(`N° ${contract.contract_number ?? ''}`, 155, 23);
    doc.setDrawColor(21, 147, 165);
    doc.line(15, 37, 195, 37);
    doc.setFont('helvetica', 'normal');
    return 46;
  };

  let y = header(pdf);
  const heading = (value: string) => {
    if (y + 11 > 276) page();
    pdf.setFillColor(235, 246, 247);
    pdf.roundedRect(15, y - 5, 180, 8, 1, 1, 'F');
    pdf.setTextColor(14, 105, 119);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(value, 18, y);
    y += 9;
  };
  const page = (title?: string) => {
    pdf.addPage();
    y = header(pdf);
    if (title) heading(title);
  };
  const text = (value: string, size = 8.7, indent = 16) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(37, 57, 63);
    const lines = pdf.splitTextToSize(value, 178);
    if (y + lines.length * 4.45 > 277) page();
    pdf.text(lines, indent, y);
    y += lines.length * 4.45 + 1.6;
  };

  heading('PARTIES AU CONTRAT');
  text(
    `Entreprise : ${c.company_name ?? 'À configurer'} | Adresse : ${c.address ?? 'À configurer'} | Téléphone : ${c.phone ?? ''} | RCCM : ${c.rccm ?? ''} | IFU : ${c.ifu ?? ''}`,
  );
  text(`Locataire : ${client.first_name ?? ''} ${client.last_name ?? ''} | Téléphone : ${client.phone ?? 'Non renseigné'}`);
  text(`Résidence : ${client.residence ?? 'Non renseignée'} | Adresse / maison / quartier : ${client.address ?? 'Non renseignée'}`);
  text(`Pièce d’identité : ${client.id_document_type ?? 'Document'} ${client.id_document_number ?? 'Non renseignée'}`);
  text(`Permis : ${client.driving_license_number ?? 'Non renseigné'} | Expire le : ${client.driving_license_expiry_date ?? 'Non renseigné'}`);
  text(`Contact d’urgence : ${client.emergency_contact_name ?? 'Non renseigné'} ${client.emergency_contact_phone ?? ''}`);
  heading('VÉHICULE ET LOCATION');
  text(
    `Véhicule : ${vehicle.make ?? ''} ${vehicle.model ?? ''} | Immatriculation : ${vehicle.registration_number ?? ''} | Couleur : ${vehicle.color ?? ''}`,
  );
  text(`Durée : ${contractDuration(rental)} | Départ : ${frDate(rental.departure_date)} | Retour prévu : ${frDate(rental.return_date)}`);
  text(`Lieu de départ : ${rental.departure_location ?? 'Non renseigné'} | Lieu de retour : ${rental.return_location ?? 'Non renseigné'}`);
  text(`Mode de location : ${contractDriver(rental)}`);
  text(`Zone de conduite déclarée : ${rental.driving_zone ?? 'Non renseignée'}`);
  text(`Prix de location : ${contractMoney(rental.rental_price)}`, 9.5);
  text(`Caution : ${contractMoney(rental.deposit_amount)}`, 9.5);

  heading('CONDITIONS GÉNÉRALES');
  for (const section of content.template?.sections ?? []) {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    const titleLines = pdf.splitTextToSize(section.title, 178);
    let height = titleLines.length * 4.8 + 6;
    for (const clause of section.clauses ?? []) height += pdf.splitTextToSize(`• ${clause}`, 175).length * 4.45 + 1.6;
    if (y + height > 277) page('CONDITIONS GÉNÉRALES — SUITE');
    pdf.setTextColor(18, 74, 85);
    pdf.text(titleLines, 16, y);
    y += titleLines.length * 4.8 + 1;
    for (const clause of section.clauses ?? []) text(`• ${clause}`, 8.7, 18);
    y += 1.5;
  }
  if (y + 22 > 277) page();
  heading('ACCEPTATION');
  text(
    'Le locataire reconnaît avoir lu les présentes conditions générales, les accepter et recevoir un exemplaire du présent contrat de location.',
  );

  for (const document of await documentImages(db, client.id)) {
    if (y + 86 > 277) page();
    heading(document.title);
    const props = pdf.getImageProperties(document.image);
    const scale = Math.min(155 / props.width, 70 / props.height);
    const width = props.width * scale;
    const height = props.height * scale;
    pdf.addImage(document.image, imageFormat(document.image), 105 - width / 2, y, width, height);
    y += height + 7;
  }

  if (y + 85 > 277) page();
  heading('SIGNATURES');
  for (const signature of [...signatures].sort((a, b) => a.signer_type.localeCompare(b.signer_type))) {
    if (y + 38 > 277) page('SIGNATURES — SUITE');
    const file = await db.storage.from('contract-assets').download(signature.signature_storage_path);
    pdf.setDrawColor(173, 201, 205);
    pdf.roundedRect(15, y - 4, 180, 34, 2, 2, 'S');
    pdf.setTextColor(18, 74, 85);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(signature.signer_type === 'client' ? 'LOCATAIRE' : 'RESPONSABLE / PROPRIÉTAIRE', 19, y + 3);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60, 80, 85);
    pdf.setFontSize(8);
    pdf.text(`Signé le ${frDate(signature.signed_at)}`, 19, y + 10);
    if (!file.error) {
      const image = await asDataUrl(file.data);
      pdf.addImage(image, imageFormat(image), 115, y - 1, 62, 23);
    }
    y += 40;
  }

  const total = pdf.getNumberOfPages();
  for (let index = 1; index <= total; index++) {
    pdf.setPage(index);
    pdf.setDrawColor(222, 233, 235);
    pdf.line(15, 287, 195, 287);
    pdf.setTextColor(102, 126, 132);
    pdf.setFontSize(7);
    pdf.text(`Contrat ${contract.contract_number} · Document généré par ${companyName}`, 15, 292);
    pdf.text(`Page ${index} / ${total}`, 180, 292, { align: 'right' });
  }
  return pdf;
}
