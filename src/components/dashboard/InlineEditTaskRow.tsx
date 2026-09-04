import { useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import AfnChipsField from '../shared/AfnChipsField';
import TaskColorSelect from '../shared/TaskColorSelect';
import TaskProgressHistoryField from '../shared/TaskProgressHistoryField';
import TaskDateQuickSelect from '../shared/TaskDateQuickSelect';
import TaskStatusButtons from '../shared/TaskStatusButtons';
import TaskWaitingFields from '../shared/TaskWaitingFields';
import TaskDocumentationTargetSelect from '../shared/TaskDocumentationTargetSelect';
import TaskProjectAssignmentField from '../shared/TaskProjectAssignmentField';
import TaskAppointmentsField from '../shared/TaskAppointmentsField';
import { taskDocumentationTarget } from '../../lib/taskDocumentation';
import { todayStr } from '../../lib/format';
import { contactLinkLabel, linkedContactIds } from '../../lib/contacts';
import LinkChipsField from '../shared/LinkChipsField';
import type { TaskWithMeta } from '../../store/dataStore';
import type { TaskColor, TaskDocumentationTarget, TaskProgressEntry, TaskStatus } from '../../types/entities';

interface Props {
  task: TaskWithMeta;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

export default function InlineEditTaskRow({ task, onSave, onCancel, onDelete }: Props) {
  const contacts = useDataStore((s) => s.cache[task.projectId]?.contacts) || [];
  const waitingOptions = useDataStore((s) => s.waitingOptions);
  const saveTask = useDataStore((s) => s.saveTask);
  const deleteTask = useDataStore((s) => s.deleteTask);
  const confirm = useModalStore((s) => s.confirm);
  const alert = useModalStore((s) => s.alert);

  const [titel, setTitel] = useState(task.titel);
  const [activeSection, setActiveSection] = useState<'task' | 'basics'>('task');
  const [farbe, setFarbe] = useState<TaskColor | ''>(task.farbe || '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [faelligAm, setFaelligAm] = useState(task.faelligAm || '');
  const [termine, setTermine] = useState<string[]>(task.termine || []);
  const [kontaktIds, setKontaktIds] = useState<string[]>(linkedContactIds(task));
  const [dokuZiel, setDokuZiel] = useState<TaskDocumentationTarget>(taskDocumentationTarget(task));
  const [dokuZielChanged, setDokuZielChanged] = useState(false);
  const [naechsteBesprechung, setNaechsteBesprechung] = useState(!!task.naechsteBesprechung);
  const [wartetAuf, setWartetAuf] = useState(task.wartetAuf || '');
  const [wartetSeit, setWartetSeit] = useState(task.wartetSeit || '');
  const [verlauf, setVerlauf] = useState<TaskProgressEntry[]>(task.verlauf || []);
  const [afns, setAfns] = useState(task.afns || []);
  const [fremdverknuepfung, setFremdverknuepfung] = useState(task.fremdverknuepfung || '');
  const [ticketsystemVerknuepfung, setTicketsystemVerknuepfung] = useState(task.ticketsystemVerknuepfung || '');
  const [teilprojekt, setTeilprojekt] = useState(task.teilprojekt || '');
  const [projectIds, setProjectIds] = useState<string[]>(task.projectIds?.length ? task.projectIds : [task.projectId]);
  const teilprojekte = Array.from(new Set((useDataStore((s) => s.cache[task.projectId]?.tasks) || []).map((item) => item.teilprojekt?.trim()).filter((value): value is string => !!value)))
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
    const { projectId: _pid, projectName: _pn, ...base } = task;
    void _pid;
    void _pn;
    await saveTask(task.projectId, {
      ...base,
      titel: trimmed,
      farbe,
      status,
      wartetAuf: status === 'wartet' ? wartetAuf.trim() : '',
      wartetSeit: status === 'wartet' ? wartetSeit : '',
      faelligAm,
      termine,
      kontaktId: kontaktIds[0] || '',
      kontaktIds,
      verlauf,
      afns,
      fremdverknuepfung: fremdverknuepfung.trim(),
      ticketsystemVerknuepfung: ticketsystemVerknuepfung.trim(),
      teilprojekt: teilprojekt.trim(),
      abgeschlossenAm,
      doku: dokuZiel !== '',
      dokuZiel,
      dokuErledigt: dokuZielChanged ? false : task.dokuErledigt,
      naechsteBesprechung,
      projectIds,
    });
    onSave();
  }

  async function handleDelete() {
    const sure = await confirm('Diese Aufgabe löschen?');
    if (!sure) return;
    await deleteTask(task.projectId, task.id);
    onDelete();
  }

  return (
    <div className="list-item task-edit-row">
      <div className="meta mono" style={{ marginBottom: 6 }}>
        <span className="task-nr">{task.nr || '—'}</span>
        {task.projectName}
      </div>
      <nav className="task-form-tabs"><button type="button" className={activeSection === 'task' ? 'active' : ''} onClick={() => setActiveSection('task')}>Aufgabe</button><button type="button" className={activeSection === 'basics' ? 'active' : ''} onClick={() => setActiveSection('basics')}>Grunddaten</button></nav>
      {activeSection === 'task' ? <div className="task-form-section">
      <div className="field task-title-field"><label>Titel</label><input type="text" value={titel} onChange={(e) => setTitel(e.target.value)} /></div>
      <div className="task-primary-controls"><div className="task-primary-control"><label>Status</label><TaskStatusButtons value={status} onChange={(value) => { setStatus(value); if (value === 'wartet' && !wartetSeit) setWartetSeit(todayStr()); }} /><label>Farbmarkierung</label><TaskColorSelect value={farbe} onChange={setFarbe} /></div><div className="task-primary-control"><label>Fällig am</label><div className="task-date-control"><input type="date" value={faelligAm} onChange={(e) => setFaelligAm(e.target.value)} /><TaskDateQuickSelect value={faelligAm} onChange={setFaelligAm} /></div></div></div>
      {status === 'wartet' && (
        <TaskWaitingFields waitingFor={wartetAuf} waitingSince={wartetSeit} waitingOptions={waitingOptions} onWaitingForChange={setWartetAuf} onWaitingSinceChange={setWartetSeit} />
      )}
      <TaskProgressHistoryField value={verlauf} onChange={setVerlauf} />
      </div> : <div className="task-form-section">
      <TaskAppointmentsField value={termine} onChange={setTermine} />
      <div className="task-basics-grid">
        <div className="field"><label>Ticket</label><input type="url" value={ticketsystemVerknuepfung} onChange={(e) => setTicketsystemVerknuepfung(e.target.value)} placeholder="https://ticketsystem/…" /></div>
        <div className="field"><label>Fremdverknüpfung</label><input type="url" value={fremdverknuepfung} onChange={(e) => setFremdverknuepfung(e.target.value)} placeholder="https://…" /></div>
        <div className="field"><label>Ansprechpartner</label><LinkChipsField ids={kontaktIds} items={contacts} labelFn={contactLinkLabel} placeholder="— Ansprechpartner auswählen —" onChange={setKontaktIds} /></div>
        <div className="field"><label>Teilprojekt</label><input value={teilprojekt} onChange={(e) => setTeilprojekt(e.target.value)} list={`teilprojekte-dashboard-${task.projectId}`} placeholder="Teilprojekt neu eingeben oder auswählen" /><datalist id={`teilprojekte-dashboard-${task.projectId}`}>{teilprojekte.map((name) => <option key={name} value={name} />)}</datalist></div>
        <TaskDocumentationTargetSelect value={dokuZiel} onChange={(value) => { if (value !== dokuZiel) setDokuZielChanged(true); setDokuZiel(value); }} />
        <label className="doku-check-field"><input type="checkbox" checked={naechsteBesprechung} onChange={(e) => setNaechsteBesprechung(e.target.checked)} /> Für nächste Besprechung vormerken</label>
      </div><div className="field"><label>AFN-Nummer(n)</label><AfnChipsField value={afns} onChange={setAfns} /></div><TaskProjectAssignmentField value={projectIds} onChange={setProjectIds} /></div>}
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn small" onClick={handleSave}>
          Speichern
        </button>
        <button className="btn secondary small" onClick={onCancel}>
          Abbrechen
        </button>
        <button className="btn danger small" style={{ marginLeft: 'auto' }} onClick={handleDelete}>
          Löschen
        </button>
      </div>
    </div>
  );
}
