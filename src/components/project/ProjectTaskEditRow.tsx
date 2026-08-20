import { useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useProjectUiStore } from '../../store/projectUiStore';
import { useModalStore } from '../../store/modalStore';
import { commLinkLabel } from '../../lib/format';
import RtfField from '../shared/RtfField';
import AfnChipsField from '../shared/AfnChipsField';
import LinkChipsField from '../shared/LinkChipsField';
import TaskColorSelect from '../shared/TaskColorSelect';
import TaskProgressHistoryField from '../shared/TaskProgressHistoryField';
import TaskDateQuickSelect from '../shared/TaskDateQuickSelect';
import TaskStatusButtons from '../shared/TaskStatusButtons';
import type { Contact, ProjectCache, Task, TaskColor, TaskProgressEntry, TaskStatus } from '../../types/entities';

interface Props {
  task: Task;
  projectId: string;
  data: ProjectCache;
  contacts: Contact[];
}

export default function ProjectTaskEditRow({ task, projectId, data, contacts }: Props) {
  const saveTask = useDataStore((s) => s.saveTask);
  const waitingOptions = useDataStore((s) => s.waitingOptions);
  const deleteTask = useDataStore((s) => s.deleteTask);
  const syncCommLinksForTask = useDataStore((s) => s.syncCommLinksForTask);
  const { setEditingTaskId } = useProjectUiStore();
  const confirm = useModalStore((s) => s.confirm);
  const alert = useModalStore((s) => s.alert);

  const [titel, setTitel] = useState(task.titel);
  const [activeSection, setActiveSection] = useState<'task' | 'basics'>('task');
  const [farbe, setFarbe] = useState<TaskColor | ''>(task.farbe || '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [faelligAm, setFaelligAm] = useState(task.faelligAm || '');
  const [kontaktId, setKontaktId] = useState(task.kontaktId || '');
  const [doku, setDoku] = useState(task.doku);
  const [wartetAuf, setWartetAuf] = useState(task.wartetAuf || '');
  const [anforderung, setAnforderung] = useState(task.anforderung || '');
  const [aktuellerStand, setAktuellerStand] = useState(task.aktuellerStand || '');
  const [verlauf, setVerlauf] = useState<TaskProgressEntry[]>(task.verlauf || []);
  const [afns, setAfns] = useState(task.afns || []);
  const [commIds, setCommIds] = useState(task.commIds || []);
  const [fremdverknuepfung, setFremdverknuepfung] = useState(task.fremdverknuepfung || '');
  const [ticketsystemVerknuepfung, setTicketsystemVerknuepfung] = useState(task.ticketsystemVerknuepfung || '');
  const [teilprojekt, setTeilprojekt] = useState(task.teilprojekt || '');
  const teilprojekte = Array.from(new Set(data.tasks.map((item) => item.teilprojekt?.trim()).filter((value): value is string => !!value)))
    .sort((a, b) => a.localeCompare(b, 'de'));

  async function handleSave() {
    const trimmed = titel.trim();
    if (!trimmed) {
      setActiveSection('task');
      await alert('Bitte einen Titel angeben.');
      return;
    }
    if (status === 'wartet' && !wartetAuf) { setActiveSection('task'); await alert('Bitte auswählen, auf wen gewartet wird.'); return; }
    let abgeschlossenAm = task.abgeschlossenAm || null;
    if (status === 'erledigt' && task.status !== 'erledigt') abgeschlossenAm = new Date().toISOString();
    else if (status !== 'erledigt' && task.status === 'erledigt') abgeschlossenAm = null;
    const prevCommIds = task.commIds || [];
    await saveTask(projectId, {
      ...task,
      titel: trimmed,
      farbe,
      status,
      wartetAuf: status === 'wartet' ? wartetAuf.trim() : '',
      faelligAm,
      kontaktId,
      anforderung,
      aktuellerStand,
      verlauf,
      afns,
      commIds,
      fremdverknuepfung: fremdverknuepfung.trim(),
      ticketsystemVerknuepfung: ticketsystemVerknuepfung.trim(),
      teilprojekt: teilprojekt.trim(),
      abgeschlossenAm,
      doku,
    });
    await syncCommLinksForTask(projectId, task.id, prevCommIds, commIds);
    setEditingTaskId(null);
  }

  async function handleDelete() {
    const sure = await confirm('Diese Aufgabe löschen?');
    if (!sure) return;
    await deleteTask(projectId, task.id);
    await syncCommLinksForTask(projectId, task.id, task.commIds || [], []);
    setEditingTaskId(null);
  }

  return (
    <div className="list-item task-edit-row">
      <div className="meta mono" style={{ marginBottom: 6 }}>
        <span className="task-nr">{task.nr || '—'}</span>
      </div>
      <nav className="task-form-tabs"><button type="button" className={activeSection === 'task' ? 'active' : ''} onClick={() => setActiveSection('task')}>Aufgabe</button><button type="button" className={activeSection === 'basics' ? 'active' : ''} onClick={() => setActiveSection('basics')}>Grunddaten</button></nav>
      {activeSection === 'task' ? <div className="task-form-section">
      <div className="field task-title-field"><label>Titel</label><input type="text" value={titel} onChange={(e) => setTitel(e.target.value)} /></div>
      <div className="task-primary-controls"><div className="task-primary-control"><label>Status</label><TaskStatusButtons value={status} onChange={setStatus} /><label>Farbmarkierung</label><TaskColorSelect value={farbe} onChange={setFarbe} /></div><div className="task-primary-control"><label>Fällig am</label><div className="task-date-control"><input type="date" value={faelligAm} onChange={(e) => setFaelligAm(e.target.value)} /><TaskDateQuickSelect value={faelligAm} onChange={setFaelligAm} /></div></div></div>
      {status === 'wartet' && (
        <div className="field wartet-auf-field">
          <label>Wartet auf (Person)</label>
          <select value={wartetAuf} onChange={(e) => setWartetAuf(e.target.value)}><option value="">Bitte auswählen</option>{wartetAuf && !waitingOptions.includes(wartetAuf) && <option value={wartetAuf}>{wartetAuf} (Bestand)</option>}{waitingOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
        </div>
      )}
      <div className="field">
        <label>Anforderung</label>
        <RtfField value={anforderung} onChange={setAnforderung} title="Anforderung" placeholder="Was wird benötigt und welche Kriterien müssen erfüllt sein?" />
      </div>
      <div className="field">
        <label>Aktueller Stand</label>
        <RtfField value={aktuellerStand} onChange={setAktuellerStand} title="Aktueller Stand" placeholder="Was ist aktuell umgesetzt, offen oder blockiert?" />
      </div>
      <TaskProgressHistoryField value={verlauf} onChange={setVerlauf} />
      </div> : <div className="task-form-section"><div className="task-basics-grid">
        <div className="field"><label>Ticket</label><input type="url" value={ticketsystemVerknuepfung} onChange={(e) => setTicketsystemVerknuepfung(e.target.value)} placeholder="https://ticketsystem/…" /></div>
        <div className="field"><label>Fremdverknüpfung</label><input type="url" value={fremdverknuepfung} onChange={(e) => setFremdverknuepfung(e.target.value)} placeholder="https://…" /></div>
        <div className="field"><label>Ansprechpartner</label><select value={kontaktId} onChange={(e) => setKontaktId(e.target.value)}><option value="">— kein Ansprechpartner —</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.rolle ? ` (${c.rolle})` : ''}</option>)}</select></div>
        <div className="field"><label>Teilprojekt</label><input value={teilprojekt} onChange={(e) => setTeilprojekt(e.target.value)} list={`teilprojekte-edit-${projectId}`} placeholder="Teilprojekt neu eingeben oder auswählen" /><datalist id={`teilprojekte-edit-${projectId}`}>{teilprojekte.map((name) => <option key={name} value={name} />)}</datalist></div>
        <label className="doku-check-field"><input type="checkbox" checked={doku} onChange={(e) => setDoku(e.target.checked)} /> Für Dokumentation vormerken</label>
      </div><div className="field"><label>AFN-Nummer(n)</label><AfnChipsField value={afns} onChange={setAfns} /></div><div className="field"><label>Verknüpfte Kommunikation</label><LinkChipsField ids={commIds} items={data.comms} labelFn={commLinkLabel} placeholder="— Eintrag auswählen —" onChange={setCommIds} /></div></div>}
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn small" onClick={handleSave}>
          Speichern
        </button>
        <button className="btn secondary small" onClick={() => setEditingTaskId(null)}>
          Abbrechen
        </button>
        <button className="btn danger small" style={{ marginLeft: 'auto' }} onClick={handleDelete}>
          Löschen
        </button>
      </div>
    </div>
  );
}
