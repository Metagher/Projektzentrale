import { fmtDate, hasEchtlauf, htmlToPlainText, todayStr, truncateText, waitingDurationLabel } from './format';
import { computeDocLabels } from './docOutline';
import { useDataStore, type DashboardData } from '../store/dataStore';
import type { DocEntryValue, Project, ProjectCache, ProjectDocumentationArea, ProjectStatusEntry } from '../types/entities';
import { linkedContactIds } from './contacts';

export function buildDailyBriefingContext(dashboardData: DashboardData | null): string {
  const lines: string[] = [];
  lines.push(`Heutiges Datum: ${fmtDate(todayStr())} (${todayStr()})`);
  const tasks = dashboardData?.openTasks || [];
  if (tasks.length) {
    lines.push('Offene Aufgaben (alle Projekte, aktiv zu bearbeiten):');
    tasks.forEach((t) => {
      const overdue = t.faelligAm && t.faelligAm < todayStr();
      const desc = htmlToPlainText(t.aktuellerStand || t.anforderung);
      lines.push(
        `- [${t.projectName}] ${t.titel} | Fällig: ${t.faelligAm ? fmtDate(t.faelligAm) : 'kein Datum'}${t.termine?.length ? ` | Termine: ${t.termine.map(fmtDate).join(', ')}` : ''}${overdue ? ' (ÜBERFÄLLIG)' : ''}${desc ? ' — ' + desc : ''}`,
      );
    });
  } else {
    lines.push('Keine offenen Aufgaben.');
  }
  const waiting = dashboardData?.waitingTasks || [];
  if (waiting.length) {
    lines.push('Aufgaben, die BLOCKIERT sind (der Nutzer wartet auf jemand anderen, kann selbst gerade nichts tun):');
    waiting.forEach((t) => {
      lines.push(
        `- [${t.projectName}] ${t.titel} | wartet auf: ${t.wartetAuf || 'unbekannt'}${t.wartetSeit ? ` | Wartet seit: ${fmtDate(t.wartetSeit)} (${waitingDurationLabel(t.wartetSeit)})` : ''}${t.faelligAm ? ' | Fällig: ' + fmtDate(t.faelligAm) : ''}`,
      );
    });
  }
  const milestones = dashboardData?.upcomingMilestones || [];
  if (milestones.length) {
    lines.push('Anstehende Echtlauf-Meilensteine:');
    milestones.forEach((m) => {
      lines.push(`- [${m.projectName}] ${m.titel} | Status: ${m.status} | Termin: ${fmtDate(m.datum)}`);
    });
  }
  return truncateText(lines.join('\n'), 60000);
}

export function buildProjectContextBlock(p: Project, data: ProjectCache, labels: Record<string, string>): string {
  const docDefs = useDataStore.getState().docDefs || [];
  const lines: string[] = [];
  lines.push(`=== Projekt: ${p.name} (Kunde: ${p.kunde || '—'}, Typ: ${p.typ}, Status: ${p.status}) ===`);
  if (p.beschreibung) lines.push('Beschreibung: ' + htmlToPlainText(p.beschreibung));
  if (p.aktuelleVersion) lines.push('Aktuelle Programmversion: ' + p.aktuelleVersion);

  if (data.updates.length) {
    lines.push(`Punkte für das nächste Update (noch nicht ausgerollt, angesammelt seit Version ${p.aktuelleVersion || '—'}):`);
    data.updates
      .slice()
      .sort((a, b) => (a.datum || '').localeCompare(b.datum || ''))
      .forEach((u) => {
        const afnText = u.afns && u.afns.length ? ` [AFN: ${u.afns.join(', ')}]` : '';
        const beschreibungText = htmlToPlainText(u.beschreibung);
        lines.push(`- ${fmtDate(u.datum)} | ${u.titel}${u.revision ? ` (${u.revision})` : ''}${afnText}${beschreibungText ? ': ' + beschreibungText : ''}`);
      });
  }

  if (data.contacts.length) {
    lines.push('Ansprechpartner:');
    data.contacts.forEach((c) => {
      const notizText = htmlToPlainText(c.notiz);
      lines.push(`- ${c.name}${c.rolle ? ` (${c.rolle})` : ''}${c.telefon ? ', Tel: ' + c.telefon : ''}${c.email ? ', Mail: ' + c.email : ''}${notizText ? ' — Notiz: ' + notizText : ''}`);
    });
  }
  if (data.comms.length) {
    lines.push('Kommunikationsverlauf:');
    data.comms
      .slice()
      .sort((a, b) => (a.datum || '').localeCompare(b.datum || ''))
      .forEach((c) => {
        const contacts = data.contacts.filter((contact) => linkedContactIds(c).includes(contact.id));
        const notizText = htmlToPlainText(c.notiz);
        const afnText = c.afns && c.afns.length ? ` [AFN: ${c.afns.join(', ')}]` : '';
        const teilprojektText = c.teilprojekt ? ` [Teilprojekt: ${c.teilprojekt}]` : '';
        lines.push(`- ${fmtDate(c.datum)} | ${c.kanal}${contacts.length ? ' | ' + contacts.map((contact) => contact.name).join(', ') : ''} | ${c.betreff || '(kein Betreff)'}${teilprojektText}${afnText}${notizText ? ': ' + notizText : ''}`);
      });
  }
  const hidden = (data.doc._hidden as string[] | undefined) || [];
  const visibleDefs = docDefs.filter((d) => !hidden.includes(d.id));
  const docLines: string[] = [];
  const documentationAreas = (data.doc._documentationAreas as ProjectDocumentationArea[] | undefined) || [];
  const areaNames = new Map(documentationAreas.map((area) => [area.id, area.name]));
  documentationAreas.forEach((area) => {
    const text = htmlToPlainText(area.current.content);
    if (text) docLines.push(`Bereich ${area.name} – aktueller Stand: ${text}`);
  });
  const currentState = data.doc._currentProjectState as DocEntryValue | undefined;
  const currentStateText = currentState ? htmlToPlainText(currentState.content) : '';
  if (!documentationAreas.length && currentStateText) docLines.push(`Bereich Allgemein – aktueller Stand: ${currentStateText}`);
  const statusHistory = (data.doc._statusHistory as ProjectStatusEntry[] | undefined) || [];
  statusHistory.slice().sort((a, b) => b.datum.localeCompare(a.datum)).forEach((entry) => {
    const text = htmlToPlainText(entry.content);
    docLines.push(`${fmtDate(entry.datum)} – Bereich ${areaNames.get(entry.bereichId || 'general') || 'Allgemein'} – ${entry.titel}${text ? `: ${text}` : ''}`);
  });
  visibleDefs.forEach((d) => {
    const entry = data.doc[d.id];
    const contentText = entry && !Array.isArray(entry) ? htmlToPlainText(entry.content) : '';
    const afnText = entry && !Array.isArray(entry) && entry.afns && entry.afns.length ? ` [AFN: ${entry.afns.join(', ')}]` : '';
    if (contentText) docLines.push(`${labels[d.id] || ''} ${d.title}${afnText}: ${contentText}`);
  });
  if (docLines.length) {
    lines.push('Projektdokumentation:');
    lines.push(...docLines.map((l) => '- ' + l));
  }
  if (data.notes.length) {
    lines.push('Freie Projektnotizen:');
    data.notes.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).forEach((note) => {
      const flags = [note.global ? 'global' : '', note.pinned ? 'angeheftet' : ''].filter(Boolean);
      lines.push(`- ${note.titel}${flags.length ? ` [${flags.join(', ')}]` : ''}: ${note.inhalt}`);
    });
  }
  if (data.tasks.length) {
    lines.push('Aufgaben:');
    data.tasks.forEach((t) => {
      const contacts = data.contacts.filter((contact) => linkedContactIds(t).includes(contact.id));
      const anforderungText = htmlToPlainText(t.anforderung);
      const standText = htmlToPlainText(t.aktuellerStand);
      const verlaufText = (t.verlauf || []).slice().sort((a, b) => b.datum.localeCompare(a.datum)).map((entry) => `${fmtDate(entry.datum)} ${entry.titel}: ${htmlToPlainText(entry.content)}`).join(' | ');
      const afnText = t.afns && t.afns.length ? ` [AFN: ${t.afns.join(', ')}]` : '';
      const wartetText = t.status === 'wartet' && t.wartetAuf ? `, wartet auf: ${t.wartetAuf}${t.wartetSeit ? `, ${waitingDurationLabel(t.wartetSeit)}` : ''}` : '';
      const meetingText = t.naechsteBesprechung ? ' [für nächste Besprechung vorgemerkt]' : '';
      const appointmentText = t.termine?.length ? `, Termine: ${t.termine.map(fmtDate).join(', ')}` : '';
      lines.push(
        `- [${t.status}] ${t.titel}${meetingText}${afnText}${t.faelligAm ? ` (Fällig: ${fmtDate(t.faelligAm)})` : ''}${appointmentText}${wartetText}${contacts.length ? `, Ansprechpartner: ${contacts.map((contact) => contact.name).join(', ')}` : ''}${anforderungText ? ` | Anforderung: ${anforderungText}` : ''}${standText ? ` | Aktueller Stand: ${standText}` : ''}${verlaufText ? ` | Verlauf: ${verlaufText}` : ''}`,
      );
    });
  }
  if (hasEchtlauf(p) && data.timeline.length) {
    lines.push('Echtlauf-Zeitplan:');
    data.timeline.forEach((m) => {
      const notizText = htmlToPlainText(m.notiz);
      lines.push(`- ${fmtDate(m.datum)} | ${m.status} | ${m.titel}${notizText ? ': ' + notizText : ''}`);
    });
  }
  return lines.join('\n');
}

export async function buildAllProjectsContext(): Promise<string> {
  const { projects, docDefs, ensureProjectData } = useDataStore.getState();
  const labels = computeDocLabels(docDefs || []);
  const blocks: string[] = [];
  for (const p of projects || []) {
    const data = await ensureProjectData(p.id);
    blocks.push(buildProjectContextBlock(p, data, labels));
  }
  return truncateText(blocks.join('\n\n'), 180000);
}

export function buildSingleProjectContext(p: Project, data: ProjectCache): string {
  const labels = computeDocLabels(useDataStore.getState().docDefs || []);
  return truncateText(buildProjectContextBlock(p, data, labels), 180000);
}
