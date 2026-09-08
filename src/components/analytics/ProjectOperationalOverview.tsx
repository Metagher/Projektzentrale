import { useDataStore } from '../../store/dataStore';
import { todayStr } from '../../lib/format';
import { formatDuration } from '../../lib/timeTracking';
import type { Project, ProjectCache } from '../../types/entities';

export default function ProjectOperationalOverview({ project, data }: { project: Project; data: ProjectCache }) {
  const abrechnungen = useDataStore((s) => s.abrechnungen).filter((item) => item.projectId === project.id);
  const today = todayStr();
  const open = data.tasks.filter((task) => task.status !== 'erledigt');
  const completed = data.tasks.filter((task) => task.status === 'erledigt');
  const overdue = open.filter((task) => task.faelligAm && task.faelligAm < today);
  const waiting = open.filter((task) => task.status === 'wartet');
  const withoutDate = open.filter((task) => !task.faelligAm);
  const completionRate = data.tasks.length ? Math.round((completed.length / data.tasks.length) * 100) : 0;
  const subprojects = Array.from(new Set([
    ...data.subprojects.map((item) => item.name),
    ...data.tasks.map((task) => task.teilprojekt?.trim()),
    ...abrechnungen.map((item) => item.teilprojekt?.trim()),
  ].filter((value): value is string => !!value))).sort((a, b) => a.localeCompare(b, 'de'));

  return <section className="analytics-overview project-operational-overview">
    <div className="analytics-scope-label">Operative Projektsicht</div>
    <div className="analytics-kpi-grid project-kpis">
      <article><strong>{open.length}</strong><span>Offen</span><small>{completionRate}% insgesamt erledigt</small></article>
      <article className={overdue.length ? 'critical' : ''}><strong>{overdue.length}</strong><span>Überfällig</span><small>von {open.length} offenen Aufgaben</small></article>
      <article className={waiting.length ? 'attention' : ''}><strong>{waiting.length}</strong><span>Wartet</span><small>externe Abhängigkeiten</small></article>
      <article><strong>{withoutDate.length}</strong><span>Ohne Termin</span><small>noch nicht eingeplant</small></article>
      <article><strong>{completed.length}</strong><span>Erledigt</span><small>von {data.tasks.length} Aufgaben</small></article>
    </div>
    <div className="project-analysis-grid">
      <article className="analytics-detail-card"><div className="analytics-block-head"><div><h3>Teilprojekte</h3><p>Aufgabenverteilung und abgerechnete Stunden je Teilprojekt.</p></div></div>{subprojects.length === 0 ? <div className="analytics-empty-compact">Keine Teilprojekte verwendet.</div> : <div className="subproject-analysis-list">{subprojects.map((name) => { const tasks = data.tasks.filter((task) => task.teilprojekt?.trim() === name); const subOpen = tasks.filter((task) => task.status !== 'erledigt'); const billedMinutes = abrechnungen.filter((item) => item.teilprojekt?.trim() === name).reduce((sum, item) => sum + item.minutes, 0); return <div key={name}><strong>{name}</strong><span>{subOpen.length} offen · {tasks.length} gesamt · {formatDuration(billedMinutes)} abgerechnet</span><i style={{ width: `${tasks.length ? Math.round((subOpen.length / tasks.length) * 100) : 0}%` }} /></div>; })}</div>}</article>
    </div>
  </section>;
}
