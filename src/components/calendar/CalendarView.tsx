import { useEffect } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { applyDashboardFilters } from '../../lib/filters';
import CalendarGrid from '../dashboard/CalendarGrid';
import DashboardFilterBar from '../dashboard/DashboardFilterBar';
import CurrentWeekPanel from './CurrentWeekPanel';

export default function CalendarView() {
  const projects = useDataStore((state) => state.projects);
  const data = useDataStore((state) => state.dashboardData);
  const loadDashboardData = useDataStore((state) => state.loadDashboardData);
  const { dashFilter, showDashFilters, toggleDashFilters } = useUiStore();

  useEffect(() => {
    if (projects) loadDashboardData();
  }, [projects, loadDashboardData]);

  if (!data) return <div className="main-inner"><div className="loading-note">Kalender wird geladen…</div></div>;
  const tasks = applyDashboardFilters(data.tasksWithDate, dashFilter, false);

  return (
    <div className="main-inner">
      <header className="page-header project-admin-header">
        <div><div className="eyebrow">Terminübersicht</div><h2>Kalender</h2><p>Alle terminierten Aufgaben projektübergreifend im Blick.</p></div>
        <button className="btn secondary" onClick={toggleDashFilters}>{showDashFilters ? 'Filter ausblenden' : 'Filter'}</button>
      </header>
      {showDashFilters && <DashboardFilterBar showDateFilter={false} />}
      <CurrentWeekPanel tasksWithDate={tasks} />
      <div className="section-title">Monatsübersicht & Arbeitstage</div>
      <div className="workday-legend"><span><b>A</b> Arbeitstag</span><span><b>–</b> arbeitsfrei / Feiertag</span><small>Klicke im Kalendertag auf das Kennzeichen, um den Status umzuschalten.</small></div>
      <CalendarGrid tasksWithDate={tasks} />
    </div>
  );
}
