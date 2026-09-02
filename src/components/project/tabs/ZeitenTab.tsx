import { useState } from 'react';
import { useDataStore } from '../../../store/dataStore';
import { useModalStore } from '../../../store/modalStore';
import { formatDuration } from '../../../lib/timeTracking';
import { uid } from '../../../lib/format';
import type { BilledTimeEntry, Project, ProjectCache, ProjectTimeType, TimeEntry } from '../../../types/entities';
import TimeAnalyticsOverview, { type BilledTimeRow } from '../../analytics/TimeAnalyticsOverview';

function localInput(date: Date) { const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 19); }
function todayInput() { return localInput(new Date()).slice(0, 10); }

export default function ZeitenTab({ project, data }: { project: Project; data: ProjectCache }) {
  const entries = useDataStore((s) => s.timeEntries).filter((entry) => entry.projectId === project.id).slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const saveTimeEntry = useDataStore((s) => s.saveTimeEntry); const deleteTimeEntry = useDataStore((s) => s.deleteTimeEntry);
  const saveBilledTimeEntry = useDataStore((s) => s.saveBilledTimeEntry); const deleteBilledTimeEntry = useDataStore((s) => s.deleteBilledTimeEntry);
  const workdayOverrides = useDataStore((s) => s.workdayOverrides);
  const projectTimeTypes = useDataStore((s) => s.projectTimeTypes);
  const confirm = useModalStore((s) => s.confirm);
  const [manual, setManual] = useState(false);
  const [freeBilled, setFreeBilled] = useState(false);
  const total = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const timeTypeTotals = projectTimeTypes.map((type, index) => ({ type, minutes: entries.filter((entry) => !entry.taskId && (entry.timeTypeId === type.id || (!entry.timeTypeId && index === 0))).reduce((sum, entry) => sum + entry.durationMinutes, 0) }));
  const billedTaskMinutes = data.tasks.reduce((sum, task) => sum + (Number(task.billedMinutes) || 0), 0);
  const billedCommunicationMinutes = data.comms.reduce((sum, comm) => sum + (Number(comm.billedMinutes) || 0), 0);
  const billedFreeEntries = data.billedTimeEntries.slice().sort((a, b) => b.datum.localeCompare(a.datum));
  const billedFreeMinutes = billedFreeEntries.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  const billedDays = new Map<string, { taskMinutes: number; communicationMinutes: number; freeMinutes: number }>();
  const billedItems: NonNullable<BilledTimeRow['items']> = [];
  data.tasks.forEach((task) => (task.billedZeiten || []).forEach((entry) => { const minutes = Number(entry.minutes) || 0; if (minutes > 0 && entry.datum) { const day = billedDays.get(entry.datum) || { taskMinutes: 0, communicationMinutes: 0, freeMinutes: 0 }; day.taskMinutes += minutes; billedDays.set(entry.datum, day); billedItems.push({ date: entry.datum, kind: 'Aufgabe', label: `${task.nr} · ${task.titel}`, minutes }); } }));
  data.comms.forEach((comm) => { const minutes = Number(comm.billedMinutes) || 0; if (minutes > 0 && comm.datum) { const day = billedDays.get(comm.datum) || { taskMinutes: 0, communicationMinutes: 0, freeMinutes: 0 }; day.communicationMinutes += minutes; billedDays.set(comm.datum, day); billedItems.push({ date: comm.datum, kind: 'Kommunikation', label: comm.betreff || comm.kanal, minutes }); } });
  billedFreeEntries.forEach((entry) => { const minutes = Number(entry.minutes) || 0; if (minutes > 0 && entry.datum) { const day = billedDays.get(entry.datum) || { taskMinutes: 0, communicationMinutes: 0, freeMinutes: 0 }; day.freeMinutes += minutes; billedDays.set(entry.datum, day); billedItems.push({ date: entry.datum, kind: 'Frei', label: entry.hinweis || entry.teilprojekt || 'Frei abgerechnete Zeit', minutes }); } });
  const taskTotals = data.tasks.map((task) => ({ task, minutes: entries.filter((entry) => entry.taskId === task.id).reduce((sum, entry) => sum + entry.durationMinutes, 0) })).filter((row) => row.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  const teilprojekte = Array.from(new Set([...data.tasks.map((task) => task.teilprojekt?.trim()), ...data.comms.map((comm) => comm.teilprojekt?.trim()), ...billedFreeEntries.map((entry) => entry.teilprojekt?.trim())].filter((value): value is string => !!value))).sort((a, b) => a.localeCompare(b, 'de'));
  return <section className="time-tab"><div className="module-section-head"><div><span className="eyebrow">Zeiterfassung</span><h3>{formatDuration(total)} Gesamtzeit</h3><p>Projektzeit wird nach den global festgelegten Zeittypen und Aufgaben ausgewiesen.</p></div><div className="btn-row"><button className="btn small" onClick={() => setManual(true)}>+ Zeit nachtragen</button><button className="btn secondary small" onClick={() => setFreeBilled(true)}>+ Abgerechnete Zeit frei erfassen</button></div></div>
    <div className="time-summary-grid">{timeTypeTotals.map(({ type, minutes }) => <article key={type.id}><span>{type.name}</span><strong>{formatDuration(minutes)}</strong></article>)}<article><span>Aufgabenzeit</span><strong>{formatDuration(entries.filter((entry) => !!entry.taskId).reduce((sum, entry) => sum + entry.durationMinutes, 0))}</strong></article><article><span>Buchungen</span><strong>{entries.length}</strong></article></div>
    <TimeAnalyticsOverview entries={entries} projects={[project]} workdayOverrides={workdayOverrides} heading="Projektzeit nach Tag und Kalenderwoche" billedRows={[{ projectId: project.id, taskMinutes: billedTaskMinutes, communicationMinutes: billedCommunicationMinutes, freeMinutes: billedFreeMinutes, days: Array.from(billedDays, ([date, values]) => ({ date, ...values })), items: billedItems }]} taskLabels={Object.fromEntries(data.tasks.map((task) => [task.id, `${task.nr} · ${task.titel}`]))} timeTypeLabels={Object.fromEntries(projectTimeTypes.map((type) => [type.id, type.name]))} billedChartMode="type" onSaveEntry={saveTimeEntry} onDeleteEntry={deleteTimeEntry} />
    {taskTotals.length > 0 && <section className="time-task-breakdown"><h4>Zeit nach Aufgabe</h4>{taskTotals.map(({ task, minutes }) => <div key={task.id}><span><b className="task-nr">{task.nr}</b>{task.titel}</span><strong>{formatDuration(minutes)}</strong></div>)}</section>}
    {billedFreeEntries.length > 0 && <section className="time-task-breakdown"><h4>Frei abgerechnete Zeit ({formatDuration(billedFreeMinutes)})</h4>{billedFreeEntries.map((entry) => <div key={entry.id}><span>{entry.datum}{entry.teilprojekt ? <span className="badge teilprojekt" style={{ marginLeft: 6 }}>{entry.teilprojekt}</span> : null}{entry.hinweis ? ` · ${entry.hinweis}` : ''}</span><strong>{formatDuration(entry.minutes)}</strong><button type="button" className="icon-btn" onClick={() => void (async () => { if (await confirm(`Abgerechnete Zeit über ${formatDuration(entry.minutes)} löschen?`)) await deleteBilledTimeEntry(project.id, entry.id); })()}>Löschen</button></div>)}</section>}
    {entries.length === 0 && <div className="empty-state"><h3>Noch keine Zeit erfasst</h3><div>Starte den Timer im Projektkopf oder direkt an einer Aufgabe.</div></div>}
    {manual && <ManualTimeEntry projectId={project.id} tasks={data.tasks} timeTypes={projectTimeTypes} onSave={async (entry) => { await saveTimeEntry(entry); setManual(false); }} onClose={() => setManual(false)} />}
    {freeBilled && <FreeBilledTimeEntry projectId={project.id} teilprojekte={teilprojekte} onSave={async (entry) => { await saveBilledTimeEntry(project.id, entry); setFreeBilled(false); }} onClose={() => setFreeBilled(false)} />}
  </section>;
}

function FreeBilledTimeEntry({ projectId, teilprojekte, onSave, onClose }: { projectId: string; teilprojekte: string[]; onSave: (entry: BilledTimeEntry) => Promise<void>; onClose: () => void }) {
  const [datum, setDatum] = useState(todayInput());
  const [minutes, setMinutes] = useState(60);
  const [teilprojekt, setTeilprojekt] = useState('');
  const [hinweis, setHinweis] = useState('');
  const valid = minutes >= 1 && !!datum;
  return <div className="task-edit-overlay" role="dialog" aria-modal="true"><div className="task-edit-dialog"><div className="task-edit-dialog-head"><div><span>Frei erfasst</span><strong>Abgerechnete Zeit ohne Aufgaben- oder Kommunikationsbezug</strong></div></div><div className="field-grid"><div className="field"><label>Datum</label><input type="date" value={datum} onChange={(event) => setDatum(event.target.value)} /></div><div className="field"><label>Dauer (Minuten)</label><input type="number" min="1" step="1" value={minutes || ''} onChange={(event) => setMinutes(Math.max(0, Number(event.target.value) || 0))} /></div></div><div className="field"><label>Teilprojekt</label><input value={teilprojekt} onChange={(event) => setTeilprojekt(event.target.value)} list="frei-abgerechnet-teilprojekte" placeholder="Teilprojekt neu eingeben oder auswählen (optional)" /><datalist id="frei-abgerechnet-teilprojekte">{teilprojekte.map((name) => <option key={name} value={name} />)}</datalist></div><div className="field"><label>Hinweis</label><input value={hinweis} onChange={(event) => setHinweis(event.target.value)} placeholder="Optional, z. B. Grund der Abrechnung" /></div><div className="btn-row"><button className="btn" disabled={!valid} onClick={() => onSave({ id: uid(), projectId, datum, minutes, teilprojekt: teilprojekt.trim(), hinweis: hinweis.trim(), createdAt: new Date().toISOString() })}>Zeit speichern</button><button className="btn secondary" onClick={onClose}>Abbrechen</button></div></div></div>;
}

function ManualTimeEntry({ projectId, tasks, timeTypes, onSave, onClose }: { projectId: string; tasks: ProjectCache['tasks']; timeTypes: ProjectTimeType[]; onSave: (entry: TimeEntry) => Promise<void>; onClose: () => void }) {
  const [endedAt, setEndedAt] = useState(localInput(new Date()));
  const [minutes, setMinutes] = useState(60);
  const [assignment, setAssignment] = useState(`type:${timeTypes[0]?.id || ''}`);
  const [note, setNote] = useState('');
  const endDate = new Date(endedAt);
  const startDate = new Date(endDate.getTime() - Math.max(0, minutes) * 60000);
  const valid = minutes >= 1 && Number.isFinite(endDate.getTime()) && Number.isFinite(startDate.getTime());
  const selectedTaskId = assignment.startsWith('task:') ? assignment.slice(5) : null;
  const selectedType = assignment.startsWith('type:') ? timeTypes.find((type) => type.id === assignment.slice(5)) : undefined;
  return <div className="task-edit-overlay" role="dialog" aria-modal="true"><div className="task-edit-dialog"><div className="task-edit-dialog-head"><div><span>Manuelle Erfassung</span><strong>Zeit nachtragen</strong></div></div><div className="field-grid"><div className="field"><label>Bis</label><input type="datetime-local" step="1" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} /></div><div className="field"><label>Dauer (Minuten)</label><input type="number" min="1" step="1" value={minutes || ''} onChange={(event) => setMinutes(Math.max(0, Number(event.target.value) || 0))} /></div></div><div className="field"><label>Berechneter Start</label><input value={valid ? localInput(startDate).replace('T', ' ') : '—'} readOnly /></div><div className="field"><label>Zuordnung</label><select value={assignment} onChange={(e) => setAssignment(e.target.value)}><optgroup label="Projektzeit">{timeTypes.map((type) => <option value={`type:${type.id}`} key={type.id}>{type.name}</option>)}</optgroup><optgroup label="Aufgaben">{tasks.map((task) => <option value={`task:${task.id}`} key={task.id}>{task.nr} · {task.titel}</option>)}</optgroup></select></div><div className="field"><label>Notiz</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional, z. B. Workshop oder Abstimmung" /></div><div className="manual-time-duration">Start wird aus <strong>Bis − {minutes || 0} Minuten</strong> berechnet.</div><div className="btn-row"><button className="btn" disabled={!valid} onClick={() => onSave({ id: uid(), projectId, taskId: selectedTaskId, ...(selectedType ? { timeTypeId: selectedType.id, timeTypeName: selectedType.name } : {}), startedAt: startDate.toISOString(), endedAt: endDate.toISOString(), durationMinutes: minutes, note: note.trim(), createdAt: new Date().toISOString() })}>Zeit speichern</button><button className="btn secondary" onClick={onClose}>Abbrechen</button></div></div></div>;
}
