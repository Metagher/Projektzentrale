import { useEffect, useMemo, useState } from 'react';
import { isoWeekInfo } from '../../lib/analytics';
import { formatDuration } from '../../lib/timeTracking';
import { isWorkday, localDateKey, type WorkdayOverrides } from '../../lib/workdays';
import type { Project, TimeEntry } from '../../types/entities';

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
}

const COLORS = ['#1f5f8b', '#b4532a', '#2f7d55', '#7b4fa3', '#a47a18', '#2b7a78', '#9b3d54', '#52616b'];
const fullDate = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
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

function DayDetail({ day, entries, projects, taskLabels }: { day: string; entries: TimeEntry[]; projects: Project[]; taskLabels: Record<string, string> }) {
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

export default function TimeAnalyticsOverview({ entries, projects = [], workdayOverrides, heading = 'Zeitauswertung', billedRows = [], taskLabels = {} }: Props) {
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
  const allDays = useMemo(() => Array.from(daily.keys()).sort((a, b) => b.localeCompare(a)), [daily]);
  const todayKey = localDateKey(new Date());
  const [selectedDay, setSelectedDay] = useState(allDays.includes(todayKey) ? todayKey : allDays[0] || '');
  useEffect(() => {
    if (!allDays.length) setSelectedDay('');
    else if (!allDays.includes(selectedDay)) setSelectedDay(allDays.includes(todayKey) ? todayKey : allDays[0]);
  }, [allDays, selectedDay, todayKey]);

  const workdays: { key: string; date: Date; minutes: number }[] = [];
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  while (workdays.length < 15) {
    if (isWorkday(cursor, workdayOverrides)) {
      const key = localDateKey(cursor);
      workdays.push({ key, date: new Date(cursor), minutes: dailyMinutes.get(key) || 0 });
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  const weeks: { key: string; minutes: number }[] = [];
  const weekCursor = new Date();
  weekCursor.setHours(12, 0, 0, 0);
  while (weeks.length < 12) {
    const key = weekKey(weekCursor);
    if (!weeks.some((item) => item.key === key)) weeks.push({ key, minutes: weekly.get(key) || 0 });
    weekCursor.setDate(weekCursor.getDate() - 7);
  }

  const today = dailyMinutes.get(todayKey) || 0;
  const currentWeek = weekly.get(weekKey(new Date())) || 0;
  const total = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const activeDays = [...dailyMinutes.entries()].filter(([key, minutes]) => minutes > 0 && isWorkday(new Date(`${key}T12:00:00`), workdayOverrides)).map(([, minutes]) => minutes);
  const average = activeDays.length ? activeDays.reduce((sum, minutes) => sum + minutes, 0) / activeDays.length : 0;
  const maxDay = Math.max(1, ...workdays.map((item) => item.minutes));
  const maxWeek = Math.max(1, ...weeks.map((item) => item.minutes));
  const billedTaskTotal = billedRows.reduce((sum, row) => sum + row.taskMinutes, 0);
  const billedCommunicationTotal = billedRows.reduce((sum, row) => sum + row.communicationMinutes, 0);
  const billedByProject = new Map(billedRows.map((row) => [row.projectId, row]));
  const projectRows = projects.map((project) => ({ project, minutes: entries.filter((entry) => entry.projectId === project.id).reduce((sum, entry) => sum + entry.durationMinutes, 0), billed: billedByProject.get(project.id) }))
    .filter((row) => row.minutes > 0 || row.billed?.taskMinutes || row.billed?.communicationMinutes).sort((a, b) => b.minutes - a.minutes);

  return <section className="time-analytics-overview">
    <div className="analytics-section-intro"><div className="analytics-scope-label">Arbeitszeit</div><h3>{heading}</h3><p>Getrackte Zeiten werden tagesgenau ausgewertet. Abgerechnete Zeiten stehen separat und fließen in keine Tracking-Kennzahl ein.</p></div>
    <div className="analytics-kpi-grid"><article><strong>{formatDuration(today)}</strong><span>Heute</span><small>aktueller Arbeitstag</small></article><article><strong>{formatDuration(currentWeek)}</strong><span>Aktuelle KW</span><small>{weekKey(new Date())}</small></article><article><strong>{formatDuration(total)}</strong><span>Getrackte Gesamtzeit</span><small>{entries.length} Buchungen</small></article><article><strong>{formatDuration(average)}</strong><span>Ø pro Arbeitstag</span><small>{activeDays.length} Tage mit Buchung</small></article></div>
    {(billedTaskTotal > 0 || billedCommunicationTotal > 0) && <section className="billed-time-summary"><div><span className="analytics-scope-label">Zusatzwert · nicht verrechnet</span><h4>Abgerechnete Zeiten</h4></div><div><article><span>Aus Aufgaben</span><strong>{formatDuration(billedTaskTotal)}</strong></article><article><span>Aus Kommunikation</span><strong>{formatDuration(billedCommunicationTotal)}</strong></article><article><span>Abgerechnet gesamt</span><strong>{formatDuration(billedTaskTotal + billedCommunicationTotal)}</strong></article></div></section>}
    {allDays.length > 0 && <section className="daily-explorer analytics-detail-card"><div className="analytics-block-head"><div><h3>Einzelne Tage öffnen</h3><p>Jeder Tag mit Buchungen – inklusive Tagesverlauf und Projektanteilen.</p></div><select value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)}>{allDays.map((day) => <option key={day} value={day}>{fullDate.format(new Date(`${day}T12:00:00`))} · {formatDuration(dailyMinutes.get(day) || 0)}</option>)}</select></div><div className="daily-day-list">{allDays.map((day) => <button type="button" key={day} className={selectedDay === day ? 'active' : ''} onClick={() => setSelectedDay(day)}><span>{shortDate.format(new Date(`${day}T12:00:00`))}</span><strong>{formatDuration(dailyMinutes.get(day) || 0)}</strong></button>)}</div>{selectedDay && <DayDetail day={selectedDay} entries={daily.get(selectedDay) || []} projects={projects} taskLabels={taskLabels} />}</section>}
    <div className="time-analysis-columns"><article className="analytics-detail-card"><div className="analytics-block-head"><div><h3>Letzte Arbeitstage</h3><p>Die letzten 15 konfigurierten Arbeitstage.</p></div></div><div className="time-period-list">{workdays.map((item) => <button type="button" key={item.key} onClick={() => daily.has(item.key) && setSelectedDay(item.key)} disabled={!daily.has(item.key)}><span>{shortDate.format(item.date)}</span><i><b style={{ width: `${item.minutes / maxDay * 100}%` }} /></i><strong>{formatDuration(item.minutes)}</strong></button>)}</div></article><article className="analytics-detail-card"><div className="analytics-block-head"><div><h3>Nach Kalenderwoche</h3><p>Die letzten zwölf ISO-Kalenderwochen.</p></div></div><div className="time-period-list">{weeks.map((item) => <div key={item.key}><span>{item.key}</span><i><b style={{ width: `${item.minutes / maxWeek * 100}%` }} /></i><strong>{formatDuration(item.minutes)}</strong></div>)}</div></article></div>
    {projectRows.length > 0 && <div className="analytics-table-wrap time-project-table"><table className="an-table"><thead><tr><th>Projekt</th><th>Kunde</th><th>Getrackte Zeit</th><th>Abgerechnet · Aufgaben</th><th>Abgerechnet · Kommunikation</th></tr></thead><tbody>{projectRows.map(({ project, minutes, billed }) => <tr key={project.id}><td><i className="project-color-dot" style={{ background: projectColor(project.id, projects) }} /><strong>{project.name}</strong></td><td>{project.kunde || '–'}</td><td>{formatDuration(minutes)}</td><td>{formatDuration(billed?.taskMinutes || 0)}</td><td>{formatDuration(billed?.communicationMinutes || 0)}</td></tr>)}</tbody></table></div>}
  </section>;
}
