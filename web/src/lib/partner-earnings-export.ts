import type { Earning } from '@/lib/data/partner-portal';
import { csvLine } from '@/lib/data/partner-stats';
import { RENTAL_STATUSES } from '@/lib/data/rentals';

/** Montant sans espace insécable (absent de la police standard des PDF). */
const money = (value: unknown) => `${Number(value ?? 0).toLocaleString('fr-FR').replace(/\s/g, ' ')} FCFA`;
const day = (value: string) => new Date(value).toLocaleDateString('fr-FR');
const statusOf = (row: Earning) => RENTAL_STATUSES[row.status]?.label ?? row.status;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Fichier CSV (Excel français : séparateur « ; », encodage UTF-8 avec BOM). */
export function exportEarningsCsv(rows: Earning[], period: string) {
  const lines = [
    csvLine(['Véhicule', 'Immatriculation', 'Départ', 'Retour', 'Jours', 'Statut', 'Prix client (FCFA)', 'Votre part (FCFA)']),
    ...rows.map((row) =>
      csvLine([`${row.make} ${row.model}`, row.registration_number, day(row.departure_date), day(row.return_date), Number(row.days), statusOf(row), Number(row.client_price), Number(row.payout)]),
    ),
  ];
  download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `revenus-fima-auto-${period}.csv`);
}

/** Justificatif PDF des revenus (locations terminées de la période) pour justifier un versement. */
export async function exportEarningsPdf(rows: Earning[], period: string, partnerName: string) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 15;
  let y = 20;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('FIMA AUTO — Relevé de revenus partenaire', left, y);
  y += 8;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`Partenaire : ${partnerName || 'Non renseigné'}`, left, y);
  y += 5;
  pdf.text(`Période : ${period}`, left, y);
  y += 5;
  pdf.text(`Édité le ${new Date().toLocaleDateString('fr-FR')} — locations terminées uniquement`, left, y);
  y += 10;

  const columns = [
    { title: 'Véhicule', x: left, width: 52 },
    { title: 'Période', x: left + 53, width: 42 },
    { title: 'Jours', x: left + 96, width: 12 },
    { title: 'Prix client', x: left + 110, width: 32 },
    { title: 'Votre part', x: left + 143, width: 32 },
  ];
  const header = () => {
    pdf.setFont('helvetica', 'bold');
    columns.forEach((column) => pdf.text(column.title, column.x, y));
    pdf.setLineWidth(0.3);
    pdf.line(left, y + 1.5, 195, y + 1.5);
    pdf.setFont('helvetica', 'normal');
    y += 6;
  };
  header();

  let total = 0;
  let clientTotal = 0;
  for (const row of rows) {
    if (y > 270) {
      pdf.addPage();
      y = 20;
      header();
    }
    total += Number(row.payout);
    clientTotal += Number(row.client_price);
    const cells = [
      `${row.make} ${row.model} (${row.registration_number})`,
      `${day(row.departure_date)} - ${day(row.return_date)}`,
      String(Number(row.days)),
      money(row.client_price),
      money(row.payout),
    ];
    cells.forEach((cell, index) => pdf.text(pdf.splitTextToSize(cell, columns[index].width)[0], columns[index].x, y));
    y += 6;
  }
  if (!rows.length) pdf.text('Aucune location terminée sur cette période.', left, y);

  y += 4;
  pdf.setLineWidth(0.3);
  pdf.line(left, y - 3, 195, y - 3);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Total : ${rows.length} location${rows.length > 1 ? 's' : ''}`, left, y);
  pdf.text(money(clientTotal), columns[3].x, y);
  pdf.text(money(total), columns[4].x, y);
  y += 10;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('Document informatif établi à partir des locations enregistrées par l’agence ; la part du partenaire correspond au prix demandé × nombre de jours.', left, y, { maxWidth: 180 });

  pdf.save(`releve-revenus-fima-auto-${period}.pdf`);
}
