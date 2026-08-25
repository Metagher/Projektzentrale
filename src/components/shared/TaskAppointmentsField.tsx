import { useState } from 'react';
import { fmtDate } from '../../lib/format';

export default function TaskAppointmentsField({ value, onChange }: { value: string[]; onChange: (dates: string[]) => void }) {
  const [nextDate, setNextDate] = useState('');
  const dates = Array.from(new Set(value.filter(Boolean))).sort();

  function add() {
    if (!nextDate || dates.includes(nextDate)) return;
    onChange([...dates, nextDate].sort());
    setNextDate('');
  }

  function update(index: number, date: string) {
    if (!date) return;
    onChange(Array.from(new Set(dates.map((item, itemIndex) => itemIndex === index ? date : item))).sort());
  }

  return <div className="field task-appointments-field">
    <label>Termine</label>
    <div className="task-appointment-add"><input type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} /><button type="button" className="btn secondary small" disabled={!nextDate || dates.includes(nextDate)} onClick={add}>Termin hinzufügen</button></div>
    {dates.length > 0 && <div className="task-appointment-list">{dates.map((date, index) => <div key={`${date}-${index}`}><input type="date" value={date} aria-label={`Termin ${fmtDate(date)} ändern`} onChange={(event) => update(index, event.target.value)} /><span>{fmtDate(date)}</span><button type="button" className="icon-btn" aria-label={`Termin ${fmtDate(date)} löschen`} onClick={() => onChange(dates.filter((_, itemIndex) => itemIndex !== index))}>Löschen</button></div>)}</div>}
    <small className="field-help">Beliebig viele Termine ohne Uhrzeit. Sie erscheinen zusätzlich zum Fälligkeitsdatum im Kalender.</small>
  </div>;
}
