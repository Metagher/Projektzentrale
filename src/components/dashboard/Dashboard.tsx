import { useEffect, useState } from 'react';
import { useDataStore, type TaskWithMeta } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { getDashboardSummary } from '../../lib/dashboardModel';
import DailyBriefingCard from './DailyBriefingCard';
import DailyPlanner from './DailyPlanner';
import DashboardCockpit from './DashboardCockpit';
import TaskRows from './TaskRows';
import InlineEditTaskRow from './InlineEditTaskRow';
import type { TaskColor } from '../../types/entities';

type DetailSelection = { kind: 'overdue' | 'waiting' | 'color'; color?: TaskColor } | null;

export default function Dashboard() {
  const projects = useDataStore((state) => state.projects);
  const dashboardData = useDataStore((state) => state.dashboardData);
  const loadDashboardData = useDataStore((state) => state.loadDashboardData);
  const colorOrder = useDataStore((state) => state.taskColorOrder);
  const colorLabels = useDataStore((state) => state.taskColorLabels);
  const dashboardEditingTaskId = useUiStore((state) => state.dashboardEditingTaskId);
  const setDashboardEditingTaskId = useUiStore((state) => state.setDashboardEditingTaskId);
  const [detail, setDetail] = useState<DetailSelection>(null);

  useEffect(() => { if (projects) loadDashboardData(); }, [projects, loadDashboardData]);

  if (!projects || !dashboardData) return <div className="main-inner"><div className="loading-note">Lade Dashboard…</div></div>;

  const summary = getDashboardSummary(projects, dashboardData);
  const allTasks = uniqueTasks([
    ...dashboardData.openTasks, ...dashboardData.waitingTasks, ...dashboardData.completedTasks,
    ...dashboardData.tasksNoDate, ...dashboardData.tasksWithDate,
  ]);
  const editingTask = allTasks.find((task) => task.id === dashboardEditingTaskId);
  const detailTasks = detail?.kind === 'overdue' ? dashboardData.overdueTasks
    : detail?.kind === 'waiting' ? dashboardData.waitingTasks
      : detail?.kind === 'color' ? allTasks.filter((task) => task.farbe === detail.color) : [];
  const detailTitle = detail?.kind === 'overdue' ? `Alle überfälligen Aufgaben (${detailTasks.length})`
    : detail?.kind === 'waiting' ? `Alle wartenden Aufgaben (${detailTasks.length})`
      : detail?.kind === 'color' && detail.color ? `${colorLabels[detail.color]} markierte Aufgaben (${detailTasks.length})` : '';

  return <div className="main-inner">
    <header className="page-header"><div className="eyebrow">Arbeitsbereich</div><h2>Guten Überblick.</h2><p>Alle Projekte, offenen Aufgaben und anstehenden Echtläufe an einem Ort.</p></header>
    <DailyBriefingCard />
    <DailyPlanner />
    <div className="stat-row">
      <div className="stat-card"><div className="stat-icon">◆</div><div className="num">{summary.activeProjects}</div><div className="label">Aktive Projekte</div></div>
      <div className="stat-card"><div className="stat-icon">✓</div><div className="num">{summary.openTasks}</div><div className="label">Offene Aufgaben</div></div>
      <div className="stat-card warn"><div className="stat-icon">!</div><div className="num">{summary.overdueTasks}</div><div className="label">Überfällig</div></div>
      <div className="stat-card upcoming"><div className="stat-icon">◇</div><div className="num">{summary.upcomingMilestones}</div><div className="label">Echtläufe in 30 Tagen</div></div>
    </div>
    <DashboardCockpit projects={projects} data={dashboardData} openTaskList={(kind) => setDetail({ kind })} openTask={setDashboardEditingTaskId} />
    <section className="dashboard-color-overview">
      <div className="dashboard-section-head"><div><span className="eyebrow">Farbmarkierungen</span><h3>Aufgaben nach Farbe</h3><p>Zeigt alle offenen und erledigten Aufgaben der gewählten Farbmarkierung.</p></div></div>
      <div className="dashboard-color-grid">{colorOrder.map((color) => { const count = allTasks.filter((task) => task.farbe === color).length; return <button type="button" key={color} className={`task-color-${color}${detail?.kind === 'color' && detail.color === color ? ' active' : ''}`} onClick={() => setDetail({ kind: 'color', color })}><i /><span>{colorLabels[color]}</span><strong>{count}</strong></button>; })}</div>
    </section>
    {detail && <section className="dashboard-detail-list"><div className="dashboard-detail-head"><div><span className="eyebrow">Aufgabenliste</span><h3>{detailTitle}</h3></div><button className="btn secondary small" onClick={() => setDetail(null)}>Schließen</button></div><TaskRows tasks={detailTasks} suppressEditor /></section>}
    {editingTask && <div className="task-edit-overlay" role="dialog" aria-modal="true" aria-label="Aufgabe bearbeiten"><div className="task-edit-dialog"><div className="task-edit-dialog-head"><div><span>Aufgabe bearbeiten</span><strong>ID {editingTask.nr} · {editingTask.projectName}</strong></div></div><InlineEditTaskRow task={editingTask} onSave={() => setDashboardEditingTaskId(null)} onCancel={() => setDashboardEditingTaskId(null)} onDelete={() => setDashboardEditingTaskId(null)} /></div></div>}
  </div>;
}

function uniqueTasks(tasks: TaskWithMeta[]): TaskWithMeta[] {
  return tasks.filter((task, index, list) => list.findIndex((item) => item.id === task.id) === index);
}
