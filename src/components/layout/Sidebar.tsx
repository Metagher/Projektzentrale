import { useEffect } from 'react';
import { useUiStore } from '../../store/uiStore';
import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import { useDragReorder } from '../../hooks/useDragReorder';
import { hasAiKey } from '../../lib/ai';
import ProjectTicket from './ProjectTicket';
import type { Project, ProjectStatus } from '../../types/entities';

const STATUS_ORDER: Record<ProjectStatus, number> = { aktiv: 0, pausiert: 1, abgeschlossen: 2 };
const STATUS_LABELS: Record<ProjectStatus, string> = { aktiv: 'Aktiv', pausiert: 'Pausiert', abgeschlossen: 'Abgeschlossen' };

function sortProjects(projects: Project[]): Project[] {
  return projects.slice().sort((a, b) => {
    const oa = STATUS_ORDER[a.status] ?? 3;
    const ob = STATUS_ORDER[b.status] ?? 3;
    if (oa !== ob) return oa - ob;
    const ia = a.sortIndex ?? 0;
    const ib = b.sortIndex ?? 0;
    if (ia !== ib) return ia - ib;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

export default function Sidebar() {
  const { view, selectedId, search, moreNavExpanded, goTo, setSearch, toggleMoreNav } = useUiStore();
  const projects = useDataStore((s) => s.projects);
  const reorderProjects = useDataStore((s) => s.reorderProjects);
  const createProject = useDataStore((s) => s.createProject);
  const newProjectForm = useModalStore((s) => s.newProjectForm);
  const aiAvailable = hasAiKey();

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
    useUiStore.setState({ view: 'project', selectedId: id, activeTab: 'uebersicht' });
  }

  const searchLower = search.trim().toLowerCase();
  let visibleProjects = projects ? sortProjects(projects) : null;
  if (visibleProjects && searchLower) {
    visibleProjects = visibleProjects.filter(
      (p) => p.name.toLowerCase().includes(searchLower) || (p.kunde || '').toLowerCase().includes(searchLower),
    );
  }
  const dragEnabled = !searchLower;

  let lastStatus: ProjectStatus | null = null;

  return (
    <div id="sidebar">
      <div className="sidebar-head">
        <h1>Projektzentrale</h1>
        <span className="tag">Consulting Übersicht</span>
      </div>
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Projekt oder Kunde suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div style={{ padding: '0 16px' }}>
        <button className="new-project-btn" onClick={handleNewProject}>
          + Neues Projekt
        </button>
        <div
          className={`dashboard-link${view === 'dashboard' ? ' active' : ''}`}
          onClick={() => goTo('dashboard')}
        >
          Dashboard — alle offenen Aufgaben
        </div>
        <div
          className={`dashboard-link${view === 'knowledge' ? ' active' : ''}`}
          onClick={() => goTo('knowledge')}
        >
          🧠 Wissensdatenbank
        </div>
        <div
          className={`dashboard-link${view === 'analytics' ? ' active' : ''}`}
          onClick={() => goTo('analytics')}
        >
          📊 Auswertung
        </div>
        {aiAvailable && (
          <div className={`dashboard-link${view === 'ai' ? ' active' : ''}`} onClick={() => goTo('ai')}>
            🔍 KI-Suche (alle Projekte)
          </div>
        )}
        <div className="dashboard-link" onClick={toggleMoreNav}>
          {moreNavExpanded ? '⋯ Weniger' : '⋯ Mehr'}
        </div>
        {moreNavExpanded && (
          <div>
            <div
              className={`dashboard-link${view === 'settings' ? ' active' : ''}`}
              onClick={() => goTo('settings')}
            >
              ⚙ Oberpunkte verwalten
            </div>
            <div className={`dashboard-link${view === 'data' ? ' active' : ''}`} onClick={() => goTo('data')}>
              ⇅ CSV Import / Export
            </div>
            <div
              className={`dashboard-link${view === 'ai-settings' ? ' active' : ''}`}
              onClick={() => goTo('ai-settings')}
            >
              🔑 KI-Einstellungen
            </div>
          </div>
        )}
      </div>
      <div id="project-list">
        {visibleProjects === null && <div className="loading-note">Projekte werden geladen…</div>}
        {visibleProjects !== null && visibleProjects.length === 0 && (
          <div className="empty-hint">Keine Projekte gefunden.</div>
        )}
        {visibleProjects?.map((p) => {
          const showLabel = p.status !== lastStatus;
          lastStatus = p.status;
          return (
            <div key={p.id}>
              {showLabel && <div className="list-section-label">{STATUS_LABELS[p.status] || p.status}</div>}
              <ProjectTicket
                project={p}
                active={view === 'project' && selectedId === p.id}
                dragEnabled={dragEnabled}
                dragProps={getItemProps(p.id)}
                onClick={() => useUiStore.setState({ view: 'project', selectedId: p.id, activeTab: 'aufgaben' })}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
