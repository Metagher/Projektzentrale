import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';

const STATUS_ORDER = { aktiv: 0, pausiert: 1, abgeschlossen: 2 } as const;

export default function ProjectQuickBar() {
  const projects = useDataStore((state) => state.projects);
  const view = useUiStore((state) => state.view);
  const selectedId = useUiStore((state) => state.selectedId);

  const sorted = (projects || []).slice().sort((a, b) =>
    (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) ||
    (a.sortIndex ?? 0) - (b.sortIndex ?? 0),
  );
  const customerGroups = sorted.reduce<{ key: string; label: string; projects: typeof sorted }[]>((groups, project) => {
    const label = project.kunde.trim() || 'Ohne Kunde';
    const key = label.toLocaleLowerCase('de');
    const existing = groups.find((group) => group.key === key);
    if (existing) existing.projects.push(project);
    else groups.push({ key, label, projects: [project] });
    return groups;
  }, []);

  return (
    <nav className="project-quickbar" aria-label="Projektschnellwahl">
      <span className="project-quickbar-label">Projekte</span>
      <div className="project-quickbar-scroll">
        {sorted.length === 0 && <span className="project-quickbar-empty">Noch keine Projekte</span>}
        {customerGroups.map((group) => <div className="project-quickbar-group" key={group.key}>
          <span className="project-quickbar-customer">{group.label}</span>
          <div className="project-quickbar-projects">{group.projects.map((project) => (
            <button
              className={`project-quickbar-item${view === 'project' && selectedId === project.id ? ' active' : ''}`}
              key={project.id}
              title={`${project.name} · ${group.label}`}
              onClick={() => useUiStore.setState({ view: 'project', selectedId: project.id, activeTab: 'aufgaben', sidebarOpen: false })}
            >
              <span className={`status-dot ${project.status}`} />
              <span>{project.name}</span>
            </button>
          ))}</div>
        </div>)}
      </div>
      <button className="project-quickbar-manage" onClick={() => useUiStore.getState().goTo('project-management')} title="Projektverwaltung öffnen">Verwalten</button>
    </nav>
  );
}
