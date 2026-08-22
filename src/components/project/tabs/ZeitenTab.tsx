import { useState } from 'react';
import { useDataStore } from '../../../store/dataStore';
import { useModalStore } from '../../../store/modalStore';
import { formatDuration, formatTimeStamp } from '../../../lib/timeTracking';
import { uid } from '../../../lib/format';
import type { Project, ProjectCache, TimeEntry } from '../../../types/entities';
import TimeAnalyticsOverview from '../../analytics/TimeAnalyticsOverview';

function localInput(date: Date) { const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 19); }

export default function ZeitenTab({ project, data }: { project: Project; data: ProjectCache }) {
  const entries = useDataStore((s) => s.timeEntries).filter((entry) => entry.projectId === project.id).slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const saveTimeEntry = useDataStore((s) => s.saveTimeEntry); const deleteTimeEntry = useDataStore((s) => s.deleteTimeEntry); const confirm = useModalStore((s) => s.confirm);
  const workdayOverrides = useDataStore((s) => s.workdayOverrides);
  const [manual, setManual] = useState(false);
  const total = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0); const general = entries.filter((entry) => !entry.taskId).reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const taskTotals = data.tasks.map((task) => ({ task, minutes: entries.filter((entry) => entry.taskId === task.id).reduce((sum, entry) => sum + entry.durationMinutes, 0) })).filter((row) => row.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  async function remove(entry: TimeEntry) { if (await confirm(`Zeiteintrag über ${formatDuration(entry.durationMinutes)} löschen?`)) await deleteTimeEntry(entry.id); }
  return <section className="time-tab"><div className="module-section-head"><div><span className="eyebrow">Zeiterfassung</span><h3>{formatDuration(total)} Gesamtzeit</h3><p>Allgemeine Projektzeit und aufgabenbezogene Arbeit werden getrennt ausgewiesen.</p></div><button className="btn small" onClick={() => setManual(true)}>+ Zeit nachtragen</button></div>
    <div className="time-summary-grid"><article><span>Allgemeine Projektzeit</span><strong>{formatDuration(general)}</strong></article><article><span>Aufgabenzeit</span><strong>{formatDuration(total - general)}</strong></article><article><span>Buchungen</span><strong>{entries.length}</strong></article></div>
    <TimeAnalyticsOverview entries={entries} workdayOverrides={workdayOverrides} heading="Projektzeit nach Tag und Kalenderwoche" />
    {taskTotals.length > 0 && <section className="time-task-breakdown"><h4>Zeit nach Aufgabe</h4>{taskTotals.map(({ task, minutes }) => <div key={task.id}><span><b className="task-nr">{task.nr}</b>{task.titel}</span><strong>{formatDuration(minutes)}</strong></div>)}</section>}
    <div className="time-history-head"><h4>Zeiteinträge mit vollständigem Datumsstempel</h4></div>{entries.length === 0 ? <div className="empty-state"><h3>Noch keine Zeit erfasst</h3><div>Starte den Timer im Projektkopf oder direkt an einer Aufgabe.</div></div> : <div className="time-entry-list">{entries.map((entry) => { const task = data.tasks.find((item) => item.id === entry.taskId); return <article key={entry.id}><time><span>Start: {formatTimeStamp(entry.startedAt)}</span><span>Ende: {formatTimeStamp(entry.endedAt)}</span></time><div><strong>{task ? `${task.nr} · ${task.titel}` : entry.taskId ? 'Gelöschte Aufgabe' : 'Allgemeine Projektzeit'}</strong>{entry.note && <small>{entry.note}</small>}</div><b>{formatDuration(entry.durationMinutes)}</b><button className="icon-btn" onClick={() => remove(entry)}>Löschen</button></article>; })}</div>}
    {manual && <ManualTimeEntry projectId={project.id} tasks={data.tasks} onSave={async (entry) => { await saveTimeEntry(entry); setManual(false); }} onClose={() => setManual(false)} />}
  </section>;
}

function ManualTimeEntry({ projectId, tasks, onSave, onClose }: { projectId: string; tasks: ProjectCache['tasks']; onSave: (entry: TimeEntry) => Promise<void>; onClose: () => void }) {
  const endDefault = new Date(); const startDefault = new Date(endDefault.getTime() - 60 * 60000); const [startedAt, setStartedAt] = useState(localInput(startDefault)); const [endedAt, setEndedAt] = useState(localInput(endDefault)); const [taskId, setTaskId] = useState(''); const [note, setNote] = useState('');
  const difference = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000); const minutes = Number.isFinite(difference) ? Math.max(0, difference) : 0;
  return <div className="task-edit-overlay" role="dialog" aria-modal="true"><div className="task-edit-dialog"><div className="task-edit-dialog-head"><div><span>Manuelle Erfassung</span><strong>Zeit nachtragen</strong></div></div><div className="field-grid"><div className="field"><label>Start</label><input type="datetime-local" step="1" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} /></div><div className="field"><label>Ende</label><input type="datetime-local" step="1" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} /></div></div><div className="field"><label>Zuordnung</label><select value={taskId} onChange={(e) => setTaskId(e.target.value)}><option value="">Allgemeine Projektzeit</option>{tasks.map((task) => <option value={task.id} key={task.id}>{task.nr} · {task.titel}</option>)}</select></div><div className="field"><label>Notiz</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional, z. B. Workshop oder Abstimmung" /></div><div className="manual-time-duration">Dauer: <strong>{formatDuration(minutes)}</strong></div><div className="btn-row"><button className="btn" disabled={minutes < 1} onClick={() => onSave({ id: uid(), projectId, taskId: taskId || null, startedAt: new Date(startedAt).toISOString(), endedAt: new Date(endedAt).toISOString(), durationMinutes: minutes, note: note.trim(), createdAt: new Date().toISOString() })}>Zeit speichern</button><button className="btn secondary" onClick={onClose}>Abbrechen</button></div></div></div>;
}
