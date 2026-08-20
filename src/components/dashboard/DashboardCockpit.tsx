import { useUiStore } from '../../store/uiStore';
import { todayStr } from '../../lib/format';
import type { DashboardData } from '../../store/dataStore';
import type { Project } from '../../types/entities';

export default function DashboardCockpit({ projects, data }: { projects: Project[]; data: DashboardData }) {
  const today = todayStr();
  const projectPulse = projects.filter((project) => project.status === 'aktiv').map((project) => {
    const open = data.openTasks.filter((task) => task.projectId === project.id).length;
    const waiting = data.waitingTasks.filter((task) => task.projectId === project.id).length;
    const late = data.overdueTasks.filter((task) => task.projectId === project.id).length;
    const nextDate = data.tasksWithDate.filter((task) => task.projectId === project.id && task.faelligAm >= today).map((task) => task.faelligAm).sort()[0];
    return { project, open, waiting, late, nextDate };
  }).filter((item) => item.open || item.waiting || item.late).sort((a, b) => b.late - a.late || b.waiting - a.waiting || b.open - a.open).slice(0, 8);

  return <section className="dashboard-cockpit">
    <div className="dashboard-section-head"><div><span className="eyebrow">Portfolio</span><h3>Projektlage</h3><p>Projekte mit offenem Arbeitsvorrat, Blockaden oder Terminrisiken.</p></div></div>
    <div className="project-pulse-grid">{projectPulse.map(({ project, open, waiting, late, nextDate }) => <button key={project.id} onClick={() => useUiStore.setState({ view: 'project', selectedId: project.id, activeTab: 'aufgaben' })}><strong>{project.name}</strong><small>{project.kunde}</small><div className="project-pulse-metrics"><span><b>{open}</b> offen</span><span><b>{waiting}</b> wartet</span><span className={late ? 'critical' : ''}><b>{late}</b> überfällig</span></div><em>{nextDate ? `Nächster Termin ${new Intl.DateTimeFormat('de-DE').format(new Date(`${nextDate}T12:00:00`))}` : 'Kein kommender Termin'}</em></button>)}</div>
    {!projectPulse.length && <div className="dashboard-good-state">Keine aktiven Projekte mit offenem Handlungsbedarf.</div>}
  </section>;
}
