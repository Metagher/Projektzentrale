import { useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import { formatDuration, formatTimeStamp } from '../../lib/timeTracking';
import { formatEuro } from '../../lib/money';
import { fmtDate } from '../../lib/format';
import { abrechnungStatus, ABRECHNUNG_STATUS_LABELS } from '../../lib/abrechnungStatus';
import TimeTrackingButton from '../shared/TimeTrackingButton';
import AbrechnungForm from '../shared/AbrechnungForm';
import type { Abrechnung } from '../../types/entities';

export default function TaskTimePanel({ projectId, taskId }: { projectId: string; taskId: string }) {
  const entries = useDataStore((s) => s.timeEntries).filter((entry) => entry.projectId === projectId && entry.taskId === taskId).slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt)); const deleteTimeEntry = useDataStore((s) => s.deleteTimeEntry); const confirm = useModalStore((s) => s.confirm); const total = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const project = useDataStore((s) => s.projects)?.find((item) => item.id === projectId);
  const abrechnungen = useDataStore((s) => s.abrechnungen).filter((item) => item.taskId === taskId).sort((a, b) => b.datum.localeCompare(a.datum));
  const saveAbrechnung = useDataStore((s) => s.saveAbrechnung);
  const deleteAbrechnung = useDataStore((s) => s.deleteAbrechnung);
  const [editingAbrechnung, setEditingAbrechnung] = useState<Abrechnung | null | 'new'>(null);
  const provisionTotal = abrechnungen.reduce((sum, item) => sum + item.provisionCents, 0);

  async function remove(id: string, minutes: number) { if (await confirm(`Zeiteintrag über ${formatDuration(minutes)} löschen?`)) await deleteTimeEntry(id); }

  return <>
    <section className="task-time-panel"><header><div><span>Getrackte Aufgabenzeit</span><strong>{formatDuration(total)}</strong></div><TimeTrackingButton projectId={projectId} taskId={taskId} /></header>{entries.length === 0 ? <div className="analytics-empty-compact">Für diese Aufgabe wurde noch keine Zeit erfasst.</div> : <div className="task-time-entry-list">{entries.map((entry) => <article key={entry.id}><div><span>Start</span><strong>{formatTimeStamp(entry.startedAt)}</strong></div><div><span>Ende</span><strong>{formatTimeStamp(entry.endedAt)}</strong></div><b>{formatDuration(entry.durationMinutes)}</b><button className="icon-btn" onClick={() => remove(entry.id, entry.durationMinutes)}>Löschen</button>{entry.note && <small>{entry.note}</small>}</article>)}</div>}</section>
    <section className="task-time-panel" style={{ marginTop: 14 }}>
      <header><div><span>Abrechnung</span><strong>{abrechnungen.length ? formatEuro(provisionTotal) : '–'}</strong></div><button className="btn small" onClick={() => setEditingAbrechnung('new')}>+ Abrechnung erfassen</button></header>
      {abrechnungen.length === 0 ? <div className="analytics-empty-compact">Für diese Aufgabe wurde noch keine Abrechnung erfasst.</div> : <div className="task-time-entry-list">
        {abrechnungen.map((item) => <article key={item.id} style={{ cursor: 'pointer' }} onClick={() => setEditingAbrechnung(item)}>
          <div><span>Datum</span><strong>{fmtDate(item.datum)}</strong></div>
          <div><span>Art</span><strong>{item.art}</strong></div>
          <b>{formatEuro(item.provisionCents)}</b>
          <span className={`badge ${abrechnungStatus(item)}`}>{ABRECHNUNG_STATUS_LABELS[abrechnungStatus(item)]}</span>
        </article>)}
      </div>}
    </section>
    {editingAbrechnung && <AbrechnungForm
      entry={editingAbrechnung === 'new' ? undefined : editingAbrechnung}
      fixedProjectId={projectId}
      fixedKunde={project?.kunde}
      fixedTaskId={taskId}
      onSave={async (entry) => { await saveAbrechnung(entry); setEditingAbrechnung(null); }}
      onDelete={editingAbrechnung !== 'new' ? async () => { await deleteAbrechnung((editingAbrechnung as Abrechnung).id); setEditingAbrechnung(null); } : undefined}
      onClose={() => setEditingAbrechnung(null)}
    />}
  </>;
}
