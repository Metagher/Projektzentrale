import { TASK_COLORS } from './constants';
import type { TaskColorLabels } from './taskColors';
import type { Contact, Project, Subproject, TaskColor } from '../types/entities';
import type { ValidationResult } from './inboxFormat';

/** Projektauflösung: zuerst exakte Id, dann Name oder Kunde (ohne Groß-/Kleinschreibung).
 * Kein oder mehr als ein Treffer → Fehler statt Raten. */
export function resolveProject(projects: Project[], query: string): ValidationResult<Project> {
  const trimmed = query.trim();
  const byId = projects.find((p) => p.id === trimmed);
  if (byId) return { ok: true, value: byId };
  const lower = trimmed.toLocaleLowerCase('de');
  const matches = projects.filter((p) => p.name.trim().toLocaleLowerCase('de') === lower || p.kunde.trim().toLocaleLowerCase('de') === lower);
  if (matches.length === 1) return { ok: true, value: matches[0] };
  if (matches.length === 0) return { ok: false, error: `Projekt "${query}" nicht gefunden.` };
  return { ok: false, error: `Projekt "${query}" ist nicht eindeutig (${matches.length} Treffer).` };
}

export interface ContactMatch {
  id: string;
  name: string;
}

export interface ContactResolution {
  /** Aufgelöste Kontakte, dedupliziert, in Reihenfolge der ersten Nennung. */
  matched: ContactMatch[];
  /** Eine Meldung pro Name, der nicht oder mehrdeutig aufgelöst werden konnte — wird NIE
   * stillschweigend verworfen, sondern dem Aufrufer als Warnung gemeldet (siehe inboxStore). */
  warnings: string[];
}

function nameTokens(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts[parts.length - 1] || '' };
}

/** Namen auf Ansprechpartner des Projekts abbilden: zuerst exakter Name (ohne Groß-/Kleinschreibung,
 * getrimmt); besteht der gesuchte Name nur aus einem Wort und es gibt dafür genau einen Treffer über
 * Vor- oder Nachname der Kontakte, zählt das auch. Kein oder mehr als ein Treffer wird NICHT
 * stillschweigend übersprungen, sondern als Warnung zurückgegeben — der Aufrufer legt den Eintrag
 * trotzdem an, zeigt die Warnung aber sichtbar an. */
export function resolveContacts(contacts: Contact[], names: string[]): ContactResolution {
  const matched: ContactMatch[] = [];
  const warnings: string[] = [];
  const seenIds = new Set<string>();

  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const lower = name.toLocaleLowerCase('de');

    const exact = contacts.filter((c) => c.name.trim().toLocaleLowerCase('de') === lower);
    if (exact.length === 1) {
      addMatch(exact[0]);
      continue;
    }
    if (exact.length > 1) {
      warnings.push(`Kontakt "${name}" ist nicht eindeutig (${exact.length} Treffer mit exaktem Namen).`);
      continue;
    }

    if (!/\s/.test(name)) {
      const partial = contacts.filter((c) => {
        const { first, last } = nameTokens(c.name);
        return first.toLocaleLowerCase('de') === lower || last.toLocaleLowerCase('de') === lower;
      });
      if (partial.length === 1) {
        addMatch(partial[0]);
        continue;
      }
      if (partial.length > 1) {
        warnings.push(`Kontakt "${name}" ist nicht eindeutig (${partial.length} Treffer über Vor-/Nachname).`);
        continue;
      }
    }

    warnings.push(`Kontakt "${name}" wurde nicht gefunden.`);
  }

  function addMatch(contact: Contact) {
    if (seenIds.has(contact.id)) return;
    seenIds.add(contact.id);
    matched.push({ id: contact.id, name: contact.name });
  }

  return { matched, warnings };
}

/** Teilprojekt-Name case-insensitive im Projekt auflösen — kein Treffer liefert den echten,
 * im Projekt hinterlegten Namen leer zurück (kein Fehler, siehe Aufrufer). */
export function resolveSubprojectName(subprojects: Subproject[], query: string): string {
  const lower = query.trim().toLocaleLowerCase('de');
  if (!lower) return '';
  return subprojects.find((sp) => sp.name.trim().toLocaleLowerCase('de') === lower)?.name || '';
}

/** Löst eine Eingabe als Aufgaben-Farbmarkierung auf — entweder der Farbname selbst (z.B.
 * "orange") oder der dafür konfigurierte Begriff (z.B. "Wichtig!", individuell pro Nutzer
 * einstellbar — jede Farbe steht für einen eigenen Status). Leer löst zu "" (keine Farbe) auf.
 * Mehrdeutigkeit (zwei Farben mit demselben Begriff) oder kein Treffer ist ein Fehler statt
 * Raten; die Fehlermeldung listet alle aktuell gültigen Farben samt ihrer Begriffe. */
export function resolveTaskColor(input: string, labels: TaskColorLabels): ValidationResult<TaskColor | ''> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, value: '' };
  const lower = trimmed.toLocaleLowerCase('de');

  const byKey = TASK_COLORS.find((color) => color === lower);
  if (byKey) return { ok: true, value: byKey };

  const byLabel = TASK_COLORS.filter((color) => labels[color].trim().toLocaleLowerCase('de') === lower);
  if (byLabel.length === 1) return { ok: true, value: byLabel[0] };
  if (byLabel.length > 1) {
    return { ok: false, error: `Farbe/Begriff "${input}" ist nicht eindeutig (mehrere Farben haben denselben Begriff "${trimmed}").` };
  }

  const options = TASK_COLORS.map((color) => `${color} (${labels[color]})`).join(', ');
  return { ok: false, error: `Unbekannte Farbe oder Begriff "${input}" (erlaubt: ${options}).` };
}
