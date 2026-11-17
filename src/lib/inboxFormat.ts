import { CHANNELS, TASK_COLORS, TASK_KATEGORIEN, TASK_PRIO } from './constants';
import type { Kanal, TaskColor, TaskKategorie, TaskPrio, TaskStatus } from '../types/entities';

export type InboxTyp = 'aufgabe' | 'kommunikation' | 'notiz' | 'kontakt' | 'aenderung';
export type AenderungZiel = 'aufgabe' | 'kommunikation' | 'kontakt';

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
  /** @deprecated Einzelner Name — weiter unterstützt, aber kontaktNamen (Array) ist der aktuelle Weg. */
  kontaktName?: string;
  kontaktNamen?: string[];
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

export interface InboxKontaktPayload {
  typ: 'kontakt';
  projekt: string;
  name: string;
  rolle?: string;
  telefon?: string;
  email?: string;
}

export interface InboxAenderungPayload {
  typ: 'aenderung';
  ziel: string;
  projekt: string;
  id: string;
  aenderungen?: Record<string, unknown>;
}

export type InboxPayload =
  | InboxAufgabePayload
  | InboxKommunikationPayload
  | InboxNotizPayload
  | InboxKontaktPayload
  | InboxAenderungPayload;

const TASK_STATUS_VALUES: TaskStatus[] = ['offen', 'in Arbeit', 'wartet', 'erledigt'];
const AENDERUNG_ZIELE: AenderungZiel[] = ['aufgabe', 'kommunikation', 'kontakt'];

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
  if (typ !== 'aufgabe' && typ !== 'kommunikation' && typ !== 'notiz' && typ !== 'kontakt' && typ !== 'aenderung') return null;
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
  kontaktNamen: string[];
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
  if (payload.kontaktNamen !== undefined && !isStringArray(payload.kontaktNamen)) return { ok: false, error: '"kontaktNamen" muss eine Liste von Texten sein.' };
  // kontaktName (Einzelwert, Altformat) + kontaktNamen (Array) zusammenführen, Reihenfolge bleibt erhalten.
  const kontaktNamen = [...(payload.kontaktName ? [payload.kontaktName] : []), ...(payload.kontaktNamen || [])];
  return {
    ok: true,
    value: {
      projekt: payload.projekt.trim(),
      kanal: kanal.value as Kanal,
      inhalt: payload.inhalt,
      datum: payload.datum || '',
      kontaktNamen,
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

export interface ValidatedKontakt {
  projekt: string;
  name: string;
  rolle: string;
  telefon: string;
  email: string;
}

export function validateKontakt(payload: InboxKontaktPayload): ValidationResult<ValidatedKontakt> {
  if (!isNonEmptyString(payload.projekt)) return { ok: false, error: 'Pflichtfeld "projekt" fehlt.' };
  if (!isNonEmptyString(payload.name)) return { ok: false, error: 'Pflichtfeld "name" fehlt.' };
  return {
    ok: true,
    value: {
      projekt: payload.projekt.trim(),
      name: payload.name.trim(),
      rolle: payload.rolle || '',
      telefon: payload.telefon || '',
      email: payload.email || '',
    },
  };
}

export interface ValidatedAenderungBase {
  ziel: AenderungZiel;
  projekt: string;
  id: string;
}

export function validateAenderungBase(payload: InboxAenderungPayload): ValidationResult<ValidatedAenderungBase> {
  const ziel = validateEnum(payload.ziel, AENDERUNG_ZIELE, 'ziel');
  if (!ziel.ok) return ziel;
  if (!ziel.value) return { ok: false, error: 'Pflichtfeld "ziel" fehlt.' };
  if (!isNonEmptyString(payload.projekt)) return { ok: false, error: 'Pflichtfeld "projekt" fehlt.' };
  if (!isNonEmptyString(payload.id)) return { ok: false, error: 'Pflichtfeld "id" fehlt.' };
  if (!payload.aenderungen || typeof payload.aenderungen !== 'object' || Array.isArray(payload.aenderungen)) {
    return { ok: false, error: 'Pflichtfeld "aenderungen" fehlt oder ist kein Objekt.' };
  }
  return { ok: true, value: { ziel: ziel.value, projekt: payload.projekt.trim(), id: payload.id.trim() } };
}

/** Nur die im Objekt tatsächlich vorhandenen Felder werden validiert und übernommen — alles
 * andere bleibt beim Ziel-Eintrag unverändert (Patch-Semantik, keine Defaults). */
export interface AenderungAufgabeFields {
  titel?: string;
  status?: TaskStatus;
  prioritaet?: TaskPrio;
  faelligAm?: string;
  kategorie?: TaskKategorie;
  farbe?: TaskColor | '';
  wartetAuf?: string;
  afns?: string[];
  kontaktNamen?: string[];
  kontaktNamenHinzufuegen?: string[];
  beschreibung?: string;
  doku?: boolean;
}

export function validateAenderungAufgabe(raw: Record<string, unknown>): ValidationResult<AenderungAufgabeFields> {
  const out: AenderungAufgabeFields = {};
  if ('titel' in raw) {
    if (!isNonEmptyString(raw.titel)) return { ok: false, error: '"titel" darf nicht leer sein.' };
    out.titel = raw.titel.trim();
  }
  if ('status' in raw) {
    const r = validateEnum(raw.status, TASK_STATUS_VALUES, 'status');
    if (!r.ok) return r;
    out.status = r.value;
  }
  if ('prioritaet' in raw) {
    const r = validateEnum(raw.prioritaet, TASK_PRIO, 'prioritaet');
    if (!r.ok) return r;
    out.prioritaet = r.value;
  }
  if ('faelligAm' in raw) {
    if (typeof raw.faelligAm !== 'string') return { ok: false, error: '"faelligAm" muss ein Text (YYYY-MM-DD) sein.' };
    out.faelligAm = raw.faelligAm;
  }
  if ('kategorie' in raw) {
    const r = validateEnum(raw.kategorie, TASK_KATEGORIEN, 'kategorie');
    if (!r.ok) return r;
    out.kategorie = r.value;
  }
  if ('farbe' in raw) {
    const r = validateEnum(raw.farbe, TASK_COLORS, 'farbe');
    if (!r.ok) return r;
    out.farbe = r.value || '';
  }
  if ('wartetAuf' in raw) {
    if (typeof raw.wartetAuf !== 'string') return { ok: false, error: '"wartetAuf" muss ein Text sein.' };
    out.wartetAuf = raw.wartetAuf;
  }
  if ('afns' in raw) {
    if (!isStringArray(raw.afns)) return { ok: false, error: '"afns" muss eine Liste von Texten sein.' };
    out.afns = raw.afns;
  }
  if ('kontaktNamen' in raw) {
    if (!isStringArray(raw.kontaktNamen)) return { ok: false, error: '"kontaktNamen" muss eine Liste von Texten sein.' };
    out.kontaktNamen = raw.kontaktNamen;
  }
  if ('kontaktNamenHinzufuegen' in raw) {
    if (!isStringArray(raw.kontaktNamenHinzufuegen)) return { ok: false, error: '"kontaktNamenHinzufuegen" muss eine Liste von Texten sein.' };
    out.kontaktNamenHinzufuegen = raw.kontaktNamenHinzufuegen;
  }
  if ('beschreibung' in raw) {
    if (typeof raw.beschreibung !== 'string') return { ok: false, error: '"beschreibung" muss ein Text sein.' };
    out.beschreibung = raw.beschreibung;
  }
  if ('doku' in raw) {
    if (typeof raw.doku !== 'boolean') return { ok: false, error: '"doku" muss true oder false sein.' };
    out.doku = raw.doku;
  }
  return { ok: true, value: out };
}

export interface AenderungKommunikationFields {
  betreff?: string;
  teilprojekt?: string;
  kanal?: Kanal;
  datum?: string;
  inhalt?: string;
  inhaltAnhaengen?: string;
  kontaktNamen?: string[];
  kontaktNamenHinzufuegen?: string[];
}

export function validateAenderungKommunikation(raw: Record<string, unknown>): ValidationResult<AenderungKommunikationFields> {
  const out: AenderungKommunikationFields = {};
  if ('betreff' in raw) {
    if (!isNonEmptyString(raw.betreff)) return { ok: false, error: '"betreff" darf nicht leer sein.' };
    out.betreff = raw.betreff.trim();
  }
  if ('teilprojekt' in raw) {
    if (typeof raw.teilprojekt !== 'string') return { ok: false, error: '"teilprojekt" muss ein Text sein.' };
    out.teilprojekt = raw.teilprojekt;
  }
  if ('kanal' in raw) {
    const r = validateEnum(raw.kanal, CHANNELS, 'kanal');
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: '"kanal" darf nicht leer sein.' };
    out.kanal = r.value;
  }
  if ('datum' in raw) {
    if (typeof raw.datum !== 'string') return { ok: false, error: '"datum" muss ein Text (YYYY-MM-DD) sein.' };
    out.datum = raw.datum;
  }
  if ('inhalt' in raw) {
    if (typeof raw.inhalt !== 'string') return { ok: false, error: '"inhalt" muss ein Text sein.' };
    out.inhalt = raw.inhalt;
  }
  if ('inhaltAnhaengen' in raw) {
    if (typeof raw.inhaltAnhaengen !== 'string') return { ok: false, error: '"inhaltAnhaengen" muss ein Text sein.' };
    out.inhaltAnhaengen = raw.inhaltAnhaengen;
  }
  if ('kontaktNamen' in raw) {
    if (!isStringArray(raw.kontaktNamen)) return { ok: false, error: '"kontaktNamen" muss eine Liste von Texten sein.' };
    out.kontaktNamen = raw.kontaktNamen;
  }
  if ('kontaktNamenHinzufuegen' in raw) {
    if (!isStringArray(raw.kontaktNamenHinzufuegen)) return { ok: false, error: '"kontaktNamenHinzufuegen" muss eine Liste von Texten sein.' };
    out.kontaktNamenHinzufuegen = raw.kontaktNamenHinzufuegen;
  }
  return { ok: true, value: out };
}

export interface AenderungKontaktFields {
  name?: string;
  rolle?: string;
  telefon?: string;
  email?: string;
}

export function validateAenderungKontakt(raw: Record<string, unknown>): ValidationResult<AenderungKontaktFields> {
  const out: AenderungKontaktFields = {};
  if ('name' in raw) {
    if (!isNonEmptyString(raw.name)) return { ok: false, error: '"name" darf nicht leer sein.' };
    out.name = raw.name.trim();
  }
  if ('rolle' in raw) {
    if (typeof raw.rolle !== 'string') return { ok: false, error: '"rolle" muss ein Text sein.' };
    out.rolle = raw.rolle;
  }
  if ('telefon' in raw) {
    if (typeof raw.telefon !== 'string') return { ok: false, error: '"telefon" muss ein Text sein.' };
    out.telefon = raw.telefon;
  }
  if ('email' in raw) {
    if (typeof raw.email !== 'string') return { ok: false, error: '"email" muss ein Text sein.' };
    out.email = raw.email;
  }
  return { ok: true, value: out };
}
