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
import type { ProjectCache, Task, TaskColor, TaskProgressEntry, TaskStatus } from '../../types/entities';

export default function ProjectNewTaskForm({ projectId, data }: { projectId: string; data: ProjectCache }) {
  const createTask = useDataStore((s) => s.createTask);
  const waitingOptions = useDataStore((s) => s.waitingOptions);
  const syncCommLinksForTask = useDataStore((s) => s.syncCommLinksForTask);
  const setShowNewTaskForm = useProjectUiStore((s) => s.setShowNewTaskForm);
  const alert = useModalStore((s) => s.alert);

  const [titel, setTitel] = useState('');
  const [activeSection, setActiveSection] = useState<'task' | 'basics'>('task');
  const [faelligAm, setFaelligAm] = useState('');
  const [farbe, setFarbe] = useState<TaskColor | ''>('');
  const [status, setStatus] = useState<TaskStatus>('offen');
  const [kontaktId, setKontaktId] = useState('');
  const [wartetAuf, setWartetAuf] = useState('');
  const [doku, setDoku] = useState(false);
  const [anforderung, setAnforderung] = useState('');
  const [aktuellerStand, setAktuellerStand] = useState('');
  const [verlauf, setVerlauf] = useState<TaskProgressEntry[]>([]);
  const [afns, setAfns] = useState<string[]>([]);
  const [commIds, setCommIds] = useState<string[]>([]);
  const [fremdverknuepfung, setFremdverknuepfung] = useState('');
  const [ticketsystemVerknuepfung, setTicketsystemVerknuepfung] = useState('');
  const [teilprojekt, setTeilprojekt] = useState('');
  const teilprojekte = Array.from(new Set(data.tasks.map((task) => task.teilprojekt?.trim()).filter((value): value is string => !!value)))
    .sort((a, b) => a.localeCompare(b, 'de'));

  async function handleSave() {
    const trimmed = titel.trim();
    if (!trimmed) {
      setActiveSection('task');
      await alert('Bitte einen Titel angeben.');
      return;
    }
    if (status === 'wartet' && !wartetAuf) { setActiveSection('task'); await alert('Bitte auswählen, auf wen gewartet wird.'); return; }
    const partial: Omit<Task, 'id' | 'nr' | 'erstelltAm' | 'abgeschlossenAm'> = {
      titel: trimmed,
      faelligAm,
      farbe,
      status,
      wartetAuf: status === 'wartet' ? wartetAuf.trim() : '',
      kontaktId,
      anforderung,
      aktuellerStand,
      verlauf,
      afns,
      commIds,
      fremdverknuepfung: fremdverknuepfung.trim(),
      ticketsystemVerknuepfung: ticketsystemVerknuepfung.trim(),
      teilprojekt: teilprojekt.trim(),
      doku,
      dokuErledigt: false,
    };
    const newTaskId = await createTask(projectId, partial);
    if (commIds.length) await syncCommLinksForTask(projectId, newTaskId, [], commIds);
    setShowNewTaskForm(false);
  }

  return (
    <div className="card">
      <div className="top-row" style={{ marginBottom: 10 }}>
        <h3 style={{ fontSize: 15 }}>Neue Aufgabe</h3>
        <button className="icon-btn" onClick={() => setShowNewTaskForm(false)}>
          Einklappen
        </button>
      </div>
      <nav className="task-form-tabs"><button type="button" className={activeSection === 'task' ? 'active' : ''} onClick={() => setActiveSection('task')}>Aufgabe</button><button type="button" className={activeSection === 'basics' ? 'active' : ''} onClick={() => setActiveSection('basics')}>Grunddaten</button></nav>
      {activeSection === 'task' ? <div className="task-form-section">
      <div className="field task-title-field"><label>Titel</label><input value={titel} onChange={(e) => setTitel(e.target.value)} /></div>
      <div className="task-primary-controls"><div className="task-primary-control"><label>Status</label><TaskStatusButtons value={status} onChange={setStatus} /><label>Farbmarkierung</label><TaskColorSelect value={farbe} onChange={setFarbe} /></div><div className="task-primary-control"><label>Fällig am</label><div className="task-date-control"><input type="date" value={faelligAm} onChange={(e) => setFaelligAm(e.target.value)} /><TaskDateQuickSelect value={faelligAm} onChange={setFaelligAm} /></div></div></div>
      {status === 'wartet' && (
        <div className="field wartet-auf-field">
          <label>Wartet auf (Person)</label>
          <select value={wartetAuf} onChange={(e) => setWartetAuf(e.target.value)}><option value="">Bitte auswählen</option>{waitingOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
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
      <div className="field"><label>Ansprechpartner</label><select className="contact-select" value={kontaktId} onChange={(e) => setKontaktId(e.target.value)}><option value="">— kein Ansprechpartner —</option>{data.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.rolle ? ` (${c.rolle})` : ''}</option>)}</select></div>
      <div className="field"><label>Teilprojekt</label><input value={teilprojekt} onChange={(e) => setTeilprojekt(e.target.value)} list={`teilprojekte-${projectId}`} placeholder="Teilprojekt neu eingeben oder auswählen" /><datalist id={`teilprojekte-${projectId}`}>{teilprojekte.map((name) => <option key={name} value={name} />)}</datalist></div>
      <div className="doku-check-field"><label><input type="checkbox" checked={doku} onChange={(e) => setDoku(e.target.checked)} /> Für Dokumentation vormerken</label></div>
      </div>
      <div className="field">
        <label>AFN-Nummer(n)</label>
        <AfnChipsField value={afns} onChange={setAfns} />
      </div>
      <div className="field"><label>Verknüpfte Kommunikation</label><LinkChipsField ids={commIds} items={data.comms} labelFn={commLinkLabel} placeholder="— Eintrag auswählen —" onChange={setCommIds} /></div>
      </div>}
      <div className="btn-row">
        <button className="btn" onClick={handleSave}>
          Hinzufügen
        </button>
      </div>
    </div>
  );
}
