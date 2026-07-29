import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { TASK_PRIO, prioLabel } from '../../lib/constants';

export default function DashboardFilterBar({ showDateFilter }: { showDateFilter: boolean }) {
  const projects = useDataStore((s) => s.projects) || [];
  const allContacts = useDataStore((s) => s.dashboardData?.allContacts) || [];
  const { dashFilter, setDashFilter, resetDashFilter } = useUiStore();

  return (
    <div className="filter-bar">
      <div className="filter-field">
        <label>Projekt</label>
        <select value={dashFilter.projectId} onChange={(e) => setDashFilter({ projectId: e.target.value })}>
          <option value="">Alle Projekte</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="filter-field">
        <label>Priorität</label>
        <select value={dashFilter.prioritaet} onChange={(e) => setDashFilter({ prioritaet: e.target.value })}>
          <option value="">Alle</option>
          {TASK_PRIO.map((pr) => (
            <option key={pr} value={pr}>
              {prioLabel(pr)}
            </option>
          ))}
        </select>
      </div>
      <div className="filter-field">
        <label>Ansprechpartner</label>
        <select value={dashFilter.kontaktId} onChange={(e) => setDashFilter({ kontaktId: e.target.value })}>
          <option value="">Alle</option>
          {allContacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.projectName})
            </option>
          ))}
        </select>
      </div>
      {showDateFilter && (
        <>
          <div className="filter-field">
            <label>Fällig von</label>
            <input type="date" value={dashFilter.von} onChange={(e) => setDashFilter({ von: e.target.value })} />
          </div>
          <div className="filter-field">
            <label>Fällig bis</label>
            <input type="date" value={dashFilter.bis} onChange={(e) => setDashFilter({ bis: e.target.value })} />
          </div>
        </>
      )}
      <button className="btn secondary small filter-reset" onClick={resetDashFilter}>
        Filter zurücksetzen
      </button>
    </div>
  );
}
