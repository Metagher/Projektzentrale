import { useUiStore } from '../../store/uiStore';
import Dashboard from '../dashboard/Dashboard';

const VIEW_LABELS: Record<string, string> = {
  project: 'Projekt',
  settings: 'Oberpunkte verwalten',
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

  return (
    <div id="main">
      <div className="main-inner">
        <h2>{VIEW_LABELS[view] ?? view}</h2>
        <p className="empty-hint">Diese Ansicht wird in einer der nächsten Phasen des Rewrites befüllt.</p>
      </div>
    </div>
  );
}
