import type { Contact, Project } from '../types/entities';
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

/** Namen auf Ansprechpartner-Ids des Projekts abbilden. Nicht gefundene Namen werden stillschweigend
 * übersprungen, statt die ganze Zeile scheitern zu lassen — ein Tippfehler im Namen soll nicht
 * verhindern, dass Aufgabe/Kommunikation sonst wie vorgesehen angelegt wird. */
export function resolveContactIds(contacts: Contact[], names: string[]): string[] {
  const ids: string[] = [];
  for (const name of names) {
    const lower = name.trim().toLocaleLowerCase('de');
    if (!lower) continue;
    const match = contacts.find((c) => c.name.trim().toLocaleLowerCase('de') === lower);
    if (match) ids.push(match.id);
  }
  return ids;
}
