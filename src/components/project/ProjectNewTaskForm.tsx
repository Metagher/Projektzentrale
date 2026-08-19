import { useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useProjectUiStore } from '../../store/projectUiStore';
import { useModalStore } from '../../store/modalStore';
import { TASK_STATUS } from '../../lib/constants';
import { commLinkLabel } from '../../lib/format';
import RtfField from '../shared/RtfField';
import AfnChipsField from '../shared/AfnChipsField';
import LinkChipsField from '../shared/LinkChipsField';
import TaskColorSelect from '../shared/TaskColorSelect';
import type { ProjectCache, Task, TaskColor, TaskStatus } from '../../types/entities';

export default function ProjectNewTaskForm({ projectId, data }: { projectId: string; data: ProjectCache }) {
  const createTask = useDataStore((s) => s.createTask);
  const waitingOptions = useDataStore((s) => s.waitingOptions);
  const syncCommLinksForTask = useDataStore((s) => s.syncCommLinksForTask);
  const setShowNewTaskForm = useProjectUiStore((s) => s.setShowNewTaskForm);
  const alert = useModalStore((s) => s.alert);

  const [titel, setTitel] = useState('');
  const [faelligAm, setFaelligAm] = useState('');
  const [farbe, setFarbe] = useState<TaskColor | ''>('');
  const [status, setStatus] = useState<TaskStatus>('offen');
  const [kontaktId, setKontaktId] = useState('');
  const [wartetAuf, setWartetAuf] = useState('');
  const [doku, setDoku] = useState(false);
  const [beschreibung, setBeschreibung] = useState('');
  const [notizen, setNotizen] = useState('');
  const [afns, setAfns] = useState<string[]>([]);
  const [commIds, setCommIds] = useState<string[]>([]);
  const [fremdverknuepfung, setFremdverknuepfung] = useState('');

  async function handleSave() {
    const trimmed = titel.trim();
    if (!trimmed) {
      await alert('Bitte einen Titel angeben.');
      return;
    }
    if (status === 'wartet' && !wartetAuf) { await alert('Bitte auswählen, auf wen gewartet wird.'); return; }
    const partial: Omit<Task, 'id' | 'nr' | 'erstelltAm' | 'abgeschlossenAm'> = {
      titel: trimmed,
      faelligAm,
      farbe,
      status,
      wartetAuf: status === 'wartet' ? wartetAuf.trim() : '',
      kontaktId,
      beschreibung,
      notizen,
      afns,
      commIds,
      fremdverknuepfung: fremdverknuepfung.trim(),
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
      <div className="field-grid">
        <div className="field">
          <label>Titel</label>
          <input value={titel} onChange={(e) => setTitel(e.target.value)} />
        </div>
        <div className="field">
          <label>Fällig am</label>
          <input type="date" value={faelligAm} onChange={(e) => setFaelligAm(e.target.value)} />
        </div>
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            {TASK_STATUS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Ansprechpartner</label>
          <select className="contact-select" value={kontaktId} onChange={(e) => setKontaktId(e.target.value)}>
            <option value="">— kein Ansprechpartner —</option>
            {data.contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.rolle ? ` (${c.rolle})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field"><label>Farbmarkierung</label><TaskColorSelect value={farbe} onChange={setFarbe} /></div>
      {status === 'wartet' && (
        <div className="field wartet-auf-field">
          <label>Wartet auf (Person)</label>
          <select value={wartetAuf} onChange={(e) => setWartetAuf(e.target.value)}><option value="">Bitte auswählen</option>{waitingOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
        </div>
      )}
      <div className="doku-check-field">
        <label>
          <input type="checkbox" checked={doku} onChange={(e) => setDoku(e.target.checked)} /> Für Dokumentation
          vormerken (erscheint nach Erledigung im Reiter „Dokumentation")
        </label>
      </div>
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
      <div className="field">
        <label>AFN-Nummer(n)</label>
        <AfnChipsField value={afns} onChange={setAfns} />
      </div>
      <div className="field">
        <label>Verknüpfte Kommunikation</label>
        <LinkChipsField ids={commIds} items={data.comms} labelFn={commLinkLabel} placeholder="— Eintrag auswählen —" onChange={setCommIds} />
      </div>
      <div className="btn-row">
        <button className="btn" onClick={handleSave}>
          Hinzufügen
        </button>
      </div>
    </div>
  );
}
