import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import { formatDuration, formatTimeStamp } from '../../lib/timeTracking';
import TimeTrackingButton from '../shared/TimeTrackingButton';

export default function TaskTimePanel({ projectId, taskId }: { projectId: string; taskId: string }) {
  const entries = useDataStore((s) => s.timeEntries).filter((entry) => entry.projectId === projectId && entry.taskId === taskId).slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt)); const deleteTimeEntry = useDataStore((s) => s.deleteTimeEntry); const confirm = useModalStore((s) => s.confirm); const total = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  async function remove(id: string, minutes: number) { if (await confirm(`Zeiteintrag über ${formatDuration(minutes)} löschen?`)) await deleteTimeEntry(id); }
  return <section className="task-time-panel"><header><div><span>Getrackte Aufgabenzeit</span><strong>{formatDuration(total)}</strong></div><TimeTrackingButton projectId={projectId} taskId={taskId} /></header>{entries.length === 0 ? <div className="analytics-empty-compact">Für diese Aufgabe wurde noch keine Zeit erfasst.</div> : <div className="task-time-entry-list">{entries.map((entry) => <article key={entry.id}><div><span>Start</span><strong>{formatTimeStamp(entry.startedAt)}</strong></div><div><span>Ende</span><strong>{formatTimeStamp(entry.endedAt)}</strong></div><b>{formatDuration(entry.durationMinutes)}</b><button className="icon-btn" onClick={() => remove(entry.id, entry.durationMinutes)}>Löschen</button>{entry.note && <small>{entry.note}</small>}</article>)}</div>}</section>;
}
