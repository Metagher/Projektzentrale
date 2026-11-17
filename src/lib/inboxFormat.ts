import { CHANNELS, TASK_COLORS, TASK_KATEGORIEN } from './constants';
import type { Kanal, TaskColor, TaskKategorie, TaskStatus } from '../types/entities';

export type InboxTyp = 'aufgabe' | 'kommunikation' | 'notiz';

export interface InboxAufgabePayload {
  typ: 'aufgabe';
  titel: string;
  projekt: string;
  status?: string;
  faelligAm?: string;
  kategorie?: string;
  farbe?: string;
  wartetAuf?: string;
  afns?: string[];
  kontaktNamen?: string[];
  beschreibung?: string;
  doku?: boolean;
}

export interface InboxKommunikationPayload {
  typ: 'kommunikation';
  projekt: string;
  kanal: string;
  inhalt: string;
  datum?: string;
  kontaktName?: string;
  aufgaben?: string[];
  betreff?: string;
  teilprojekt?: string;
}

export interface InboxNotizPayload {
  typ: 'notiz';
  inhalt: string;
  projekt?: string;
  titel?: string;
}

export type InboxPayload = InboxAufgabePayload | InboxKommunikationPayload | InboxNotizPayload;

const TASK_STATUS_VALUES: TaskStatus[] = ['offen', 'in Arbeit', 'wartet', 'erledigt'];

/**
 * Liest den rohen content-Text einer Posteingang-Zeile als strukturiertes JSON mit erkanntem
 * "typ". Kein gültiges JSON oder kein/unbekanntes "typ"-Feld → null, die Zeile wird dann wie eine
 * reine Textnotiz behandelt (siehe Aufrufer) statt als Fehler markiert — nichts geht verloren.
 */
export function parseInboxPayload(content: string): InboxPayload | null {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return null;
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const typ = (json as Record<string, unknown>).typ;
  if (typ !== 'aufgabe' && typ !== 'kommunikation' && typ !== 'notiz') return null;
  return json as InboxPayload;
}

/** Liefert nur für die Badge-Anzeige einen Typ-Namen, auch wenn die Zeile letztlich als Fehler
 * markiert wurde — best effort, da zu dem Zeitpunkt evtl. nur ein Teil gültig war. */
export function peekInboxTyp(content: string): string {
  try {
    const json = JSON.parse(content) as Record<string, unknown>;
    if (json && typeof json.typ === 'string') return json.typ;
  } catch { /* keine JSON-Struktur erkennbar */ }
  return 'Text';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

function validateEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): ValidationResult<T | undefined> {
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return { ok: true, value: value as T };
  return { ok: false, error: `Ungültiger Wert für "${field}": "${String(value)}" (erlaubt: ${allowed.join(', ')}).` };
}

export interface ValidatedAufgabe {
  titel: string;
  projekt: string;
  status: TaskStatus;
  faelligAm: string;
  kategorie?: TaskKategorie;
  farbe: TaskColor | '';
  wartetAuf: string;
  afns: string[];
  kontaktNamen: string[];
  beschreibung: string;
  doku: boolean;
}

export function validateAufgabe(payload: InboxAufgabePayload): ValidationResult<ValidatedAufgabe> {
  if (!isNonEmptyString(payload.titel)) return { ok: false, error: 'Pflichtfeld "titel" fehlt.' };
  if (!isNonEmptyString(payload.projekt)) return { ok: false, error: 'Pflichtfeld "projekt" fehlt.' };
  const status = validateEnum(payload.status, TASK_STATUS_VALUES, 'status');
  if (!status.ok) return status;
  const farbe = validateEnum(payload.farbe, TASK_COLORS, 'farbe');
  if (!farbe.ok) return farbe;
  const kategorie = validateEnum(payload.kategorie, TASK_KATEGORIEN, 'kategorie');
  if (!kategorie.ok) return kategorie;
  if (payload.afns !== undefined && !isStringArray(payload.afns)) return { ok: false, error: '"afns" muss eine Liste von Texten sein.' };
  if (payload.kontaktNamen !== undefined && !isStringArray(payload.kontaktNamen)) return { ok: false, error: '"kontaktNamen" muss eine Liste von Texten sein.' };
  return {
    ok: true,
    value: {
      titel: payload.titel.trim(),
      projekt: payload.projekt.trim(),
      status: status.value || 'offen',
      faelligAm: payload.faelligAm || '',
      kategorie: kategorie.value,
      farbe: farbe.value || '',
      wartetAuf: payload.wartetAuf || '',
      afns: payload.afns || [],
      kontaktNamen: payload.kontaktNamen || [],
      beschreibung: payload.beschreibung || '',
      doku: !!payload.doku,
    },
  };
}

export interface ValidatedKommunikation {
  projekt: string;
  kanal: Kanal;
  inhalt: string;
  datum: string;
  kontaktName: string;
  aufgaben: string[];
  betreff: string;
  teilprojekt: string;
}

export function validateKommunikation(payload: InboxKommunikationPayload): ValidationResult<ValidatedKommunikation> {
  if (!isNonEmptyString(payload.projekt)) return { ok: false, error: 'Pflichtfeld "projekt" fehlt.' };
  if (!isNonEmptyString(payload.kanal)) return { ok: false, error: 'Pflichtfeld "kanal" fehlt.' };
  if (!isNonEmptyString(payload.inhalt)) return { ok: false, error: 'Pflichtfeld "inhalt" fehlt.' };
  const kanal = validateEnum(payload.kanal, CHANNELS, 'kanal');
  if (!kanal.ok) return kanal;
  if (payload.aufgaben !== undefined && !isStringArray(payload.aufgaben)) return { ok: false, error: '"aufgaben" muss eine Liste von Texten sein.' };
  return {
    ok: true,
    value: {
      projekt: payload.projekt.trim(),
      kanal: kanal.value as Kanal,
      inhalt: payload.inhalt,
      datum: payload.datum || '',
      kontaktName: payload.kontaktName || '',
      aufgaben: (payload.aufgaben || []).filter(isNonEmptyString),
      betreff: payload.betreff?.trim() || '',
      teilprojekt: payload.teilprojekt?.trim() || '',
    },
  };
}

export interface ValidatedNotiz {
  inhalt: string;
  projekt: string;
  titel: string;
}

export function validateNotiz(payload: InboxNotizPayload): ValidationResult<ValidatedNotiz> {
  if (!isNonEmptyString(payload.inhalt)) return { ok: false, error: 'Pflichtfeld "inhalt" fehlt.' };
  return {
    ok: true,
    value: {
      inhalt: payload.inhalt,
      projekt: payload.projekt?.trim() || '',
      titel: payload.titel?.trim() || '',
    },
  };
}
