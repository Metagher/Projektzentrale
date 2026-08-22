import type { Kanal, MilestoneStatus, TaskColor, TaskPrio, TaskStatus } from '../types/entities';

export const DEFAULT_DOC_SECTIONS = [
  { id: 'ausgangslage', title: 'Ausgangslage & Scope', level: 1 as const },
  { id: 'technik', title: 'Technische Architektur & Schnittstellen', level: 1 as const },
  { id: 'offene_punkte', title: 'Offene Punkte & Risiken', level: 1 as const },
  { id: 'entscheidungen', title: 'Entscheidungen & Vereinbarungen', level: 1 as const },
  { id: 'status', title: 'Status & nächste Schritte', level: 1 as const },
];

export const CHANNELS: Kanal[] = ['Teams', 'Telefon', 'E-Mail', 'Vor Ort', 'Sonstiges'];
export const TASK_STATUS: TaskStatus[] = ['offen', 'in Arbeit', 'wartet', 'erledigt'];
export const TASK_PRIO: TaskPrio[] = ['must', 'should', 'could', 'wont'];
export const TASK_COLORS: TaskColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'];
export const TASK_COLOR_LABELS: Record<TaskColor, string> = {
  red: 'Rot', orange: 'Orange', yellow: 'Gelb', green: 'Grün', blue: 'Blau', purple: 'Violett', gray: 'Grau',
};
export const PRIO_LABELS: Record<TaskPrio, string> = {
  must: 'Must have',
  should: 'Should have',
  could: 'Could have',
  wont: "Won't have",
};
export function prioLabel(key: TaskPrio | string): string {
  return PRIO_LABELS[key as TaskPrio] || key;
}
export const PRIO_ABBR: Record<TaskPrio, string> = { must: 'M', should: 'S', could: 'C', wont: 'W' };
export function prioAbbr(key: TaskPrio | string): string {
  return '[' + (PRIO_ABBR[key as TaskPrio] || '?') + ']';
}
export const MILESTONE_STATUS: MilestoneStatus[] = ['geplant', 'in Arbeit', 'erledigt'];

export const CSV_COLUMNS = [
  'Typ', 'ProjektId', 'Id', 'Titel', 'Kunde', 'ProjektTyp', 'Status', 'Beschreibung',
  'ErstelltAm', 'AusgeblendeteOberpunkte', 'Level', 'Reihenfolge', 'Rolle', 'Telefon',
  'Email', 'Notiz', 'Datum', 'Kanal', 'KontaktId', 'Betreff', 'OberpunktId', 'Inhalt',
  'AktualisiertAm', 'Prioritaet', 'AbgeschlossenAm', 'AFN', 'WartetAuf', 'Revision',
  'AktuelleVersion', 'Nr', 'Farbe', 'TagesSortierung', 'VerknuepfteAufgabenIds', 'VerknuepfteKommIds',
  'BereichId', 'Anforderung', 'AktuellerStand', 'Verlauf', 'Teilprojekt',
  'AufgabeId', 'Start', 'Ende', 'DauerMinuten',
] as const;
