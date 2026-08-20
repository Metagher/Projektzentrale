import { useUiStore } from '../../store/uiStore';
import { todayStr } from '../../lib/format';
import type { DashboardData } from '../../store/dataStore';
import type { Project } from '../../types/entities';
import TaskListRow from './TaskListRow';
import OverdueBanner from './OverdueBanner';

export default function DashboardCockpit({ projects, data, openTaskList, openTask }: { projects: Project[]; data: DashboardData; openTaskList: (kind: 'overdue' | 'waiting') => void; openTask: (taskId: string) => void }) {
  const today = todayStr();
  const overdue = data.overdueTasks.slice(0, 6);
  const waitingByPerson = data.waitingTasks.reduce<Record<string, number>>((groups, task) => {
    const person = task.wartetAuf?.trim() || 'Nicht zugeordnet';
    groups[person] = (groups[person] || 0) + 1;
    return groups;
  }, {});
  const projectPulse = projects.filter((project) => project.status === 'aktiv').map((project) => {
    const open = data.openTasks.filter((task) => task.projectId === project.id).length;
    const waiting = data.waitingTasks.filter((task) => task.projectId === project.id).length;
    const late = data.overdueTasks.filter((task) => task.projectId === project.id).length;
    const nextDate = data.tasksWithDate.filter((task) => task.projectId === project.id && task.faelligAm >= today).map((task) => task.faelligAm).sort()[0];
    return { project, open, waiting, late, nextDate };
  }).filter((item) => item.open || item.waiting || item.late).sort((a, b) => b.late - a.late || b.waiting - a.waiting || b.open - a.open).slice(0, 8);

  return <section className="dashboard-cockpit">
    <div className="dashboard-section-head"><div><span className="eyebrow">Steuerung</span><h3>Handlungsbedarf</h3><p>Was Aufmerksamkeit braucht, bevor es im Tagesgeschäft untergeht.</p></div></div>
    <OverdueBanner count={data.overdueTasks.length} />
    <div className="dashboard-cockpit-grid">
      <section className="dashboard-panel dashboard-panel-wide">
        <div className="dashboard-panel-head"><div><strong>Überfällige Aufgaben</strong><small>{data.overdueTasks.length ? 'Nach ältestem Termin priorisiert' : 'Aktuell ist nichts überfällig'}</small></div>{data.overdueTasks.length > 0 && <button onClick={() => openTaskList('overdue')}>Alle anzeigen</button>}</div>
        {overdue.length ? overdue.map((task) => <TaskListRow key={task.id} task={task} onClick={() => openTask(task.id)} />) : <div className="dashboard-good-state">✓ Keine überfälligen Aufgaben</div>}
      </section>
      <section className="dashboard-panel">
        <div className="dashboard-panel-head"><div><strong>Wartet auf</strong><small>Blockaden nach Person</small></div><button onClick={() => openTaskList('waiting')}>Liste öffnen</button></div>
        <div className="waiting-summary">{Object.entries(waitingByPerson).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de')).map(([person, count]) => <button key={person} onClick={() => openTaskList('waiting')}><span>{person}</span><b>{count}</b></button>)}{!data.waitingTasks.length && <div className="dashboard-good-state">✓ Keine Blockaden</div>}</div>
      </section>
    </div>

    <div className="dashboard-section-head"><div><span className="eyebrow">Portfolio</span><h3>Projektlage</h3><p>Projekte mit offenem Arbeitsvorrat, Blockaden oder Terminrisiken.</p></div></div>
    <div className="project-pulse-grid">{projectPulse.map(({ project, open, waiting, late, nextDate }) => <button key={project.id} onClick={() => useUiStore.setState({ view: 'project', selectedId: project.id, activeTab: 'aufgaben' })}><strong>{project.name}</strong><small>{project.kunde}</small><div className="project-pulse-metrics"><span><b>{open}</b> offen</span><span><b>{waiting}</b> wartet</span><span className={late ? 'critical' : ''}><b>{late}</b> überfällig</span></div><em>{nextDate ? `Nächster Termin ${new Intl.DateTimeFormat('de-DE').format(new Date(`${nextDate}T12:00:00`))}` : 'Kein kommender Termin'}</em></button>)}</div>
    {!projectPulse.length && <div className="dashboard-good-state">Keine aktiven Projekte mit offenem Handlungsbedarf.</div>}
  </section>;
}
