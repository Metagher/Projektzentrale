import { useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import RtfField from '../shared/RtfField';
import AfnChipsField from '../shared/AfnChipsField';
import TaskColorSelect from '../shared/TaskColorSelect';
import TaskProgressHistoryField from '../shared/TaskProgressHistoryField';
import TaskDateQuickSelect from '../shared/TaskDateQuickSelect';
import TaskStatusButtons from '../shared/TaskStatusButtons';
import type { TaskWithMeta } from '../../store/dataStore';
import type { TaskColor, TaskProgressEntry, TaskStatus } from '../../types/entities';

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
  const [kontaktId, setKontaktId] = useState(task.kontaktId || '');
  const [doku, setDoku] = useState(task.doku);
  const [wartetAuf, setWartetAuf] = useState(task.wartetAuf || '');
  const [anforderung, setAnforderung] = useState(task.anforderung || '');
  const [aktuellerStand, setAktuellerStand] = useState(task.aktuellerStand || '');
  const [verlauf, setVerlauf] = useState<TaskProgressEntry[]>(task.verlauf || []);
  const [afns, setAfns] = useState(task.afns || []);
  const [fremdverknuepfung, setFremdverknuepfung] = useState(task.fremdverknuepfung || '');
  const [ticketsystemVerknuepfung, setTicketsystemVerknuepfung] = useState(task.ticketsystemVerknuepfung || '');
  const [teilprojekt, setTeilprojekt] = useState(task.teilprojekt || '');
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
      faelligAm,
      kontaktId,
      anforderung,
      aktuellerStand,
      verlauf,
      afns,
      fremdverknuepfung: fremdverknuepfung.trim(),
      ticketsystemVerknuepfung: ticketsystemVerknuepfung.trim(),
      teilprojekt: teilprojekt.trim(),
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
        <div className="field"><label>Teilprojekt</label><input value={teilprojekt} onChange={(e) => setTeilprojekt(e.target.value)} list={`teilprojekte-dashboard-${task.projectId}`} placeholder="Teilprojekt neu eingeben oder auswählen" /><datalist id={`teilprojekte-dashboard-${task.projectId}`}>{teilprojekte.map((name) => <option key={name} value={name} />)}</datalist></div>
        <label className="doku-check-field"><input type="checkbox" checked={doku} onChange={(e) => setDoku(e.target.checked)} /> Für Dokumentation vormerken</label>
      </div><div className="field"><label>AFN-Nummer(n)</label><AfnChipsField value={afns} onChange={setAfns} /></div></div>}
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
