import { useEffect, useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useProjectUiStore } from '../../store/projectUiStore';
import { useModalStore } from '../../store/modalStore';
import { commLinkLabel, todayStr } from '../../lib/format';
import RtfField from '../shared/RtfField';
import AfnChipsField from '../shared/AfnChipsField';
import LinkChipsField from '../shared/LinkChipsField';
import TaskColorSelect from '../shared/TaskColorSelect';
import TaskProgressHistoryField from '../shared/TaskProgressHistoryField';
import TaskDateQuickSelect from '../shared/TaskDateQuickSelect';
import TaskStatusButtons from '../shared/TaskStatusButtons';
import TaskWaitingFields from '../shared/TaskWaitingFields';
import type { Contact, ProjectCache, Task, TaskColor, TaskProgressEntry, TaskStatus } from '../../types/entities';
import TaskTimePanel from './TaskTimePanel';

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
  const startTimer = useDataStore((s) => s.startTimer);
  const stopTimer = useDataStore((s) => s.stopTimer);
  const modules = useDataStore((s) => s.modules);
  const customerModules = useDataStore((s) => s.customerModules);
  const project = useDataStore((s) => s.projects?.find((item) => item.id === projectId));
  const { setEditingTaskId } = useProjectUiStore();
  const confirm = useModalStore((s) => s.confirm);
  const alert = useModalStore((s) => s.alert);

  const [titel, setTitel] = useState(task.titel);
  const [activeSection, setActiveSection] = useState<'task' | 'basics' | 'time'>('task');
  const [farbe, setFarbe] = useState<TaskColor | ''>(task.farbe || '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [faelligAm, setFaelligAm] = useState(task.faelligAm || '');
  const [kontaktId, setKontaktId] = useState(task.kontaktId || '');
  const [doku, setDoku] = useState(task.doku);
  const [wartetAuf, setWartetAuf] = useState(task.wartetAuf || '');
  const [wartetSeit, setWartetSeit] = useState(task.wartetSeit || '');
  const [anforderung, setAnforderung] = useState(task.anforderung || '');
  const [aktuellerStand, setAktuellerStand] = useState(task.aktuellerStand || '');
  const [verlauf, setVerlauf] = useState<TaskProgressEntry[]>(task.verlauf || []);
  const [afns, setAfns] = useState(task.afns || []);
  const [commIds, setCommIds] = useState(task.commIds || []);
  const [moduleIds, setModuleIds] = useState(task.moduleIds || []);
  const [fremdverknuepfung, setFremdverknuepfung] = useState(task.fremdverknuepfung || '');
  const [ticketsystemVerknuepfung, setTicketsystemVerknuepfung] = useState(task.ticketsystemVerknuepfung || '');
  const [teilprojekt, setTeilprojekt] = useState(task.teilprojekt || '');
  const teilprojekte = Array.from(new Set(data.tasks.map((item) => item.teilprojekt?.trim()).filter((value): value is string => !!value)))
    .sort((a, b) => a.localeCompare(b, 'de'));
  const assignedModuleIds = new Set(customerModules.filter((item) => item.kunde === project?.kunde).map((item) => item.moduleId));
  const moduleItems = modules.filter((module) => assignedModuleIds.has(module.id) || moduleIds.includes(module.id)).sort((a, b) => { const parentA = modules.find((item) => item.id === a.parentId) || a; const parentB = modules.find((item) => item.id === b.parentId) || b; return parentA.sortIndex - parentB.sortIndex || a.sortIndex - b.sortIndex; });
  const moduleLabel = (module: (typeof modules)[number]) => { const parent = modules.find((item) => item.id === module.parentId); return parent ? `${parent.name} · ${module.name}` : module.name; };

  useEffect(() => {
    let disposed = false;
    let finishing: Promise<void> | null = null;
    let resumeProjectTimerId: string | null = null;

    const stopTaskAndResumeProject = () => {
      if (finishing) return finishing;
      finishing = (async () => {
        const active = useDataStore.getState().activeTimer;
        if (active?.projectId !== projectId || active.taskId !== task.id) return;

        await stopTimer();

        if (resumeProjectTimerId && !useDataStore.getState().activeTimer) {
          await startTimer(resumeProjectTimerId, null);
        }
      })();
      return finishing;
    };

    // Verzögert um einen Tick, damit Reacts Strict-Mode-Prüflauf keine Scheinbuchung erzeugt.
    const startId = window.setTimeout(() => {
      if (disposed) return;
      void (async () => {
        const previousTimer = useDataStore.getState().activeTimer;
        resumeProjectTimerId = previousTimer?.projectId === projectId && previousTimer.taskId === null
          ? projectId
          : null;
        await startTimer(projectId, task.id);
        if (disposed) await stopTaskAndResumeProject();
      })();
    }, 0);
    return () => {
      disposed = true;
      window.clearTimeout(startId);
      const active = useDataStore.getState().activeTimer;
      if (active?.projectId === projectId && active.taskId === task.id) void stopTaskAndResumeProject();
    };
  }, [projectId, task.id, startTimer, stopTimer]);

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
      wartetSeit: status === 'wartet' ? wartetSeit : '',
      faelligAm,
      kontaktId,
      anforderung,
      aktuellerStand,
      verlauf,
      afns,
      commIds,
      moduleIds,
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
      <nav className="task-form-tabs"><button type="button" className={activeSection === 'task' ? 'active' : ''} onClick={() => setActiveSection('task')}>Aufgabe</button><button type="button" className={activeSection === 'basics' ? 'active' : ''} onClick={() => setActiveSection('basics')}>Grunddaten</button><button type="button" className={activeSection === 'time' ? 'active' : ''} onClick={() => setActiveSection('time')}>Zeiten</button></nav>
      {activeSection === 'task' ? <div className="task-form-section">
      <div className="field task-title-field"><label>Titel</label><input type="text" value={titel} onChange={(e) => setTitel(e.target.value)} /></div>
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
      </div> : activeSection === 'basics' ? <div className="task-form-section"><div className="task-basics-grid">
        <div className="field"><label>Ticket</label><input type="url" value={ticketsystemVerknuepfung} onChange={(e) => setTicketsystemVerknuepfung(e.target.value)} placeholder="https://ticketsystem/…" /></div>
        <div className="field"><label>Fremdverknüpfung</label><input type="url" value={fremdverknuepfung} onChange={(e) => setFremdverknuepfung(e.target.value)} placeholder="https://…" /></div>
        <div className="field"><label>Ansprechpartner</label><select value={kontaktId} onChange={(e) => setKontaktId(e.target.value)}><option value="">— kein Ansprechpartner —</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.rolle ? ` (${c.rolle})` : ''}</option>)}</select></div>
        <div className="field"><label>Teilprojekt</label><input value={teilprojekt} onChange={(e) => setTeilprojekt(e.target.value)} list={`teilprojekte-edit-${projectId}`} placeholder="Teilprojekt neu eingeben oder auswählen" /><datalist id={`teilprojekte-edit-${projectId}`}>{teilprojekte.map((name) => <option key={name} value={name} />)}</datalist></div>
        <label className="doku-check-field"><input type="checkbox" checked={doku} onChange={(e) => setDoku(e.target.checked)} /> Für Dokumentation vormerken</label>
      </div><div className="field"><label>AFN-Nummer(n)</label><AfnChipsField value={afns} onChange={setAfns} /></div><div className="field"><label>Verknüpfte Module</label><LinkChipsField ids={moduleIds} items={moduleItems} labelFn={moduleLabel} placeholder="— Kundenmodul auswählen —" onChange={setModuleIds} /></div><div className="field"><label>Verknüpfte Kommunikation</label><LinkChipsField ids={commIds} items={data.comms} labelFn={commLinkLabel} placeholder="— Eintrag auswählen —" onChange={setCommIds} /></div></div> : <TaskTimePanel projectId={projectId} taskId={task.id} />}
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
