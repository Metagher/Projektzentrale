import { lazy, Suspense, type ComponentType, type DragEvent, type LazyExoticComponent } from 'react';
import { useUiStore, type View, type WorkspacePane } from '../../store/uiStore';
import ProjectQuickBar from './ProjectQuickBar';

const DashboardView = lazy(() => import('../dashboard/Dashboard'));
const ProjectView = lazy(() => import('../project/ProjectView'));
const VIEW_COMPONENTS = {
  dashboard: DashboardView,
  calendar: lazy(() => import('../calendar/CalendarView')),
  'project-management': lazy(() => import('../projects/ProjectManagementView')),
  project: ProjectView,
  settings: lazy(() => import('../settings/SettingsView')),
  data: lazy(() => import('../data/DataView')),
  ai: lazy(() => import('../ai/GlobalAiSearch')),
  knowledge: lazy(() => import('../knowledge/KnowledgeView')),
  analytics: lazy(() => import('../analytics/AnalyticsView')),
  'ai-settings': lazy(() => import('../ai/AiSettingsView')),
} satisfies Record<View, LazyExoticComponent<ComponentType>>;

function readPaneDrop(event: DragEvent): WorkspacePane | null {
  try {
    const value = JSON.parse(event.dataTransfer.getData('application/x-projectzentrale-pane')) as WorkspacePane;
    return value.view === 'dashboard' || value.view === 'project' ? value : null;
  } catch { return null; }
}

export default function MainShell() {
  const { view, secondaryPane, setSecondaryPane, setSecondaryTab, closeSecondaryPane } = useUiStore();
  const ViewComponent = VIEW_COMPONENTS[view];

  function dropLeft(event: DragEvent) {
    event.preventDefault();
    const pane = readPaneDrop(event);
    if (!pane) return;
    useUiStore.setState({ view: pane.view, selectedId: pane.selectedId, activeTab: pane.activeTab });
  }

  function dropRight(event: DragEvent) {
    event.preventDefault();
    const pane = readPaneDrop(event);
    if (pane) setSecondaryPane(pane);
  }

  return (
    <div className="workspace">
      <ProjectQuickBar />
      <div className={`workspace-panes${secondaryPane ? ' split' : ''}`}>
        <section className="workspace-pane" onDragOver={(event) => event.preventDefault()} onDrop={dropLeft}>
          {secondaryPane && <div className="workspace-pane-head"><span>Links</span><small>Projekt oder Dashboard hier ablegen</small></div>}
          <main id="main" className="pane-main"><Suspense fallback={<div className="main-inner"><div className="loading-note">Ansicht wird geladen…</div></div>}><ViewComponent /></Suspense></main>
        </section>
        {secondaryPane && <section className="workspace-pane" onDragOver={(event) => event.preventDefault()} onDrop={dropRight}>
          <div className="workspace-pane-head"><span>Rechts</span><small>Projekt oder Dashboard hier ablegen</small><button onClick={closeSecondaryPane} aria-label="Geteilte Ansicht schließen">×</button></div>
          <main className="pane-main"><Suspense fallback={<div className="main-inner"><div className="loading-note">Ansicht wird geladen…</div></div>}>{secondaryPane.view === 'dashboard' ? <DashboardView /> : <ProjectView projectId={secondaryPane.selectedId} paneTab={secondaryPane.activeTab} onPaneTabChange={setSecondaryTab} />}</Suspense></main>
        </section>}
      </div>
    </div>
  );
}
