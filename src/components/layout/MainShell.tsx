import { lazy, Suspense, type ComponentType, type DragEvent, type LazyExoticComponent } from 'react';
import { useUiStore, type View, type WorkspacePane } from '../../store/uiStore';
import ProjectQuickBar from './ProjectQuickBar';
import CalendarView from '../calendar/CalendarView';
import KnowledgeView from '../knowledge/KnowledgeView';
import AnalyticsView from '../analytics/AnalyticsView';
import ActiveTimerBar from './ActiveTimerBar';

const DashboardView = lazy(() => import('../dashboard/Dashboard'));
const ProjectView = lazy(() => import('../project/ProjectView'));
const VIEW_COMPONENTS = {
  dashboard: DashboardView,
  calendar: CalendarView,
  'project-management': lazy(() => import('../projects/ProjectManagementView')),
  project: ProjectView,
  settings: lazy(() => import('../settings/SettingsView')),
  data: lazy(() => import('../data/DataView')),
  ai: lazy(() => import('../ai/GlobalAiSearch')),
  knowledge: KnowledgeView,
  analytics: AnalyticsView,
  'ai-settings': lazy(() => import('../ai/AiSettingsView')),
} satisfies Record<View, ComponentType | LazyExoticComponent<ComponentType>>;

function readPaneDrop(event: DragEvent): WorkspacePane | null {
  try {
    const value = JSON.parse(event.dataTransfer.getData('application/x-projectzentrale-pane')) as WorkspacePane;
    return ['dashboard', 'calendar', 'knowledge', 'project'].includes(value.view) ? value : null;
  } catch { return null; }
}

export default function MainShell() {
  const { view, secondaryPane, setSecondaryPane, setSecondaryTab, closeSecondaryPane } = useUiStore();
  const ViewComponent = VIEW_COMPONENTS[view];
  const SecondaryComponent = secondaryPane && secondaryPane.view !== 'project' ? VIEW_COMPONENTS[secondaryPane.view] : null;

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
      <ActiveTimerBar />
      <div className={`workspace-panes${secondaryPane ? ' split' : ''}`}>
        <section className="workspace-pane" onDragOver={(event) => event.preventDefault()} onDrop={dropLeft}>
          {secondaryPane && <div className="workspace-pane-head"><span>Links</span><small>Projekt oder Dashboard hier ablegen</small></div>}
          <main id="main" className="pane-main"><Suspense fallback={<div className="main-inner"><div className="loading-note">Ansicht wird geladen…</div></div>}><ViewComponent /></Suspense></main>
        </section>
        {secondaryPane && <section className="workspace-pane" onDragOver={(event) => event.preventDefault()} onDrop={dropRight}>
          <div className="workspace-pane-head"><span>Rechts</span><small>Projekt oder Dashboard hier ablegen</small><button onClick={closeSecondaryPane} aria-label="Geteilte Ansicht schließen">×</button></div>
          <main className="pane-main"><Suspense fallback={<div className="main-inner"><div className="loading-note">Ansicht wird geladen…</div></div>}>{secondaryPane.view === 'project' ? <ProjectView projectId={secondaryPane.selectedId} paneTab={secondaryPane.activeTab} onPaneTabChange={setSecondaryTab} scopeKey="secondary" /> : SecondaryComponent ? <SecondaryComponent /> : null}</Suspense></main>
        </section>}
      </div>
    </div>
  );
}
