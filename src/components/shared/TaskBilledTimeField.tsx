import { useState } from 'react';
import { fmtDate, todayStr, uid } from '../../lib/format';
import { formatDuration } from '../../lib/timeTracking';
import { summarizeBilledZeiten } from '../../lib/taskBilling';
import type { TaskBilledTimeEntry } from '../../types/entities';

export default function TaskBilledTimeField({ value, onChange }: { value: TaskBilledTimeEntry[]; onChange: (entries: TaskBilledTimeEntry[]) => void }) {
  const [minutes, setMinutes] = useState(60);
  const [datum, setDatum] = useState(todayStr());
  const entries = value.slice().sort((a, b) => b.datum.localeCompare(a.datum));
  const { billedMinutes } = summarizeBilledZeiten(value);

  function add() {
    if (minutes <= 0 || !datum) return;
    onChange([...value, { id: uid(), minutes, datum }]);
    setMinutes(60);
  }

  return <div className="field billed-time-fields task-billed-time-field">
    <label>Abgerechnete Zeit{billedMinutes > 0 ? ` · ${formatDuration(billedMinutes)} gesamt` : ''}</label>
    <div className="task-billed-time-add">
      <input type="number" min="1" step="1" value={minutes || ''} onChange={(event) => setMinutes(Math.max(0, Number(event.target.value) || 0))} placeholder="Minuten" />
      <input type="date" value={datum} onChange={(event) => setDatum(event.target.value)} />
      <button type="button" className="btn secondary small" disabled={minutes <= 0 || !datum} onClick={add}>Zeit hinzufügen</button>
    </div>
    {entries.length > 0 && <div className="task-billed-time-list">
      {entries.map((entry) => <div key={entry.id}>
        <span>{fmtDate(entry.datum)}</span>
        <strong>{formatDuration(entry.minutes)}</strong>
        <button type="button" className="icon-btn" aria-label={`Abgerechnete Zeit vom ${fmtDate(entry.datum)} löschen`} onClick={() => onChange(value.filter((item) => item.id !== entry.id))}>Löschen</button>
      </div>)}
    </div>}
    <small className="field-help">Beliebig viele Buchungen mit jeweils eigenem Datum, z. B. für mehrere abgerechnete Tage an derselben Aufgabe.</small>
  </div>;
}
