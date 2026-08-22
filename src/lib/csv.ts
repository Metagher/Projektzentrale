import Papa from 'papaparse';
import { CSV_COLUMNS } from './constants';
import { migratePrio } from './migrations';
import { defLevel, todayStr } from './format';
import { useDataStore } from '../store/dataStore';
import type { Comm, Contact, DocData, DocEntryValue, DocSectionDef, Milestone, Project, ProjectDocumentationArea, ProjectStatusEntry, ProjectTyp, Task, TimeEntry, UpdateEntry } from '../types/entities';

type CsvRow = Record<string, string | number | undefined>;

function splitList(v: string | undefined): string[] {
  return (v || '').split(';').map((s) => s.trim()).filter(Boolean);
}

function parseTaskHistory(value: string | number | undefined): Task['verlauf'] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function importedTaskStand(row: CsvRow): string {
  const current = String(row.AktuellerStand || '');
  if (current) return current;
  const description = String(row.Beschreibung || '');
  const notes = String(row.Notiz || '');
  if (description && notes) return `<h3>Beschreibung</h3>${description}<h3>Interne Notizen</h3>${notes}`;
  return description || notes;
}

export function downloadTextFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime + ';charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function buildExportCsv(): Promise<string> {
  const { projects, docDefs, ensureProjectData, timeEntries } = useDataStore.getState();
  const rows: CsvRow[] = [];

  (docDefs || []).forEach((d, i) => {
    rows.push({ Typ: 'oberpunkt', Id: d.id, Titel: d.title, Level: defLevel(d.level), Reihenfolge: i + 1 });
  });

  for (const p of projects || []) {
    const data = await ensureProjectData(p.id);
    rows.push({
      Typ: 'projekt',
      ProjektId: p.id,
      Id: p.id,
      Titel: p.name,
      Kunde: p.kunde || '',
      ProjektTyp: p.typ || '',
      Status: p.status || '',
      Beschreibung: p.beschreibung || '',
      ErstelltAm: p.createdAt || '',
      AusgeblendeteOberpunkte: ((data.doc._hidden as string[] | undefined) || []).join(';'),
      AktuelleVersion: p.aktuelleVersion || '',
      Reihenfolge: p.sortIndex ?? 0,
      SchnellwahlAusgeblendet: p.quickbarHidden ? 'ja' : 'nein',
    });
    data.contacts.forEach((c) => {
      rows.push({ Typ: 'kontakt', ProjektId: p.id, Id: c.id, Titel: c.name, Rolle: c.rolle || '', Telefon: c.telefon || '', Email: c.email || '', Notiz: c.notiz || '' });
    });
    data.comms.forEach((c) => {
      rows.push({
        Typ: 'kommunikation', ProjektId: p.id, Id: c.id, Datum: c.datum || '', Kanal: c.kanal || '',
        KontaktId: c.kontaktId || '', Betreff: c.betreff || '', Notiz: c.notiz || '',
        AFN: (c.afns || []).join(';'), VerknuepfteAufgabenIds: (c.taskIds || []).join(';'), Teilprojekt: c.teilprojekt || '',
      });
    });
    (docDefs || []).forEach((def) => {
      const entry = data.doc[def.id];
      if (entry && !Array.isArray(entry) && (entry.content || entry.updatedAt || (entry.afns && entry.afns.length))) {
        rows.push({ Typ: 'dokuinhalt', ProjektId: p.id, OberpunktId: def.id, Inhalt: entry.content || '', AktualisiertAm: entry.updatedAt || '', AFN: (entry.afns || []).join(';') });
      }
    });
    const currentState = data.doc._currentProjectState as DocEntryValue | undefined;
    if (currentState && (currentState.content || currentState.updatedAt || currentState.afns?.length)) {
      rows.push({ Typ: 'projektstand', ProjektId: p.id, Inhalt: currentState.content || '', AktualisiertAm: currentState.updatedAt || '', AFN: (currentState.afns || []).join(';') });
    }
    const documentationAreas = (data.doc._documentationAreas as ProjectDocumentationArea[] | undefined) || [];
    documentationAreas.forEach((area) => rows.push({ Typ: 'dokumentationsbereich', ProjektId: p.id, Id: area.id, Titel: area.name, Inhalt: area.current.content, AktualisiertAm: area.current.updatedAt || '', AFN: area.current.afns.join(';') }));
    const statusHistory = (data.doc._statusHistory as ProjectStatusEntry[] | undefined) || [];
    statusHistory.forEach((entry) => rows.push({ Typ: 'projektstandverlauf', ProjektId: p.id, Id: entry.id, Titel: entry.titel, Datum: entry.datum, Inhalt: entry.content, AFN: entry.afns.join(';'), ErstelltAm: entry.createdAt, AktualisiertAm: entry.updatedAt, BereichId: entry.bereichId || 'general' }));
    data.tasks.forEach((t) => {
      rows.push({
        Typ: 'aufgabe', ProjektId: p.id, Id: t.id, Titel: t.titel, Datum: t.faelligAm || '', Prioritaet: t.prioritaet || '', Farbe: t.farbe || '', TagesSortierung: t.tagesSortierung ?? 999,
        Status: t.status || '', KontaktId: t.kontaktId || '', Anforderung: t.anforderung || '', AktuellerStand: t.aktuellerStand || '', Verlauf: JSON.stringify(t.verlauf || []), ErstelltAm: t.erstelltAm || '',
        AbgeschlossenAm: t.abgeschlossenAm || '', AFN: (t.afns || []).join(';'), WartetAuf: t.wartetAuf || '',
        Nr: t.nr || '', VerknuepfteKommIds: (t.commIds || []).join(';'), Teilprojekt: t.teilprojekt || '',
      });
    });
    data.timeline.forEach((m) => {
      rows.push({ Typ: 'meilenstein', ProjektId: p.id, Id: m.id, Titel: m.titel, Datum: m.datum || '', Status: m.status || '', Notiz: m.notiz || '' });
    });
    (data.updates || []).forEach((u) => {
      rows.push({ Typ: 'update', ProjektId: p.id, Id: u.id, Titel: u.titel || '', Datum: u.datum || '', Revision: u.revision || '', Beschreibung: u.beschreibung || '', AFN: (u.afns || []).join(';') });
    });
    timeEntries.filter((entry) => entry.projectId === p.id).forEach((entry) => rows.push({ Typ: 'zeit', ProjektId: p.id, Id: entry.id, AufgabeId: entry.taskId || '', Start: entry.startedAt, Ende: entry.endedAt, DauerMinuten: entry.durationMinutes, Notiz: entry.note, ErstelltAm: entry.createdAt }));
  }

  return Papa.unparse({ fields: CSV_COLUMNS as unknown as string[], data: rows });
}

export async function exportAllDataToCsv(): Promise<void> {
  const csv = await buildExportCsv();
  downloadTextFile(csv, `projektzentrale-export-${todayStr()}.csv`, 'text/csv');
}

export interface ParsedImport {
  projects: Project[];
  docDefs: DocSectionDef[];
  perProject: Record<
    string,
    { contacts: Contact[]; comms: Comm[]; doc: DocData; tasks: Task[]; timeline: Milestone[]; updates: UpdateEntry[] }
  >;
  timeEntries: TimeEntry[];
}

export function parseImportCsv(text: string): { ok: true; data: ParsedImport } | { ok: false; error: string } {
  const parsed = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true });
  if (parsed.errors && parsed.errors.length) {
    return { ok: false, error: 'Die CSV-Datei konnte nicht gelesen werden. Bitte prüfe das Format (am besten eine zuvor exportierte Datei verwenden).' };
  }
  const rows = parsed.data;
  if (!rows.length) {
    return { ok: false, error: 'Die Datei enthält keine Daten.' };
  }

  const docDefs: DocSectionDef[] = rows
    .filter((r) => r.Typ === 'oberpunkt')
    .sort((a, b) => (parseInt(String(a.Reihenfolge)) || 0) - (parseInt(String(b.Reihenfolge)) || 0))
    .map((r) => ({ id: String(r.Id), title: String(r.Titel || ''), level: defLevel(parseInt(String(r.Level)) || 1) }));

  const hiddenByProject: Record<string, string[]> = {};
  const projects: Project[] = rows
    .filter((r) => r.Typ === 'projekt')
    .map((r, i) => {
      hiddenByProject[String(r.Id)] = splitList(r.AusgeblendeteOberpunkte as string);
      return {
        id: String(r.Id),
        name: String(r.Titel || '(ohne Namen)'),
        kunde: String(r.Kunde || ''),
        typ: (r.ProjektTyp as ProjectTyp) || 'Bestandskunde',
        status: (r.Status as Project['status']) || 'aktiv',
        beschreibung: String(r.Beschreibung || ''),
        createdAt: String(r.ErstelltAm || new Date().toISOString()),
        aktuelleVersion: String(r.AktuelleVersion || ''),
        sortIndex: r.Reihenfolge !== undefined && r.Reihenfolge !== '' ? parseInt(String(r.Reihenfolge)) || 0 : i,
        quickbarHidden: String(r.SchnellwahlAusgeblendet || '').toLowerCase() === 'ja',
      };
    });

  const perProject: ParsedImport['perProject'] = {};
  const timeEntries: TimeEntry[] = [];
  for (const p of projects) {
    perProject[p.id] = { contacts: [], comms: [], doc: {}, tasks: [], timeline: [], updates: [] };
  }

  rows
    .filter((r) => r.Typ === 'kontakt')
    .forEach((r) => {
      const pid = String(r.ProjektId);
      if (!perProject[pid]) return;
      perProject[pid].contacts.push({ id: String(r.Id), name: String(r.Titel || ''), rolle: String(r.Rolle || ''), telefon: String(r.Telefon || ''), email: String(r.Email || ''), notiz: String(r.Notiz || '') });
    });

  rows
    .filter((r) => r.Typ === 'kommunikation')
    .forEach((r) => {
      const pid = String(r.ProjektId);
      if (!perProject[pid]) return;
      perProject[pid].comms.push({
        id: String(r.Id), datum: String(r.Datum || ''), kanal: (r.Kanal as Comm['kanal']) || 'Sonstiges',
        kontaktId: String(r.KontaktId || ''), betreff: String(r.Betreff || ''), notiz: String(r.Notiz || ''),
        afns: splitList(r.AFN as string), taskIds: splitList(r.VerknuepfteAufgabenIds as string), teilprojekt: String(r.Teilprojekt || ''),
      });
    });

  rows
    .filter((r) => r.Typ === 'dokuinhalt')
    .forEach((r) => {
      const pid = String(r.ProjektId);
      if (!perProject[pid]) return;
      perProject[pid].doc[String(r.OberpunktId)] = {
        content: String(r.Inhalt || ''),
        updatedAt: (r.AktualisiertAm as string) || null,
        afns: splitList(r.AFN as string),
      };
    });

  rows.filter((r) => r.Typ === 'projektstand').forEach((r) => {
    const pid = String(r.ProjektId);
    if (!perProject[pid]) return;
    perProject[pid].doc._currentProjectState = { content: String(r.Inhalt || ''), updatedAt: (r.AktualisiertAm as string) || null, afns: splitList(r.AFN as string) };
  });
  rows.filter((r) => r.Typ === 'dokumentationsbereich').forEach((r) => {
    const pid = String(r.ProjektId);
    if (!perProject[pid]) return;
    const areas = (perProject[pid].doc._documentationAreas as ProjectDocumentationArea[] | undefined) || [];
    areas.push({ id: String(r.Id), name: String(r.Titel || ''), current: { content: String(r.Inhalt || ''), updatedAt: (r.AktualisiertAm as string) || null, afns: splitList(r.AFN as string) } });
    perProject[pid].doc._documentationAreas = areas;
  });
  rows.filter((r) => r.Typ === 'projektstandverlauf').forEach((r) => {
    const pid = String(r.ProjektId);
    if (!perProject[pid]) return;
    const history = (perProject[pid].doc._statusHistory as ProjectStatusEntry[] | undefined) || [];
    history.push({ id: String(r.Id), titel: String(r.Titel || ''), datum: String(r.Datum || ''), content: String(r.Inhalt || ''), afns: splitList(r.AFN as string), createdAt: String(r.ErstelltAm || ''), updatedAt: String(r.AktualisiertAm || ''), bereichId: String(r.BereichId || 'general') });
    perProject[pid].doc._statusHistory = history;
  });

  rows
    .filter((r) => r.Typ === 'aufgabe')
    .forEach((r) => {
      const pid = String(r.ProjektId);
      if (!perProject[pid]) return;
      const nrRaw = r.Nr !== undefined && r.Nr !== '' ? parseInt(String(r.Nr)) : NaN;
      perProject[pid].tasks.push({
        id: String(r.Id), titel: String(r.Titel || ''), faelligAm: String(r.Datum || ''),
        prioritaet: migratePrio(r.Prioritaet as string), farbe: (r.Farbe as Task['farbe']) || '', status: (r.Status as Task['status']) || 'offen',
        kontaktId: String(r.KontaktId || ''), anforderung: String(r.Anforderung || ''), aktuellerStand: importedTaskStand(r),
        erstelltAm: (r.ErstelltAm as string) || '', abgeschlossenAm: (r.AbgeschlossenAm as string) || null,
        afns: splitList(r.AFN as string), wartetAuf: String(r.WartetAuf || ''), verlauf: parseTaskHistory(r.Verlauf),
        nr: Number.isFinite(nrRaw) ? nrRaw : 0, tagesSortierung: Number(r.TagesSortierung) || 999, commIds: splitList(r.VerknuepfteKommIds as string),
        teilprojekt: String(r.Teilprojekt || ''),
        doku: false, dokuErledigt: false,
      });
    });

  rows
    .filter((r) => r.Typ === 'meilenstein')
    .forEach((r) => {
      const pid = String(r.ProjektId);
      if (!perProject[pid]) return;
      perProject[pid].timeline.push({ id: String(r.Id), titel: String(r.Titel || ''), datum: String(r.Datum || ''), status: (r.Status as Milestone['status']) || 'geplant', notiz: String(r.Notiz || '') });
    });

  rows
    .filter((r) => r.Typ === 'update')
    .forEach((r) => {
      const pid = String(r.ProjektId);
      if (!perProject[pid]) return;
      perProject[pid].updates.push({ id: String(r.Id), titel: String(r.Titel || ''), datum: String(r.Datum || ''), revision: String(r.Revision || ''), beschreibung: String(r.Beschreibung || ''), afns: splitList(r.AFN as string) });
    });

  rows.filter((r) => r.Typ === 'zeit').forEach((r) => {
    const durationMinutes = Number(r.DauerMinuten) || 0;
    if (durationMinutes <= 0) return;
    timeEntries.push({ id: String(r.Id), projectId: String(r.ProjektId), taskId: r.AufgabeId ? String(r.AufgabeId) : null, startedAt: String(r.Start || ''), endedAt: String(r.Ende || ''), durationMinutes, note: String(r.Notiz || ''), createdAt: String(r.ErstelltAm || r.Ende || new Date().toISOString()) });
  });

  for (const p of projects) {
    perProject[p.id].doc._hidden = hiddenByProject[p.id] || [];
  }

  return { ok: true, data: { projects, docDefs, perProject, timeEntries } };
}
