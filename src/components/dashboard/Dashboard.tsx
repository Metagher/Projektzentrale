import { useEffect, useState } from 'react';
import { useDataStore, type TaskWithMeta } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { getDashboardSummary } from '../../lib/dashboardModel';
import DailyBriefingCard from './DailyBriefingCard';
import DailyPlanner from './DailyPlanner';
import DashboardCockpit from './DashboardCockpit';
import TaskRows from './TaskRows';
import InlineEditTaskRow from './InlineEditTaskRow';
import OverdueBanner from './OverdueBanner';
import GlobalProjectNotes from './GlobalProjectNotes';
import MilestonesList from './MilestonesList';
import type { TaskColor } from '../../types/entities';

type ActionFilter = 'all' | 'active' | 'overdue' | 'waiting';

export default function Dashboard() {
  const projects = useDataStore((state) => state.projects);
  const dashboardData = useDataStore((state) => state.dashboardData);
  const loadDashboardData = useDataStore((state) => state.loadDashboardData);
  const colorOrder = useDataStore((state) => state.taskColorOrder);
  const colorLabels = useDataStore((state) => state.taskColorLabels);
  const dashboardEditingTaskId = useUiStore((state) => state.dashboardEditingTaskId);
  const setDashboardEditingTaskId = useUiStore((state) => state.setDashboardEditingTaskId);
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [colorFilter, setColorFilter] = useState<TaskColor | ''>('');

  useEffect(() => { if (projects) loadDashboardData(); }, [projects, loadDashboardData]);

  if (!projects || !dashboardData) return <div className="main-inner"><div className="loading-note">Lade Dashboard…</div></div>;

  const summary = getDashboardSummary(projects, dashboardData);
  const allTasks = uniqueTasks([
    ...dashboardData.openTasks, ...dashboardData.waitingTasks, ...dashboardData.completedTasks,
    ...dashboardData.tasksNoDate, ...dashboardData.tasksWithDate,
  ]);
  const editingTask = allTasks.find((task) => task.id === dashboardEditingTaskId);
  const unfinishedTasks = allTasks.filter((task) => task.status !== 'erledigt');
  const activeTasks = unfinishedTasks.filter((task) => task.status === 'offen' || task.status === 'in Arbeit');
  const actionTasks = actionFilter === 'active' ? activeTasks : actionFilter === 'overdue' ? dashboardData.overdueTasks : actionFilter === 'waiting' ? dashboardData.waitingTasks : unfinishedTasks;
  const filteredTasks = actionTasks.filter((task) => !colorFilter || task.farbe === colorFilter);

  return <div className="main-inner">
    <header className="page-header"><div className="eyebrow">Arbeitsbereich</div><h2>Guten Überblick.</h2><p>Alle Projekte, offenen Aufgaben und anstehenden Echtläufe an einem Ort.</p></header>
    <GlobalProjectNotes projects={projects} />
    <OverdueBanner count={dashboardData.overdueTasks.length} />
    <DailyBriefingCard />
    <DailyPlanner />
    <section className="dashboard-milestones"><div className="dashboard-section-head"><div><span className="eyebrow">Zeitplan</span><h3>Anstehende Meilensteine</h3><p>Offene Meilensteine aus den Projektzeitplänen.</p></div></div><MilestonesList milestones={dashboardData.upcomingMilestones} /></section>
    <section className="dashboard-global-steering"><div className="analytics-scope-label">Projektübergreifende Steuerung</div><div className="analytics-kpi-grid">
      <article><strong>{summary.activeProjects}</strong><span>Aktive Projekte</span><small>von {projects.length} insgesamt</small></article>
      <article><strong>{unfinishedTasks.length}</strong><span>Offene Aufgaben</span><small>alle nicht erledigten Aufgaben</small></article>
      <article className={summary.overdueTasks ? 'critical' : ''}><strong>{summary.overdueTasks}</strong><span>Überfällig</span><small>sofortiger Handlungsbedarf</small></article>
      <article className={dashboardData.waitingTasks.length ? 'attention' : ''}><strong>{dashboardData.waitingTasks.length}</strong><span>Wartet auf andere</span><small>externe Abhängigkeiten</small></article>
    </div></section>
    <DashboardCockpit projects={projects} data={dashboardData} />
    <section className="dashboard-global-task-list">
      <div className="dashboard-section-head"><div><span className="eyebrow">Globales Werkzeug</span><h3>Aufgabenliste</h3><p>Alle Projekte in einer Liste. Handlungsbedarf und Farbe lassen sich miteinander kombinieren.</p></div></div>
      <div className="dashboard-task-filter-panel">
        <div className="dashboard-filter-group"><span>Handlungsbedarf</span><div><button className={actionFilter === 'all' ? 'active' : ''} onClick={() => setActionFilter('all')}>Nicht erledigt <b>{unfinishedTasks.length}</b></button><button className={actionFilter === 'active' ? 'active' : ''} onClick={() => setActionFilter('active')}>Offen + in Arbeit <b>{activeTasks.length}</b></button><button className={actionFilter === 'overdue' ? 'active' : ''} onClick={() => setActionFilter('overdue')}>Überfällig <b>{dashboardData.overdueTasks.length}</b></button><button className={actionFilter === 'waiting' ? 'active' : ''} onClick={() => setActionFilter('waiting')}>Wartet <b>{dashboardData.waitingTasks.length}</b></button></div></div>
        <div className="dashboard-filter-group"><span>Farbe</span><div><button className={colorFilter === '' ? 'active' : ''} onClick={() => setColorFilter('')}>Alle Farben <b>{actionTasks.length}</b></button>{colorOrder.map((color) => { const count = actionTasks.filter((task) => task.farbe === color).length; return <button key={color} className={`task-color-${color}${colorFilter === color ? ' active' : ''}`} onClick={() => setColorFilter(color)}><i /><span>{colorLabels[color]}</span><b>{count}</b></button>; })}</div></div>
      </div>
      <div className="dashboard-task-list-result"><div><strong>{filteredTasks.length} Aufgabe{filteredTasks.length === 1 ? '' : 'n'}</strong><span>{actionFilter === 'all' ? 'Nicht erledigte Aufgaben' : actionFilter === 'active' ? 'Offene und in Arbeit befindliche Aufgaben' : actionFilter === 'overdue' ? 'Überfällige Aufgaben' : 'Wartende Aufgaben'}{colorFilter ? ` · Farbe ${colorLabels[colorFilter]}` : ''}</span></div>{(actionFilter !== 'all' || colorFilter) && <button className="btn secondary small" onClick={() => { setActionFilter('all'); setColorFilter(''); }}>Filter zurücksetzen</button>}</div>
      <TaskRows tasks={filteredTasks} suppressEditor />
    </section>
    {editingTask && <div className="task-edit-overlay" role="dialog" aria-modal="true" aria-label="Aufgabe bearbeiten"><div className="task-edit-dialog"><div className="task-edit-dialog-head"><div><span>Aufgabe bearbeiten</span><strong>ID {editingTask.nr} · {editingTask.projectName}</strong></div></div><InlineEditTaskRow task={editingTask} onSave={() => setDashboardEditingTaskId(null)} onCancel={() => setDashboardEditingTaskId(null)} onDelete={() => setDashboardEditingTaskId(null)} /></div></div>}
  </div>;
}

function uniqueTasks(tasks: TaskWithMeta[]): TaskWithMeta[] {
  return tasks.filter((task, index, list) => list.findIndex((item) => item.id === task.id) === index);
}
