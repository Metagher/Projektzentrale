import { todayStr } from '../../lib/format';
import { useUiStore } from '../../store/uiStore';
import type { TaskWithMeta } from '../../store/dataStore';
import type { Project } from '../../types/entities';

export default function GlobalPortfolioOverview({ projects, tasks }: { projects: Project[]; tasks: TaskWithMeta[] }) {
  const today = todayStr();
  const activeProjects = projects.filter((project) => project.status === 'aktiv');
  const open = tasks.filter((task) => task.status !== 'erledigt');
  const overdue = open.filter((task) => task.faelligAm && task.faelligAm < today);
  const waiting = open.filter((task) => task.status === 'wartet');
  const rows = projects.map((project) => {
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const projectOpen = projectTasks.filter((task) => task.status !== 'erledigt');
    return {
      project,
      open: projectOpen.length,
      overdue: projectOpen.filter((task) => task.faelligAm && task.faelligAm < today).length,
      waiting: projectOpen.filter((task) => task.status === 'wartet').length,
      completed: projectTasks.filter((task) => task.status === 'erledigt').length,
    };
  }).sort((a, b) => b.overdue - a.overdue || b.waiting - a.waiting || b.open - a.open);

  return <section className="analytics-overview global-portfolio-overview">
    <div className="analytics-scope-label">Projektübergreifende Steuerung</div>
    <div className="analytics-kpi-grid">
      <article><strong>{activeProjects.length}</strong><span>Aktive Projekte</span><small>von {projects.length} insgesamt</small></article>
      <article><strong>{open.length}</strong><span>Offene Aufgaben</span><small>über alle Projekte</small></article>
      <article className={overdue.length ? 'critical' : ''}><strong>{overdue.length}</strong><span>Überfällig</span><small>sofortiger Handlungsbedarf</small></article>
      <article className={waiting.length ? 'attention' : ''}><strong>{waiting.length}</strong><span>Wartet auf andere</span><small>externe Abhängigkeiten</small></article>
    </div>
    <div className="analytics-block-head"><div><h3>Projektportfolio</h3><p>Nach überfälligen und blockierten Aufgaben priorisiert.</p></div></div>
    {rows.length === 0 ? <div className="empty-state"><h3>Noch keine Projekte</h3></div> : <div className="analytics-table-wrap"><table className="an-table portfolio-table"><thead><tr><th>Projekt</th><th>Status</th><th>Offen</th><th>Überfällig</th><th>Wartet</th><th>Erledigt</th></tr></thead><tbody>{rows.map((row) => <tr key={row.project.id} onClick={() => useUiStore.setState({ view: 'project', selectedId: row.project.id, activeTab: 'auswertung' })}><td><strong>{row.project.name}</strong><small>{row.project.kunde || 'Kein Kunde'}</small></td><td><span className={`stamp ${row.project.status}`}>{row.project.status}</span></td><td>{row.open}</td><td className={row.overdue ? 'metric-critical' : ''}>{row.overdue}</td><td className={row.waiting ? 'metric-attention' : ''}>{row.waiting}</td><td>{row.completed}</td></tr>)}</tbody></table></div>}
  </section>;
}
