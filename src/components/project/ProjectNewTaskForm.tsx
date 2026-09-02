import { useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useProjectUiStore } from '../../store/projectUiStore';
import { useModalStore } from '../../store/modalStore';
import { commLinkLabel, todayStr } from '../../lib/format';
import { contactLinkLabel } from '../../lib/contacts';
import RtfField from '../shared/RtfField';
import AfnChipsField from '../shared/AfnChipsField';
import LinkChipsField from '../shared/LinkChipsField';
import TaskColorSelect from '../shared/TaskColorSelect';
import TaskProgressHistoryField from '../shared/TaskProgressHistoryField';
import TaskDateQuickSelect from '../shared/TaskDateQuickSelect';
import TaskStatusButtons from '../shared/TaskStatusButtons';
import TaskWaitingFields from '../shared/TaskWaitingFields';
import TaskDocumentationTargetSelect from '../shared/TaskDocumentationTargetSelect';
import TaskProjectAssignmentField from '../shared/TaskProjectAssignmentField';
import TaskAppointmentsField from '../shared/TaskAppointmentsField';
import type { ProjectCache, Task, TaskColor, TaskDocumentationTarget, TaskProgressEntry, TaskStatus } from '../../types/entities';

export default function ProjectNewTaskForm({ projectId, data }: { projectId: string; data: ProjectCache }) {
  const createTask = useDataStore((s) => s.createTask);
  const waitingOptions = useDataStore((s) => s.waitingOptions);
  const syncCommLinksForTask = useDataStore((s) => s.syncCommLinksForTask);
  const setShowNewTaskForm = useProjectUiStore((s) => s.setShowNewTaskForm);
  const alert = useModalStore((s) => s.alert);
  const modules = useDataStore((s) => s.modules);
  const customerModules = useDataStore((s) => s.customerModules);
  const project = useDataStore((s) => s.projects?.find((item) => item.id === projectId));

  const [titel, setTitel] = useState('');
  const [activeSection, setActiveSection] = useState<'task' | 'basics'>('task');
  const [faelligAm, setFaelligAm] = useState('');
  const [termine, setTermine] = useState<string[]>([]);
  const [farbe, setFarbe] = useState<TaskColor | ''>('');
  const [status, setStatus] = useState<TaskStatus>('offen');
  const [kontaktIds, setKontaktIds] = useState<string[]>([]);
  const [wartetAuf, setWartetAuf] = useState('');
  const [wartetSeit, setWartetSeit] = useState('');
  const [dokuZiel, setDokuZiel] = useState<TaskDocumentationTarget>('');
  const [naechsteBesprechung, setNaechsteBesprechung] = useState(false);
  const [anforderung, setAnforderung] = useState('');
  const [aktuellerStand, setAktuellerStand] = useState('');
  const [verlauf, setVerlauf] = useState<TaskProgressEntry[]>([]);
  const [afns, setAfns] = useState<string[]>([]);
  const [commIds, setCommIds] = useState<string[]>([]);
  const [moduleIds, setModuleIds] = useState<string[]>([]);
  const [fremdverknuepfung, setFremdverknuepfung] = useState('');
  const [ticketsystemVerknuepfung, setTicketsystemVerknuepfung] = useState('');
  const [teilprojekt, setTeilprojekt] = useState('');
  const [projectIds, setProjectIds] = useState<string[]>([projectId]);
  const teilprojekte = Array.from(new Set(data.tasks.map((task) => task.teilprojekt?.trim()).filter((value): value is string => !!value)))
    .sort((a, b) => a.localeCompare(b, 'de'));
  const assignedModuleIds = new Set(customerModules.filter((item) => item.kunde === project?.kunde).map((item) => item.moduleId));
  const moduleItems = modules.filter((module) => assignedModuleIds.has(module.id)).sort((a, b) => { const parentA = modules.find((item) => item.id === a.parentId) || a; const parentB = modules.find((item) => item.id === b.parentId) || b; return parentA.sortIndex - parentB.sortIndex || a.sortIndex - b.sortIndex; });
  const moduleLabel = (module: (typeof modules)[number]) => { const parent = modules.find((item) => item.id === module.parentId); return parent ? `${parent.name} · ${module.name}` : module.name; };

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
      termine,
      farbe,
      status,
      wartetAuf: status === 'wartet' ? wartetAuf.trim() : '',
      wartetSeit: status === 'wartet' ? wartetSeit : '',
      kontaktId: kontaktIds[0] || '',
      kontaktIds,
      anforderung,
      aktuellerStand,
      verlauf,
      afns,
      commIds,
      moduleIds,
      fremdverknuepfung: fremdverknuepfung.trim(),
      ticketsystemVerknuepfung: ticketsystemVerknuepfung.trim(),
      teilprojekt: teilprojekt.trim(),
      doku: dokuZiel !== '',
      dokuErledigt: false,
      dokuZiel,
      naechsteBesprechung,
      projectIds,
    };
    const newTaskId = await createTask(projectId, partial);
    if (commIds.length) await syncCommLinksForTask(projectId, newTaskId, [], commIds);
    setShowNewTaskForm(false);
  }

  function discardTask() {
    setShowNewTaskForm(false);
  }

  return (
    <div className="card">
      <div className="top-row" style={{ marginBottom: 10 }}>
        <h3 style={{ fontSize: 15 }}>Neue Aufgabe</h3>
        <button type="button" className="icon-btn" onClick={discardTask}>
          Verwerfen
        </button>
      </div>
      <nav className="task-form-tabs"><button type="button" className={activeSection === 'task' ? 'active' : ''} onClick={() => setActiveSection('task')}>Aufgabe</button><button type="button" className={activeSection === 'basics' ? 'active' : ''} onClick={() => setActiveSection('basics')}>Grunddaten</button></nav>
      {activeSection === 'task' ? <div className="task-form-section">
      <div className="field task-title-field"><label>Titel</label><input value={titel} onChange={(e) => setTitel(e.target.value)} /></div>
      <div className="task-primary-controls"><div className="task-primary-control"><label>Status</label><TaskStatusButtons value={status} onChange={(value) => { setStatus(value); if (value === 'wartet' && !wartetSeit) setWartetSeit(todayStr()); }} /><label>Farbmarkierung</label><TaskColorSelect value={farbe} onChange={setFarbe} /></div><div className="task-primary-control"><label>Fällig am</label><div className="task-date-control"><input type="date" value={faelligAm} onChange={(e) => setFaelligAm(e.target.value)} /><TaskDateQuickSelect value={faelligAm} onChange={setFaelligAm} /></div></div></div>
      {status === 'wartet' && (
        <TaskWaitingFields waitingFor={wartetAuf} waitingSince={wartetSeit} waitingOptions={waitingOptions} onWaitingForChange={setWartetAuf} onWaitingSinceChange={setWartetSeit} />
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
      </div> : <div className="task-form-section">
      <TaskAppointmentsField value={termine} onChange={setTermine} />
      <div className="task-basics-grid">
      <div className="field"><label>Ticket</label><input type="url" value={ticketsystemVerknuepfung} onChange={(e) => setTicketsystemVerknuepfung(e.target.value)} placeholder="https://ticketsystem/…" /></div>
      <div className="field"><label>Fremdverknüpfung</label><input type="url" value={fremdverknuepfung} onChange={(e) => setFremdverknuepfung(e.target.value)} placeholder="https://…" /></div>
      <div className="field"><label>Ansprechpartner</label><LinkChipsField ids={kontaktIds} items={data.contacts} labelFn={contactLinkLabel} placeholder="— Ansprechpartner auswählen —" onChange={setKontaktIds} /></div>
      <div className="field"><label>Teilprojekt</label><input value={teilprojekt} onChange={(e) => setTeilprojekt(e.target.value)} list={`teilprojekte-${projectId}`} placeholder="Teilprojekt neu eingeben oder auswählen" /><datalist id={`teilprojekte-${projectId}`}>{teilprojekte.map((name) => <option key={name} value={name} />)}</datalist></div>
      <TaskDocumentationTargetSelect value={dokuZiel} onChange={setDokuZiel} />
      <div className="doku-check-field"><label><input type="checkbox" checked={naechsteBesprechung} onChange={(e) => setNaechsteBesprechung(e.target.checked)} /> Für nächste Besprechung vormerken</label></div>
      </div>
      <div className="field">
        <label>AFN-Nummer(n)</label>
        <AfnChipsField value={afns} onChange={setAfns} />
      </div>
      <div className="field"><label>Verknüpfte Module</label><LinkChipsField ids={moduleIds} items={moduleItems} labelFn={moduleLabel} placeholder="— Kundenmodul auswählen —" onChange={setModuleIds} /></div>
      <div className="field"><label>Verknüpfte Kommunikation</label><LinkChipsField ids={commIds} items={data.comms} labelFn={commLinkLabel} placeholder="— Eintrag auswählen —" onChange={setCommIds} /></div>
      <TaskProjectAssignmentField value={projectIds} onChange={setProjectIds} />
      </div>}
      <div className="btn-row">
        <button type="button" className="btn" onClick={handleSave}>
          Hinzufügen
        </button>
        <button type="button" className="btn secondary" onClick={discardTask}>
          Verwerfen
        </button>
      </div>
    </div>
  );
}
