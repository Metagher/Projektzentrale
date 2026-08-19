import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { useUiStore, type View } from '../../store/uiStore';

const VIEW_COMPONENTS = {
  dashboard: lazy(() => import('../dashboard/Dashboard')),
  'project-management': lazy(() => import('../projects/ProjectManagementView')),
  project: lazy(() => import('../project/ProjectView')),
  settings: lazy(() => import('../settings/SettingsView')),
  data: lazy(() => import('../data/DataView')),
  ai: lazy(() => import('../ai/GlobalAiSearch')),
  knowledge: lazy(() => import('../knowledge/KnowledgeView')),
  analytics: lazy(() => import('../analytics/AnalyticsView')),
  'ai-settings': lazy(() => import('../ai/AiSettingsView')),
} satisfies Record<View, LazyExoticComponent<ComponentType>>;

export default function MainShell() {
  const view = useUiStore((state) => state.view);
  const ViewComponent = VIEW_COMPONENTS[view];

  return (
    <main id="main">
      <Suspense fallback={<div className="main-inner"><div className="loading-note">Ansicht wird geladen…</div></div>}>
        <ViewComponent />
      </Suspense>
    </main>
  );
}
