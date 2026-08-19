import { useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useProjectUiStore } from '../../store/projectUiStore';
import { useModalStore } from '../../store/modalStore';
import { TASK_STATUS } from '../../lib/constants';
import { commLinkLabel, slug } from '../../lib/format';
import RtfField from '../shared/RtfField';
import AfnChipsField from '../shared/AfnChipsField';
import LinkChipsField from '../shared/LinkChipsField';
import TaskColorSelect from '../shared/TaskColorSelect';
import type { Contact, ProjectCache, Task, TaskColor, TaskStatus } from '../../types/entities';

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
  const [farbe, setFarbe] = useState<TaskColor | ''>(task.farbe || '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [faelligAm, setFaelligAm] = useState(task.faelligAm || '');
  const [kontaktId, setKontaktId] = useState(task.kontaktId || '');
  const [doku, setDoku] = useState(task.doku);
  const [wartetAuf, setWartetAuf] = useState(task.wartetAuf || '');
  const [beschreibung, setBeschreibung] = useState(task.beschreibung || '');
  const [notizen, setNotizen] = useState(task.notizen || '');
  const [afns, setAfns] = useState(task.afns || []);
  const [commIds, setCommIds] = useState(task.commIds || []);
  const [fremdverknuepfung, setFremdverknuepfung] = useState(task.fremdverknuepfung || '');

  async function handleSave() {
    const trimmed = titel.trim();
    if (!trimmed) {
      await alert('Bitte einen Titel angeben.');
      return;
    }
    if (status === 'wartet' && !wartetAuf) { await alert('Bitte auswählen, auf wen gewartet wird.'); return; }
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
      beschreibung,
      notizen,
      afns,
      commIds,
      fremdverknuepfung: fremdverknuepfung.trim(),
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
      <div className="task-inline-row">
        <TaskColorSelect value={farbe} onChange={setFarbe} />
        <input type="text" value={titel} onChange={(e) => setTitel(e.target.value)} />
        <select className={`task-status-select ${slug(status)}`} value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
          {TASK_STATUS.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
        <input type="date" value={faelligAm} onChange={(e) => setFaelligAm(e.target.value)} />
        <select value={kontaktId} onChange={(e) => setKontaktId(e.target.value)}>
          <option value="">— kein Ansprechpartner —</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.rolle ? ` (${c.rolle})` : ''}
            </option>
          ))}
        </select>
        <label className="doku-check-inline">
          <input type="checkbox" checked={doku} onChange={(e) => setDoku(e.target.checked)} /> Doku
        </label>
      </div>
      {status === 'wartet' && (
        <div className="field wartet-auf-field">
          <label>Wartet auf (Person)</label>
          <select value={wartetAuf} onChange={(e) => setWartetAuf(e.target.value)}><option value="">Bitte auswählen</option>{wartetAuf && !waitingOptions.includes(wartetAuf) && <option value={wartetAuf}>{wartetAuf} (Bestand)</option>}{waitingOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
        </div>
      )}
      <div className="field">
        <label>Fremdverknüpfung</label>
        <input type="url" value={fremdverknuepfung} onChange={(e) => setFremdverknuepfung(e.target.value)} placeholder="https://app.asana.com/…" />
      </div>
      <div className="field">
        <label>Beschreibung</label>
        <RtfField value={beschreibung} onChange={setBeschreibung} title="Beschreibung" placeholder="Klicken, um eine Beschreibung zu erfassen…" />
      </div>
      <div className="field">
        <label>Interne Notizen</label>
        <RtfField value={notizen} onChange={setNotizen} title="Interne Notizen" placeholder="Klicken, um interne Notizen zu erfassen…" />
      </div>
      <AfnChipsField value={afns} onChange={setAfns} />
      <LinkChipsField ids={commIds} items={data.comms} labelFn={commLinkLabel} placeholder="— Eintrag auswählen —" onChange={setCommIds} />
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
