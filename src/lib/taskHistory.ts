import { fmtDate, uid } from './format';
import type { Task, TaskColor, TaskHistoryEntry } from '../types/entities';
import type { TaskColorLabels } from './taskColors';

interface TrackedFields {
  titel: string;
  status: string;
  farbe?: TaskColor | '';
  faelligAm: string;
  wartetAuf: string;
}

/** Vergleicht die für den Verlauf relevanten Felder und erzeugt kurze, lesbare Änderungszeilen. Nur die wichtigsten Felder werden geloggt, damit die Historie übersichtlich bleibt. */
export function buildTaskHistoryEntries(previous: Task, next: TrackedFields, colorLabels: TaskColorLabels): TaskHistoryEntry[] {
  const timestamp = new Date().toISOString();
  const entries: TaskHistoryEntry[] = [];
  const add = (text: string) => entries.push({ id: uid(), timestamp, text });

  if (previous.titel !== next.titel) add(`Titel geändert: „${previous.titel}“ → „${next.titel}“`);
  if (previous.status !== next.status) add(`Status: ${previous.status} → ${next.status}`);

  const prevFarbe = previous.farbe || '';
  const nextFarbe = next.farbe || '';
  if (prevFarbe !== nextFarbe) {
    const from = prevFarbe ? colorLabels[prevFarbe] : 'keine';
    const to = nextFarbe ? colorLabels[nextFarbe] : 'keine';
    add(`Farbmarkierung: ${from} → ${to}`);
  }

  if (previous.faelligAm !== next.faelligAm) {
    const from = previous.faelligAm ? fmtDate(previous.faelligAm) : '–';
    const to = next.faelligAm ? fmtDate(next.faelligAm) : '–';
    add(`Fällig am: ${from} → ${to}`);
  }

  if (next.status === 'wartet' && previous.wartetAuf !== next.wartetAuf && next.wartetAuf) {
    add(`Wartet auf: ${next.wartetAuf}`);
  }

  return entries;
}
