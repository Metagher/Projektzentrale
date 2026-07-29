import { useProjectUiStore } from '../../store/projectUiStore';
import { TASK_PRIO, prioLabel } from '../../lib/constants';
import type { Contact } from '../../types/entities';

export default function ProjectTaskFilterBar({ contacts }: { contacts: Contact[] }) {
  const { projectTaskFilter, setProjectTaskFilter, resetProjectTaskFilter } = useProjectUiStore();

  return (
    <div className="filter-bar">
      <div className="filter-field">
        <label>Priorität</label>
        <select value={projectTaskFilter.prioritaet} onChange={(e) => setProjectTaskFilter({ prioritaet: e.target.value })}>
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
        <select value={projectTaskFilter.kontaktId} onChange={(e) => setProjectTaskFilter({ kontaktId: e.target.value })}>
          <option value="">Alle</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="filter-field">
        <label>Fällig von</label>
        <input type="date" value={projectTaskFilter.von} onChange={(e) => setProjectTaskFilter({ von: e.target.value })} />
      </div>
      <div className="filter-field">
        <label>Fällig bis</label>
        <input type="date" value={projectTaskFilter.bis} onChange={(e) => setProjectTaskFilter({ bis: e.target.value })} />
      </div>
      <button className="btn secondary small filter-reset" onClick={resetProjectTaskFilter}>
        Filter zurücksetzen
      </button>
    </div>
  );
}
