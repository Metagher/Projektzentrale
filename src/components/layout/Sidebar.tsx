import { useEffect } from 'react';
import { useUiStore } from '../../store/uiStore';
import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import { useDragReorder } from '../../hooks/useDragReorder';
import { useAiStore } from '../../store/aiStore';
import { PRIMARY_NAVIGATION, SECONDARY_NAVIGATION, type NavigationItem } from '../../lib/navigation';
import ProjectTicket from './ProjectTicket';
import type { Project, ProjectStatus } from '../../types/entities';

const STATUS_ORDER: Record<ProjectStatus, number> = { aktiv: 0, pausiert: 1, abgeschlossen: 2 };
const STATUS_LABELS: Record<ProjectStatus, string> = { aktiv: 'Aktiv', pausiert: 'Pausiert', abgeschlossen: 'Abgeschlossen' };

function sortProjects(projects: Project[]): Project[] {
  return projects.slice().sort((a, b) => {
    const statusOrder = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
    if (statusOrder) return statusOrder;
    const sortOrder = (a.sortIndex ?? 0) - (b.sortIndex ?? 0);
    return sortOrder || (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

export default function Sidebar() {
  const { view, selectedId, search, moreNavExpanded, goTo, setSearch, toggleMoreNav } = useUiStore();
  const projects = useDataStore((s) => s.projects);
  const reorderProjects = useDataStore((s) => s.reorderProjects);
  const createProject = useDataStore((s) => s.createProject);
  const newProjectForm = useModalStore((s) => s.newProjectForm);
  const aiAvailable = useAiStore((s) => s.keyPresent);

  useEffect(() => {
    if (!aiAvailable && view === 'ai') goTo('dashboard');
  }, [aiAvailable, view, goTo]);

  const { getItemProps } = useDragReorder({
    disabled: !!search.trim(),
    getGroupKey: (id) => projects?.find((p) => p.id === id)?.status || '',
    onDrop: (sourceId, targetId, placeAfter) => reorderProjects(sourceId, targetId, placeAfter),
  });

  async function handleNewProject() {
    const result = await newProjectForm();
    if (!result) return;
    const id = await createProject(result);
    useUiStore.setState({ view: 'project-management', selectedId: id, sidebarOpen: false });
  }

  const query = search.trim().toLowerCase();
  const visibleProjects = projects ? sortProjects(projects).filter((project) =>
    !query || project.name.toLowerCase().includes(query) || (project.kunde || '').toLowerCase().includes(query),
  ) : null;
  let lastStatus: ProjectStatus | null = null;

  const renderNavItem = (item: NavigationItem) => {
    if (item.requiresAi && !aiAvailable) return null;
    return (
      <button key={item.view} className={`dashboard-link${view === item.view ? ' active' : ''}`} onClick={() => goTo(item.view)}>
        <span className="nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>
      </button>
    );
  };

  return (
    <aside id="sidebar">
      <div className="sidebar-head">
        <div className="brand-mark">PZ</div>
        <div><h1>Projektzentrale</h1><span className="tag">Consulting Workspace</span></div>
      </div>
      <div className="sidebar-search">
        <span className="search-icon" aria-hidden="true">⌕</span>
        <input type="search" placeholder="Projekt oder Kunde suchen…" aria-label="Projekte durchsuchen" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <nav className="sidebar-navigation" aria-label="Hauptnavigation">
        <button className="new-project-btn" onClick={handleNewProject}><span aria-hidden="true">＋</span> Neues Projekt</button>
        <div className="nav-group">{PRIMARY_NAVIGATION.map(renderNavItem)}</div>
        <button className="dashboard-link nav-more" onClick={toggleMoreNav} aria-expanded={moreNavExpanded}>
          <span className="nav-icon">···</span><span>{moreNavExpanded ? 'Weniger' : 'Mehr'}</span>
        </button>
        {moreNavExpanded && <div className="nav-group secondary-nav">{SECONDARY_NAVIGATION.map(renderNavItem)}</div>}
      </nav>
      <div className="project-list-heading"><span>Projekte</span><span>{visibleProjects?.length ?? '–'}</span></div>
      <div id="project-list">
        {visibleProjects === null && <div className="loading-note">Projekte werden geladen…</div>}
        {visibleProjects !== null && visibleProjects.length === 0 && <div className="empty-hint">Keine Projekte gefunden.</div>}
        {visibleProjects?.map((project) => {
          const showLabel = project.status !== lastStatus;
          lastStatus = project.status;
          return <div key={project.id}>
            {showLabel && <div className="list-section-label">{STATUS_LABELS[project.status] || project.status}</div>}
            <ProjectTicket project={project} active={view === 'project' && selectedId === project.id} dragEnabled={!query} dragProps={getItemProps(project.id)} onClick={() => useUiStore.setState({ view: 'project', selectedId: project.id, activeTab: 'aufgaben', sidebarOpen: false })} />
          </div>;
        })}
      </div>
    </aside>
  );
}
