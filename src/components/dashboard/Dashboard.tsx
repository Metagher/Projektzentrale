import { useEffect, type ReactNode } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useUiStore, type DashboardTab } from '../../store/uiStore';
import { useModalStore } from '../../store/modalStore';
import { applyDashboardFilters } from '../../lib/filters';
import { fmtDate, todayStr } from '../../lib/format';
import { getDashboardSummary } from '../../lib/dashboardModel';
import DailyBriefingCard from './DailyBriefingCard';
import OverdueBanner from './OverdueBanner';
import DashboardFilterBar from './DashboardFilterBar';
import TaskRows from './TaskRows';
import MilestonesList from './MilestonesList';
import DailyPlanner from './DailyPlanner';

const TABS: { key: DashboardTab; label: (n: number) => string }[] = [
  { key: 'liste', label: () => 'Liste' },
  { key: 'ohne-datum', label: (n) => `Ohne Datum (${n})` },
  { key: 'wartet', label: (n) => `Wartet auf andere (${n})` },
  { key: 'erledigt', label: (n) => `Erledigt (${n})` },
];

export default function Dashboard() {
  const projects = useDataStore((s) => s.projects);
  const dashboardData = useDataStore((s) => s.dashboardData);
  const loadDashboardData = useDataStore((s) => s.loadDashboardData);
  const setAllNoDateTasksToToday = useDataStore((s) => s.setAllNoDateTasksToToday);
  const confirm = useModalStore((s) => s.confirm);
  const { dashboardTab, setDashboardTab, showDashFilters, toggleDashFilters, dashFilter } = useUiStore();

  useEffect(() => {
    if (projects) loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  if (!projects || !dashboardData) {
    return (
      <div className="main-inner">
        <div className="loading-note">Lade Dashboard…</div>
      </div>
    );
  }

  const summary = getDashboardSummary(projects, dashboardData);

  const counts: Record<DashboardTab, number> = {
    liste: dashboardData.tasksWithDate.length,
    'ohne-datum': dashboardData.tasksNoDate.length,
    wartet: dashboardData.waitingTasks.length,
    erledigt: dashboardData.completedTasks.length,
  };

  let content: ReactNode;
  if (dashboardTab === 'liste') {
    const filtered = applyDashboardFilters(dashboardData.tasksWithDate, dashFilter, true);
    content = (
      <>
        {showDashFilters && <DashboardFilterBar showDateFilter />}
        <div className="section-title">Offene Aufgaben mit Termin</div>
        <TaskRows tasks={filtered} />
      </>
    );
  } else if (dashboardTab === 'ohne-datum') {
    const filtered = applyDashboardFilters(dashboardData.tasksNoDate, dashFilter, true);
    content = (
      <>
        {showDashFilters && <DashboardFilterBar showDateFilter />}
        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Offene Aufgaben ohne Termin</span>
          {filtered.length > 0 && (
            <button
              className="btn small"
              onClick={async () => {
                const n = filtered.length;
                const sure = await confirm(
                  `Wirklich allen ${n} Aufgabe${n === 1 ? '' : 'n'} ohne Termin das heutige Datum (${fmtDate(todayStr())}) zuweisen?`,
                  { confirmLabel: 'Bestätigen', danger: false },
                );
                if (!sure) return;
                await setAllNoDateTasksToToday();
              }}
            >
              Alle auf heute setzen
            </button>
          )}
        </div>
        <TaskRows tasks={filtered} />
      </>
    );
  } else if (dashboardTab === 'wartet') {
    const filtered = applyDashboardFilters(dashboardData.waitingTasks, dashFilter, true);
    content = (
      <>
        {showDashFilters && <DashboardFilterBar showDateFilter />}
        <div className="section-title">Aufgaben, bei denen du auf jemand anderen wartest</div>
        <TaskRows tasks={filtered} />
      </>
    );
  } else {
    const filtered = applyDashboardFilters(dashboardData.completedTasks, dashFilter, true);
    content = (
      <>
        {showDashFilters && <DashboardFilterBar showDateFilter />}
        <div className="section-title">Erledigte Aufgaben</div>
        <TaskRows tasks={filtered} />
      </>
    );
  }

  return (
    <div className="main-inner">
      <header className="page-header">
        <div className="eyebrow">Arbeitsbereich</div>
        <h2>Guten Überblick.</h2>
        <p>Alle Projekte, offenen Aufgaben und anstehenden Echtläufe an einem Ort.</p>
      </header>
      <DailyBriefingCard />
      <DailyPlanner />
      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-icon">◆</div><div className="num">{summary.activeProjects}</div>
          <div className="label">Aktive Projekte</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✓</div><div className="num">{summary.openTasks}</div>
          <div className="label">Offene Aufgaben</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-icon">!</div><div className="num">{summary.overdueTasks}</div>
          <div className="label">Überfällig</div>
        </div>
        <div className="stat-card upcoming">
          <div className="stat-icon">◷</div><div className="num">{summary.upcomingMilestones}</div>
          <div className="label">Echtläufe in 30 Tagen</div>
        </div>
      </div>
      <OverdueBanner count={summary.overdueTasks} />
      <div className="tabs" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab-btn${dashboardTab === t.key ? ' active' : ''}`}
              onClick={() => setDashboardTab(t.key)}
            >
              {t.label(counts[t.key])}
            </button>
          ))}
        </div>
        <button className="icon-btn" style={{ alignSelf: 'center' }} onClick={toggleDashFilters}>
          {showDashFilters ? 'Filter ausblenden' : '🔍 Filter'}
        </button>
      </div>
      {content}
      <MilestonesList milestones={dashboardData.upcomingMilestones} />
    </div>
  );
}
