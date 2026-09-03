import { euroInputToCents } from './money';
import type { Abrechnung } from '../types/entities';

/**
 * Import des historischen Excel-/Access-Exports (Semikolon-getrennt, deutsches Zahlenformat,
 * Spalten u. a. LD, Freigabe, RD, Gjahr, Gmonat, Kunde, Art, Stunden, Wert, Prov, VK60_NR, Bemerkung).
 * IDs werden aus dem Zeileninhalt gebildet, damit ein wiederholter Import derselben Datei
 * bestehende Einträge aktualisiert statt sie zu duplizieren.
 */

const REQUIRED_COLUMNS = ['LD', 'Kunde', 'Art', 'Stunden', 'Wert'];

export interface AbrechnungCsvResult {
  rows: Abrechnung[];
  arten: string[];
  kunden: string[];
  skipped: number;
}

/**
 * Filtert Platzhalter wie "-" heraus, die im Altexport "kein Wert" statt einer echten
 * Belegnummer bedeuten (sonst würden alle so markierten Zeilen fälschlich unter einer
 * gemeinsamen Belegnummer "-" zusammengefasst). Auch für händisch mit "-" befüllte Felder.
 */
export function meaningfulBelegNr(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && /[0-9a-zA-Z]/.test(trimmed) ? trimmed : undefined;
}

function hashString(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function parseMoneyCents(raw: string): number {
  const cleaned = raw.replace(/[^0-9,.-]/g, '').trim();
  return cleaned ? euroInputToCents(cleaned) : 0;
}

function parseHoursToMinutes(raw: string): number {
  const parsed = Number(raw.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 60) : 0;
}

function parseGermanDate(raw: string): string | undefined {
  const match = raw.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return undefined;
  const [, d, m, y] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function parseGehaltsMonat(gjahr: string, gmonat: string): string | undefined {
  const jahr = gjahr.trim();
  const monat = Number(gmonat.trim());
  if (!/^\d{4}$/.test(jahr) || !Number.isFinite(monat) || monat < 1 || monat > 12) return undefined;
  return `${jahr}-${String(monat).padStart(2, '0')}`;
}

/** Parst den Rohtext des CSV-Exports. Wirft bei fehlenden Pflichtspalten. */
export function parseAbrechnungCsv(text: string): AbrechnungCsvResult {
  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { rows: [], arten: [], kunden: [], skipped: 0 };

  const headers = lines[0].split(';').map((h) => h.trim());
  const missing = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
  if (missing.length) throw new Error(`Fehlende Spalten im CSV: ${missing.join(', ')}`);
  const col = (name: string) => headers.indexOf(name);

  const rows: Abrechnung[] = [];
  const arten = new Set<string>();
  const kunden = new Set<string>();
  const occurrences = new Map<string, number>();
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cells = line.split(';');
    const get = (name: string) => (cells[col(name)] ?? '').trim();

    const ldRaw = get('LD');
    const kundeRaw = get('Kunde');
    const artRaw = get('Art');
    const datum = parseGermanDate(ldRaw);
    if (!datum || !kundeRaw || !artRaw) { skipped++; continue; }

    const occurrence = occurrences.get(line) || 0;
    occurrences.set(line, occurrence + 1);
    const id = `csv-${hashString(line)}-${occurrence}`;

    const tageVorOrtRaw = get('TageVO');
    const tageVorOrt = tageVorOrtRaw ? Number(tageVorOrtRaw.replace(',', '.')) : undefined;
    const rksRaw = get('RKs');
    const fahrzeitconversionRaw = get('Fahrzeitconversion');

    const entry: Abrechnung = {
      id,
      kunde: kundeRaw,
      datum,
      art: artRaw,
      minutes: parseHoursToMinutes(get('Stunden')),
      wertCents: parseMoneyCents(get('Wert')),
      provisionCents: parseMoneyCents(get('Prov')),
      freigegeben: get('Freigabe').toLowerCase() === 'x',
      rechnungsdatum: parseGermanDate(get('RD')),
      gehaltsMonat: parseGehaltsMonat(get('Gjahr'), get('Gmonat')),
      belegNr: meaningfulBelegNr(get('VK60_NR')),
      bemerkung: get('Bemerkung') || undefined,
      tageVorOrt: Number.isFinite(tageVorOrt) && tageVorOrt ? tageVorOrt : undefined,
      reisekostenCents: rksRaw ? parseMoneyCents(rksRaw) : undefined,
      fahrzeitMinutes: fahrzeitconversionRaw ? parseHoursToMinutes(fahrzeitconversionRaw) : undefined,
      modul: get('ArtMod') || undefined,
      createdAt: new Date().toISOString(),
    };

    rows.push(entry);
    arten.add(artRaw);
    kunden.add(kundeRaw);
  }

  return { rows, arten: Array.from(arten).sort((a, b) => a.localeCompare(b, 'de')), kunden: Array.from(kunden).sort((a, b) => a.localeCompare(b, 'de')), skipped };
}

/** Liest eine Datei robust in Text um: erkennt UTF-8 (inkl. BOM), fällt sonst auf Windows-1252 zurück (üblich bei Excel-Exporten). */
export async function readCsvFileAsText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.slice(3));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
