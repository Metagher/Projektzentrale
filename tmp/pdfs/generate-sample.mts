import { mkdir, writeFile } from 'node:fs/promises';
import { createTimeReportPdf } from '../../src/lib/timeReportPdf.ts';

const weekDays = ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'];
const projects = ['Reiter', 'Albert Schiller', 'Biofino'];
const tracking = Array.from({ length: 24 }, (_, index) => ({
  date: weekDays[index % 5],
  project: projects[index % projects.length],
  assignment: index % 3 === 0 ? 'Projektmanagement' : index % 3 === 1 ? 'Konzeption und Abstimmung' : 'Umsetzung',
  start: `${String(8 + Math.floor((index % 6) / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`,
  end: `${String(9 + Math.floor((index % 6) / 2)).padStart(2, '0')}:${index % 2 ? '15' : '00'}`,
  minutes: index % 2 ? 45 : 60,
  note: index % 4 === 0 ? 'Vorbereitung und Abstimmung mit dem Projektteam' : '',
}));
const billed = Array.from({ length: 12 }, (_, index) => ({
  date: weekDays[index % 5],
  project: projects[index % projects.length],
  kind: index % 2 ? 'Kommunikation' : 'Aufgabe',
  label: index % 2 ? 'Kundenabstimmung und Ergebnisprotokoll' : 'Fachliche Bearbeitung des Arbeitspakets',
  minutes: index % 2 ? 30 : 60,
}));

const doc = createTimeReportPdf({ weekKey: '2026-KW35', weekDays, tracking, billed });
await mkdir('output/pdf', { recursive: true });
await writeFile('output/pdf/zeitbericht-muster-2026-KW35.pdf', Buffer.from(doc.output('arraybuffer')));
