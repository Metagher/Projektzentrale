import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface TimeReportTrackingRow {
  date: string;
  project: string;
  assignment: string;
  start: string;
  end: string;
  minutes: number;
  note: string;
}

export interface TimeReportBilledRow {
  date: string;
  project: string;
  kind: string;
  label: string;
  minutes: number;
}

export interface TimeReportInput {
  weekKey: string;
  weekDays: string[];
  tracking: TimeReportTrackingRow[];
  billed: TimeReportBilledRow[];
}

const INK: [number, number, number] = [20, 24, 31];
const MUTED: [number, number, number] = [100, 109, 120];
const BLUE: [number, number, number] = [31, 95, 139];
const GREEN: [number, number, number] = [47, 125, 85];
const LIGHT: [number, number, number] = [244, 246, 248];

function lastTableY(doc: jsPDF, fallback: number) {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || fallback;
}

function minutesLabel(minutes: number) {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')} h`;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

export function createTimeReportPdf({ weekKey, weekDays, tracking, billed }: TimeReportInput) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const trackedTotal = tracking.reduce((sum, row) => sum + row.minutes, 0);
  const billedTotal = billed.reduce((sum, row) => sum + row.minutes, 0);
  const projectNames = Array.from(new Set([...tracking.map((row) => row.project), ...billed.map((row) => row.project)])).sort((a, b) => a.localeCompare(b, 'de'));

  doc.setFillColor(...INK);
  doc.rect(0, 0, pageWidth, 42, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PROJEKTZENTRALE  |  ZEITBERICHT', margin, 13);
  doc.setFontSize(23);
  doc.text(`Kalenderwoche ${weekKey.replace(/^\d{4}-/, '')}`, margin, 25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(205, 211, 219);
  doc.text(`${dateLabel(weekDays[0])} - ${dateLabel(weekDays[weekDays.length - 1])}`, margin, 33);
  doc.text(`Erstellt am ${new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`, pageWidth - margin, 33, { align: 'right' });

  const cards = [
    { label: 'GETRACKTE ZEIT', value: minutesLabel(trackedTotal), color: BLUE },
    { label: 'ABGERECHNETE ZEIT', value: minutesLabel(billedTotal), color: GREEN },
    { label: 'PROJEKTE', value: String(projectNames.length), color: INK },
  ];
  cards.forEach((card, index) => {
    const gap = 4;
    const width = (contentWidth - gap * 2) / 3;
    const x = margin + index * (width + gap);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(x, 49, width, 25, 2, 2, 'F');
    doc.setFillColor(...card.color);
    doc.rect(x, 49, 2, 25, 'F');
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(card.label, x + 6, 58);
    doc.setTextColor(...INK);
    doc.setFontSize(16);
    doc.text(card.value, x + 6, 68);
  });

  const projectSummary = projectNames.map((project) => {
    const tracked = tracking.filter((row) => row.project === project).reduce((sum, row) => sum + row.minutes, 0);
    const invoiced = billed.filter((row) => row.project === project).reduce((sum, row) => sum + row.minutes, 0);
    return [project, minutesLabel(tracked), minutesLabel(invoiced), minutesLabel(tracked + invoiced)];
  });

  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Management-Uebersicht', margin, 85);
  autoTable(doc, {
    startY: 90,
    margin: { left: margin, right: margin },
    head: [['Projekt', 'Getrackt', 'Abgerechnet', 'Gesamtvolumen']],
    body: projectSummary.length ? projectSummary : [['Keine Zeitdaten in dieser KW', '0 min', '0 min', '0 min']],
    theme: 'plain',
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
    bodyStyles: { textColor: INK, fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: { 0: { cellWidth: 83 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
  });

  let y = lastTableY(doc, 90) + 10;
  const dailyRows = weekDays.map((date) => {
    const tracked = tracking.filter((row) => row.date === date).reduce((sum, row) => sum + row.minutes, 0);
    const invoiced = billed.filter((row) => row.date === date).reduce((sum, row) => sum + row.minutes, 0);
    return [new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(new Date(`${date}T12:00:00`)), dateLabel(date), minutesLabel(tracked), minutesLabel(invoiced)];
  });
  doc.setFontSize(13);
  doc.text('Tagesverteilung', margin, y);
  autoTable(doc, {
    startY: y + 5,
    margin: { left: margin, right: margin },
    head: [['Tag', 'Datum', 'Getrackt', 'Abgerechnet']],
    body: dailyRows,
    theme: 'grid',
    styles: { lineColor: [222, 226, 230], lineWidth: 0.15, fontSize: 8, cellPadding: 2.6 },
    headStyles: { fillColor: [232, 236, 240], textColor: INK, fontStyle: 'bold' },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
  });

  y = lastTableY(doc, y) + 12;
  if (y > 245) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Detaillierte Trackingbuchungen', margin, y);
  autoTable(doc, {
    startY: y + 5,
    margin: { left: margin, right: margin, bottom: 15 },
    head: [['Datum / Zeit', 'Projekt', 'Zuordnung / Notiz', 'Dauer']],
    body: tracking.length ? tracking.slice().sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`)).map((row) => [`${dateLabel(row.date)}\n${row.start} - ${row.end}`, row.project, `${row.assignment}${row.note ? `\n${row.note}` : ''}`, minutesLabel(row.minutes)]) : [['-', '-', 'Keine Trackingbuchungen', '0 min']],
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [241, 247, 251] },
    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 38 }, 2: { cellWidth: 92 }, 3: { cellWidth: 20, halign: 'right', fontStyle: 'bold' } },
  });

  y = lastTableY(doc, 20) + 12;
  if (y > 245) { doc.addPage(); y = 20; }
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Detaillierte Abrechnungszeiten', margin, y);
  autoTable(doc, {
    startY: y + 5,
    margin: { left: margin, right: margin, bottom: 15 },
    head: [['Datum', 'Projekt', 'Typ', 'Position', 'Dauer']],
    body: billed.length ? billed.slice().sort((a, b) => a.date.localeCompare(b.date)).map((row) => [dateLabel(row.date), row.project, row.kind, row.label, minutesLabel(row.minutes)]) : [['-', '-', '-', 'Keine abgerechneten Zeiten', '0 min']],
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [241, 248, 244] },
    columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 38 }, 2: { cellWidth: 27 }, 3: { cellWidth: 70 }, 4: { cellWidth: 20, halign: 'right', fontStyle: 'bold' } },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(220, 224, 228);
    doc.line(margin, 285, pageWidth - margin, 285);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Projektzentrale | ${weekKey}`, margin, 290);
    doc.text(`Seite ${page} von ${pageCount}`, pageWidth - margin, 290, { align: 'right' });
  }

  return doc;
}

export function exportTimeReportPdf(input: TimeReportInput) {
  createTimeReportPdf(input).save(`zeitbericht-${input.weekKey}.pdf`);
}
