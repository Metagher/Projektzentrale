import { useEffect, useMemo, useState } from 'react';
import { isoWeekInfo } from '../../lib/analytics';
import { formatDuration } from '../../lib/timeTracking';
import { isWorkday, localDateKey, type WorkdayOverrides } from '../../lib/workdays';
import type { Project, TimeEntry } from '../../types/entities';
import { useModalStore } from '../../store/modalStore';

export interface BilledTimeRow {
  projectId: string;
  taskMinutes: number;
  communicationMinutes: number;
}

interface Props {
  entries: TimeEntry[];
  projects?: Project[];
  workdayOverrides: WorkdayOverrides;
  heading?: string;
  billedRows?: BilledTimeRow[];
  taskLabels?: Record<string, string>;
  onSaveEntry?: (entry: TimeEntry) => Promise<void>;
  onDeleteEntry?: (id: string) => Promise<void>;
}

const COLORS = ['#1f5f8b', '#b4532a', '#2f7d55', '#7b4fa3', '#a47a18', '#2b7a78', '#9b3d54', '#52616b'];
const fullDate = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
const timeOnly = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

function weekKey(value: string | Date) {
  const info = isoWeekInfo(value instanceof Date ? value.toISOString() : value);
  return `${info.year}-KW${String(info.week).padStart(2, '0')}`;
}

function projectColor(projectId: string, projects: Project[]) {
  const index = projects.findIndex((project) => project.id === projectId);
  if (index >= 0) return COLORS[index % COLORS.length];
  let hash = 0;
  for (const char of projectId) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

function projectName(projectId: string, projects: Project[]) {
  return projects.find((project) => project.id === projectId)?.name || 'Unbekanntes Projekt';
}

function minuteOfDay(value: string) {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

function calendarWeekDays(reference: Date): string[] {
  const monday = new Date(reference);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return localDateKey(date);
  });
}

function localInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 19);
}

function TimeEntryEditor({ entry, projects, taskLabels, onSave, onClose }: { entry: TimeEntry; projects: Project[]; taskLabels: Record<string, string>; onSave: (entry: TimeEntry) => Promise<void>; onClose: () => void }) {
  const [endedAt, setEndedAt] = useState(localInput(new Date(entry.endedAt)));
  const [minutes, setMinutes] = useState(Math.max(1, Math.round(entry.durationMinutes)));
  const [note, setNote] = useState(entry.note || '');
  const [saving, setSaving] = useState(false);
  const endDate = new Date(endedAt);
  const startDate = new Date(endDate.getTime() - Math.max(0, minutes) * 60000);
  const valid = minutes >= 1 && Number.isFinite(endDate.getTime()) && Number.isFinite(startDate.getTime());

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    await onSave({ ...entry, startedAt: startDate.toISOString(), endedAt: endDate.toISOString(), durationMinutes: minutes, note: note.trim() });
    setSaving(false);
    onClose();
  }

  return <div className="task-edit-overlay" role="dialog" aria-modal="true" aria-label="Zeiteintrag bearbeiten"><div className="task-edit-dialog"><div className="task-edit-dialog-head"><div><span>Zeiteintrag</span><strong>Eintrag bearbeiten</strong></div></div><div className="field-grid"><div className="field"><label>Bis</label><input type="datetime-local" step="1" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} /></div><div className="field"><label>Dauer (Minuten)</label><input type="number" min="1" step="1" value={minutes || ''} onChange={(event) => setMinutes(Math.max(0, Number(event.target.value) || 0))} /></div></div><div className="field"><label>Berechneter Start</label><input value={valid ? localInput(startDate).replace('T', ' ') : '—'} readOnly /></div><div className="field"><label>Zuordnung</label><input value={`${projectName(entry.projectId, projects)} · ${entry.taskId ? (taskLabels[entry.taskId] || 'Aufgabenzeit') : 'Allgemeine Projektzeit'}`} readOnly /></div><div className="field"><label>Notiz</label><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional, z. B. Workshop oder Abstimmung" /></div><div className="btn-row"><button className="btn" disabled={!valid || saving} onClick={save}>{saving ? 'Speichert…' : 'Änderungen speichern'}</button><button className="btn secondary" onClick={onClose}>Abbrechen</button></div></div></div>;
}

function DayDetail({ day, entries, projects, taskLabels, onEdit, onDelete }: { day: string; entries: TimeEntry[]; projects: Project[]; taskLabels: Record<string, string>; onEdit?: (entry: TimeEntry) => void; onDelete?: (entry: TimeEntry) => void }) {
  const sorted = entries.slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const total = sorted.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const perProject = Array.from(sorted.reduce((map, entry) => map.set(entry.projectId, (map.get(entry.projectId) || 0) + entry.durationMinutes), new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]);
  let cursor = 0;
  const stops = perProject.map(([projectId, minutes]) => {
    const start = cursor;
    cursor += total ? minutes / total * 100 : 0;
    return `${projectColor(projectId, projects)} ${start}% ${cursor}%`;
  }).join(', ');

  return <div className="day-detail">
    <header><div><span>Tagesübersicht</span><h4>{fullDate.format(new Date(`${day}T12:00:00`))}</h4></div><strong>{formatDuration(total)}</strong></header>
    <div className="day-detail-grid">
      <section className="day-timeline" aria-label="Tagesverlauf">
        <div className="day-hour-scale"><span>00</span><span>06</span><span>12</span><span>18</span><span>24 Uhr</span></div>
        {sorted.map((entry) => {
          const start = Math.max(0, Math.min(1440, minuteOfDay(entry.startedAt)));
          const width = Math.max(0.35, Math.min(1440 - start, entry.durationMinutes) / 1440 * 100);
          return <article key={entry.id}>
            <div className="day-entry-label"><strong>{timeOnly.format(new Date(entry.startedAt))}–{timeOnly.format(new Date(entry.endedAt))}</strong><span>{projectName(entry.projectId, projects)}</span><small>{entry.taskId ? (taskLabels[entry.taskId] || 'Aufgabenzeit') : 'Allgemeine Projektzeit'}{entry.note ? ` · ${entry.note}` : ''}</small></div>
            <div className="day-entry-track"><i style={{ left: `${start / 1440 * 100}%`, width: `${width}%`, background: projectColor(entry.projectId, projects) }} title={`${projectName(entry.projectId, projects)} · ${formatDuration(entry.durationMinutes)}`} /></div>
            <b>{formatDuration(entry.durationMinutes)}</b>
            {(onEdit || onDelete) && <div className="day-entry-actions">{onEdit && <button type="button" className="icon-btn edit" onClick={() => onEdit(entry)}>Bearbeiten</button>}{onDelete && <button type="button" className="icon-btn" onClick={() => onDelete(entry)}>Löschen</button>}</div>}
          </article>;
        })}
      </section>
      <aside className="day-project-share">
        <div className="day-donut" style={{ background: stops ? `conic-gradient(${stops})` : '#eee' }}><span>{formatDuration(total)}</span></div>
        <div className="day-project-legend">{perProject.map(([projectId, minutes]) => <div key={projectId}><i style={{ background: projectColor(projectId, projects) }} /><span>{projectName(projectId, projects)}</span><strong>{formatDuration(minutes)}</strong><small>{total ? Math.round(minutes / total * 100) : 0}%</small></div>)}</div>
      </aside>
    </div>
  </div>;
}

export default function TimeAnalyticsOverview({ entries, projects = [], workdayOverrides, heading = 'Zeitauswertung', billedRows = [], taskLabels = {}, onSaveEntry, onDeleteEntry }: Props) {
  const confirm = useModalStore((state) => state.confirm);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [minimumDuration, setMinimumDuration] = useState(5);
  const daily = useMemo(() => {
    const map = new Map<string, TimeEntry[]>();
    entries.forEach((entry) => {
      const key = localDateKey(new Date(entry.startedAt));
      map.set(key, [...(map.get(key) || []), entry]);
    });
    return map;
  }, [entries]);
  const dailyMinutes = new Map(Array.from(daily.entries()).map(([key, items]) => [key, items.reduce((sum, entry) => sum + entry.durationMinutes, 0)]));
  const weekly = new Map<string, number>();
  entries.forEach((entry) => weekly.set(weekKey(entry.startedAt), (weekly.get(weekKey(entry.startedAt)) || 0) + entry.durationMinutes));
  const rawAllDays = useMemo(() => Array.from(daily.keys()).sort((a, b) => b.localeCompare(a)), [daily]);
  const todayKey = localDateKey(new Date());
  const currentWeekKey = weekKey(new Date());
  const weekOptions = useMemo(() => Array.from(new Set([currentWeekKey, ...entries.map((entry) => weekKey(entry.startedAt))])).sort((a, b) => b.localeCompare(a)), [currentWeekKey, entries]);
  const [selectedWeekKey, setSelectedWeekKey] = useState(currentWeekKey);
  const selectedWeekReference = useMemo(() => {
    if (selectedWeekKey === currentWeekKey) return new Date(`${todayKey}T12:00:00`);
    const entry = entries.find((item) => weekKey(item.startedAt) === selectedWeekKey);
    return entry ? new Date(entry.startedAt) : new Date(`${todayKey}T12:00:00`);
  }, [currentWeekKey, entries, selectedWeekKey, todayKey]);
  const selectedWeekDays = useMemo(() => calendarWeekDays(selectedWeekReference), [selectedWeekReference]);
  const [selectedDay, setSelectedDay] = useState(rawAllDays.includes(todayKey) ? todayKey : rawAllDays[0] || '');
  useEffect(() => {
    const bookedDays = selectedWeekDays.filter((day) => daily.has(day));
    if (selectedWeekDays.includes(selectedDay) && daily.has(selectedDay)) return;
    setSelectedDay(selectedWeekDays.includes(todayKey) && daily.has(todayKey) ? todayKey : bookedDays[0] || '');
  }, [daily, selectedDay, selectedWeekDays, todayKey]);
  const selectedDayEntries = selectedDay ? daily.get(selectedDay) || [] : [];
  const visibleSelectedDayEntries = selectedDayEntries.filter((entry) => entry.durationMinutes >= minimumDuration);

  const today = dailyMinutes.get(todayKey) || 0;
  const currentWeek = weekly.get(weekKey(new Date())) || 0;
  const total = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const activeDays = [...dailyMinutes.entries()].filter(([key, minutes]) => minutes > 0 && isWorkday(new Date(`${key}T12:00:00`), workdayOverrides)).map(([, minutes]) => minutes);
  const average = activeDays.length ? activeDays.reduce((sum, minutes) => sum + minutes, 0) / activeDays.length : 0;
  const billedTaskTotal = billedRows.reduce((sum, row) => sum + row.taskMinutes, 0);
  const billedCommunicationTotal = billedRows.reduce((sum, row) => sum + row.communicationMinutes, 0);
  const billedByProject = new Map(billedRows.map((row) => [row.projectId, row]));
  const projectRows = projects.map((project) => ({ project, minutes: entries.filter((entry) => entry.projectId === project.id).reduce((sum, entry) => sum + entry.durationMinutes, 0), billed: billedByProject.get(project.id) }))
    .filter((row) => row.minutes > 0 || row.billed?.taskMinutes || row.billed?.communicationMinutes).sort((a, b) => b.minutes - a.minutes);

  return <section className="time-analytics-overview">
    <div className="analytics-section-intro"><div className="analytics-scope-label">Arbeitszeit</div><h3>{heading}</h3><p>Getrackte Zeiten werden tagesgenau ausgewertet. Abgerechnete Zeiten stehen separat und fließen in keine Tracking-Kennzahl ein.</p></div>
    <div className="analytics-kpi-grid"><article><strong>{formatDuration(today)}</strong><span>Heute</span><small>aktueller Arbeitstag</small></article><article><strong>{formatDuration(currentWeek)}</strong><span>Aktuelle KW</span><small>{weekKey(new Date())}</small></article><article><strong>{formatDuration(total)}</strong><span>Getrackte Gesamtzeit</span><small>{entries.length} Buchungen</small></article><article><strong>{formatDuration(average)}</strong><span>Ø pro Arbeitstag</span><small>{activeDays.length} Tage mit Buchung</small></article></div>
    {(billedTaskTotal > 0 || billedCommunicationTotal > 0) && <section className="billed-time-summary"><div><span className="analytics-scope-label">Zusatzwert · nicht verrechnet</span><h4>Abgerechnete Zeiten</h4></div><div><article><span>Aus Aufgaben</span><strong>{formatDuration(billedTaskTotal)}</strong></article><article><span>Aus Kommunikation</span><strong>{formatDuration(billedCommunicationTotal)}</strong></article><article><span>Abgerechnet gesamt</span><strong>{formatDuration(billedTaskTotal + billedCommunicationTotal)}</strong></article></div></section>}
    {entries.length > 0 && <section className="daily-explorer analytics-detail-card">
      <div className="analytics-block-head"><div><h3>Einzelne Tage öffnen</h3><p>Kalenderwoche auswählen und anschließend einen Tag öffnen.</p></div><label className="week-filter"><span>Kalenderwoche</span><select value={selectedWeekKey} onChange={(event) => setSelectedWeekKey(event.target.value)}>{weekOptions.map((key) => <option key={key} value={key}>{key} · {formatDuration(weekly.get(key) || 0)}</option>)}</select></label></div>
      <div className="current-week-day-grid">{selectedWeekDays.map((day) => {
        const minutes = dailyMinutes.get(day) || 0;
        const bookingCount = daily.get(day)?.length || 0;
        return <button type="button" key={day} className={`${selectedDay === day ? 'active' : ''}${day === todayKey ? ' today' : ''}`} disabled={!bookingCount} onClick={() => setSelectedDay(day)}><span>{new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(new Date(`${day}T12:00:00`))}</span><b>{new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(new Date(`${day}T12:00:00`))}</b><strong>{formatDuration(minutes)}</strong><small>{bookingCount ? `${bookingCount} Buchung${bookingCount === 1 ? '' : 'en'}` : 'Keine Buchung'}</small></button>;
      })}</div>
      {selectedDay && <div className="daily-duration-filter"><div><label htmlFor="daily-minimum-duration">Mindestdauer der angezeigten Einträge</label><div><input id="daily-minimum-duration" type="number" min="0" step="1" value={minimumDuration} onChange={(event) => setMinimumDuration(Math.max(0, Number(event.target.value) || 0))} /><span>Minuten</span></div></div><div className="daily-duration-presets"><button type="button" className={minimumDuration === 0 ? 'active' : ''} onClick={() => setMinimumDuration(0)}>Alle</button>{[5, 10, 15, 30].map((minutes) => <button type="button" key={minutes} className={minimumDuration === minutes ? 'active' : ''} onClick={() => setMinimumDuration(minutes)}>ab {minutes} Min.</button>)}</div><strong>{visibleSelectedDayEntries.length} von {selectedDayEntries.length} Einträgen sichtbar</strong></div>}
      {selectedDay && visibleSelectedDayEntries.length > 0 ? <DayDetail day={selectedDay} entries={visibleSelectedDayEntries} projects={projects} taskLabels={taskLabels} onEdit={onSaveEntry ? setEditingEntry : undefined} onDelete={onDeleteEntry ? (entry) => void (async () => { if (await confirm(`Zeiteintrag über ${formatDuration(entry.durationMinutes)} löschen?`)) await onDeleteEntry(entry.id); })() : undefined} /> : <div className="daily-filter-empty">{selectedDay ? 'Keine Buchung erfüllt für diesen Tag die gewählte Mindestdauer.' : 'In dieser Kalenderwoche gibt es keine Buchungen.'}</div>}
    </section>}
    {projectRows.length > 0 && <div className="analytics-table-wrap time-project-table"><table className="an-table"><thead><tr><th>Projekt</th><th>Kunde</th><th>Getrackte Zeit</th><th>Abgerechnet · Aufgaben</th><th>Abgerechnet · Kommunikation</th></tr></thead><tbody>{projectRows.map(({ project, minutes, billed }) => <tr key={project.id}><td><i className="project-color-dot" style={{ background: projectColor(project.id, projects) }} /><strong>{project.name}</strong></td><td>{project.kunde || '–'}</td><td>{formatDuration(minutes)}</td><td>{formatDuration(billed?.taskMinutes || 0)}</td><td>{formatDuration(billed?.communicationMinutes || 0)}</td></tr>)}</tbody></table></div>}
    {editingEntry && onSaveEntry && <TimeEntryEditor key={editingEntry.id} entry={editingEntry} projects={projects} taskLabels={taskLabels} onSave={onSaveEntry} onClose={() => setEditingEntry(null)} />}
  </section>;
}
