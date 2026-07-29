import { useUiStore } from '../../store/uiStore';
import Dashboard from '../dashboard/Dashboard';
import ProjectView from '../project/ProjectView';
import SettingsView from '../settings/SettingsView';

const VIEW_LABELS: Record<string, string> = {
  data: 'CSV Import / Export',
  ai: 'KI-Suche',
  knowledge: 'Wissensdatenbank',
  analytics: 'Auswertung',
  'ai-settings': 'KI-Einstellungen',
};

export default function MainShell() {
  const view = useUiStore((s) => s.view);

  if (view === 'dashboard') {
    return (
      <div id="main">
        <Dashboard />
      </div>
    );
  }

  if (view === 'project') {
    return (
      <div id="main">
        <ProjectView />
      </div>
    );
  }

  if (view === 'settings') {
    return (
      <div id="main">
        <SettingsView />
      </div>
    );
  }

  return (
    <div id="main">
      <div className="main-inner">
        <h2>{VIEW_LABELS[view] ?? view}</h2>
        <p className="empty-hint">Diese Ansicht wird in einer der nächsten Phasen des Rewrites befüllt.</p>
      </div>
    </div>
  );
}
