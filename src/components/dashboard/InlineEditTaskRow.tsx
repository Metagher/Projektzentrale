import { useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import { TASK_PRIO, TASK_STATUS, prioLabel } from '../../lib/constants';
import { slug } from '../../lib/format';
import RtfField from '../shared/RtfField';
import AfnChipsField from '../shared/AfnChipsField';
import TaskColorSelect from '../shared/TaskColorSelect';
import type { TaskWithMeta } from '../../store/dataStore';
import type { TaskColor, TaskPrio, TaskStatus } from '../../types/entities';

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
  const [prioritaet, setPrioritaet] = useState<TaskPrio>(task.prioritaet || 'should');
  const [farbe, setFarbe] = useState<TaskColor | ''>(task.farbe || '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [faelligAm, setFaelligAm] = useState(task.faelligAm || '');
  const [kontaktId, setKontaktId] = useState(task.kontaktId || '');
  const [doku, setDoku] = useState(task.doku);
  const [wartetAuf, setWartetAuf] = useState(task.wartetAuf || '');
  const [beschreibung, setBeschreibung] = useState(task.beschreibung || '');
  const [notizen, setNotizen] = useState(task.notizen || '');
  const [afns, setAfns] = useState(task.afns || []);

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
    const { projectId: _pid, projectName: _pn, ...base } = task;
    void _pid;
    void _pn;
    await saveTask(task.projectId, {
      ...base,
      titel: trimmed,
      prioritaet,
      farbe,
      status,
      wartetAuf: status === 'wartet' ? wartetAuf.trim() : '',
      faelligAm,
      kontaktId,
      beschreibung,
      notizen,
      afns,
      abgeschlossenAm,
      doku,
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
      <div className="task-inline-row">
        <span className={`prio-dot prio-${slug(prioritaet)}`} />
        <TaskColorSelect value={farbe} onChange={setFarbe} />
        <input type="text" value={titel} onChange={(e) => setTitel(e.target.value)} />
        <select value={prioritaet} onChange={(e) => setPrioritaet(e.target.value as TaskPrio)}>
          {TASK_PRIO.map((pr) => (
            <option key={pr} value={pr}>
              {prioLabel(pr)}
            </option>
          ))}
        </select>
        <select
          className={`task-status-select ${slug(status)}`}
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus)}
        >
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
        <label>Beschreibung</label>
        <RtfField value={beschreibung} onChange={setBeschreibung} title="Beschreibung" placeholder="Klicken, um eine Beschreibung zu erfassen…" />
      </div>
      <div className="field">
        <label>Interne Notizen</label>
        <RtfField value={notizen} onChange={setNotizen} title="Interne Notizen" placeholder="Klicken, um interne Notizen zu erfassen…" />
      </div>
      <AfnChipsField value={afns} onChange={setAfns} />
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
