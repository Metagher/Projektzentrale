import { useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import { toExternalHref } from '../../lib/externalLinks';
import type { ProjectDocumentationArea, ProjectStatusEntry } from '../../types/entities';

interface Finding {
  id: string;
  project: string;
  area: string;
  problem: string;
  detail: string;
  actionLabel: 'Löschen' | 'Bereinigen';
  run: () => Promise<void>;
}

const TASK_STATUSES = new Set(['offen', 'in Arbeit', 'wartet', 'erledigt']);
const MILESTONE_STATUSES = new Set(['geplant', 'in Arbeit', 'erledigt']);
const CHANNELS = new Set(['Teams', 'Telefon', 'E-Mail', 'Vor Ort', 'Sonstiges']);

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === value;
}

export default function DataValidationSettings() {
  const confirm = useModalStore((state) => state.confirm);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  async function scan() {
    setScanning(true);
    const store = useDataStore.getState();
    const projects = store.projects || [];
    const next: Finding[] = [];
    const add = (finding: Omit<Finding, 'id'>) => next.push({ ...finding, id: `${finding.area}-${next.length}` });

    for (const project of projects) {
      const data = await store.ensureProjectData(project.id);
      const prefix = { project: project.name || '(Projekt ohne Namen)' };
      if (!project.name?.trim()) add({ ...prefix, area: 'Projekt', problem: 'Projektname fehlt', detail: `Projekt-ID: ${project.id}`, actionLabel: 'Löschen', run: () => store.deleteProject(project.id) });

      const contactIds = new Set(data.contacts.map((item) => item.id));
      const taskIds = new Set(data.tasks.map((item) => item.id));
      const commIds = new Set(data.comms.map((item) => item.id));

      data.contacts.forEach((contact) => {
        if (!contact.name?.trim()) add({ ...prefix, area: 'Ansprechpartner', problem: 'Name fehlt', detail: contact.email || contact.id, actionLabel: 'Löschen', run: () => store.deleteContact(project.id, contact.id) });
      });

      data.tasks.forEach((task) => {
        const invalidWaitingSince = !!task.wartetSeit && !validDate(task.wartetSeit);
        const invalid = !task.titel?.trim() || !TASK_STATUSES.has(task.status) || (!!task.faelligAm && !validDate(task.faelligAm)) || invalidWaitingSince || (task.status === 'wartet' && !task.wartetAuf?.trim());
        if (invalid) add({ ...prefix, area: 'Aufgabe', problem: !task.titel?.trim() ? 'Titel fehlt' : !TASK_STATUSES.has(task.status) ? `Ungültiger Status: ${task.status}` : task.status === 'wartet' && !task.wartetAuf?.trim() ? 'Wartet auf ohne Person' : invalidWaitingSince ? `Ungültiges Wartedatum: ${task.wartetSeit}` : `Ungültiges Datum: ${task.faelligAm}`, detail: `#${task.nr || '—'} · ${task.titel || task.id}`, actionLabel: 'Löschen', run: () => store.deleteTask(project.id, task.id) });
        if (task.kontaktId && !contactIds.has(task.kontaktId)) add({ ...prefix, area: 'Aufgabe', problem: 'Ansprechpartner existiert nicht mehr', detail: task.titel, actionLabel: 'Bereinigen', run: () => store.saveTask(project.id, { ...task, kontaktId: '' }) });
        const validCommIds = (task.commIds || []).filter((id) => commIds.has(id));
        if (validCommIds.length !== (task.commIds || []).length) add({ ...prefix, area: 'Aufgabe', problem: 'Verknüpfte Kommunikation existiert nicht mehr', detail: task.titel, actionLabel: 'Bereinigen', run: () => store.saveTask(project.id, { ...task, commIds: validCommIds }) });
        if (task.fremdverknuepfung?.trim() && !toExternalHref(task.fremdverknuepfung)) add({ ...prefix, area: 'Aufgabe', problem: 'Ungültige Fremdverknüpfung', detail: task.titel, actionLabel: 'Bereinigen', run: () => store.saveTask(project.id, { ...task, fremdverknuepfung: '' }) });
        if (task.ticketsystemVerknuepfung?.trim() && !toExternalHref(task.ticketsystemVerknuepfung)) add({ ...prefix, area: 'Aufgabe', problem: 'Ungültige Ticketsystem-Verknüpfung', detail: task.titel, actionLabel: 'Bereinigen', run: () => store.saveTask(project.id, { ...task, ticketsystemVerknuepfung: '' }) });
        const validHistory = (task.verlauf || []).filter((entry) => entry.titel?.trim() && validDate(entry.datum));
        if (validHistory.length !== (task.verlauf || []).length) add({ ...prefix, area: 'Aufgabe', problem: 'Ungültiger Verlaufseintrag', detail: task.titel, actionLabel: 'Bereinigen', run: () => store.saveTask(project.id, { ...task, verlauf: validHistory }) });
      });

      data.comms.forEach((comm) => {
        const invalid = !validDate(comm.datum) || !CHANNELS.has(comm.kanal);
        if (invalid) add({ ...prefix, area: 'Kommunikation', problem: !validDate(comm.datum) ? `Ungültiges Datum: ${comm.datum || 'leer'}` : `Ungültiger Kanal: ${comm.kanal}`, detail: comm.betreff || comm.id, actionLabel: 'Löschen', run: () => store.deleteComm(project.id, comm.id) });
        if (comm.kontaktId && !contactIds.has(comm.kontaktId)) add({ ...prefix, area: 'Kommunikation', problem: 'Ansprechpartner existiert nicht mehr', detail: comm.betreff || comm.id, actionLabel: 'Bereinigen', run: () => store.saveComm(project.id, { ...comm, kontaktId: '' }) });
        const validTaskIds = (comm.taskIds || []).filter((id) => taskIds.has(id));
        if (validTaskIds.length !== (comm.taskIds || []).length) add({ ...prefix, area: 'Kommunikation', problem: 'Verknüpfte Aufgabe existiert nicht mehr', detail: comm.betreff || comm.id, actionLabel: 'Bereinigen', run: () => store.saveComm(project.id, { ...comm, taskIds: validTaskIds }) });
      });

      data.timeline.forEach((entry) => {
        if (!entry.titel?.trim() || !validDate(entry.datum) || !MILESTONE_STATUSES.has(entry.status)) add({ ...prefix, area: 'Zeitplan', problem: !entry.titel?.trim() ? 'Titel fehlt' : !validDate(entry.datum) ? `Ungültiges Datum: ${entry.datum || 'leer'}` : `Ungültiger Status: ${entry.status}`, detail: entry.titel || entry.id, actionLabel: 'Löschen', run: () => store.deleteMilestone(project.id, entry.id) });
      });
      data.updates.forEach((entry) => {
        if (!entry.titel?.trim() || !validDate(entry.datum)) add({ ...prefix, area: 'Update', problem: !entry.titel?.trim() ? 'Titel fehlt' : `Ungültiges Datum: ${entry.datum || 'leer'}`, detail: entry.titel || entry.id, actionLabel: 'Löschen', run: () => store.deleteUpdateEntry(project.id, entry.id) });
      });
      const history = (data.doc._statusHistory as ProjectStatusEntry[] | undefined) || [];
      const documentationAreas = (data.doc._documentationAreas as ProjectDocumentationArea[] | undefined) || [];
      const areaIds = new Set(documentationAreas.map((area) => area.id));
      documentationAreas.forEach((area) => {
        if (!area.name?.trim()) add({ ...prefix, area: 'Dokumentation', problem: 'Dokumentationsbereich ohne Namen', detail: area.id, actionLabel: 'Löschen', run: () => store.saveProjectDocumentationAreas(project.id, documentationAreas.filter((item) => item.id !== area.id)) });
      });
      history.forEach((entry) => {
        if (!entry.titel?.trim() || !validDate(entry.datum)) add({ ...prefix, area: 'Dokumentation', problem: !entry.titel?.trim() ? 'Titel fehlt' : `Ungültiges Datum: ${entry.datum || 'leer'}`, detail: entry.titel || entry.id, actionLabel: 'Löschen', run: () => store.deleteProjectStatusEntry(project.id, entry.id) });
        else if (documentationAreas.length && !areaIds.has(entry.bereichId || 'general')) add({ ...prefix, area: 'Dokumentation', problem: 'Zugehöriger Dokumentationsbereich existiert nicht mehr', detail: entry.titel, actionLabel: 'Bereinigen', run: () => store.saveProjectStatusEntry(project.id, { ...entry, bereichId: documentationAreas[0].id }) });
      });
    }
    setFindings(next);
    setScanning(false);
  }

  async function apply(finding: Finding) {
    const sure = await confirm(`${finding.area} „${finding.detail}“: ${finding.problem}. Wirklich ${finding.actionLabel.toLowerCase()}?`);
    if (!sure) return;
    setWorkingId(finding.id);
    await finding.run();
    setWorkingId(null);
    await scan();
  }

  return <section id="validation-settings" className="settings-validation">
    <div className="section-title">Datenvalidierung</div>
    <div className="card validation-summary"><div><h3>Datenbestand prüfen</h3><p>Findet unvollständige Datensätze, ungültige Datums- und Statuswerte sowie Verknüpfungen auf bereits gelöschte Einträge.</p></div><button className="btn" disabled={scanning} onClick={scan}>{scanning ? 'Prüfung läuft…' : 'Jetzt prüfen'}</button></div>
    {findings?.length === 0 && <div className="validation-ok">✓ Keine Datenfehler gefunden.</div>}
    {!!findings?.length && <div className="validation-results"><div className="validation-count">{findings.length} Auffälligkeit{findings.length === 1 ? '' : 'en'} gefunden</div>{findings.map((finding) => <div className="validation-row" key={finding.id}><span className="validation-area">{finding.area}</span><div><strong>{finding.problem}</strong><small>{finding.project} · {finding.detail}</small></div><button className={finding.actionLabel === 'Löschen' ? 'btn danger small' : 'btn secondary small'} disabled={workingId === finding.id} onClick={() => apply(finding)}>{workingId === finding.id ? 'Bitte warten…' : finding.actionLabel}</button></div>)}</div>}
  </section>;
}
