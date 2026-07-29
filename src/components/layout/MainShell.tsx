import { useUiStore } from '../../store/uiStore';
import Dashboard from '../dashboard/Dashboard';
import ProjectView from '../project/ProjectView';
import SettingsView from '../settings/SettingsView';
import GlobalAiSearch from '../ai/GlobalAiSearch';
import AiSettingsView from '../ai/AiSettingsView';
import KnowledgeView from '../knowledge/KnowledgeView';
import DataView from '../data/DataView';
import AnalyticsView from '../analytics/AnalyticsView';

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

  if (view === 'ai') {
    return (
      <div id="main">
        <GlobalAiSearch />
      </div>
    );
  }

  if (view === 'ai-settings') {
    return (
      <div id="main">
        <AiSettingsView />
      </div>
    );
  }

  if (view === 'knowledge') {
    return (
      <div id="main">
        <KnowledgeView />
      </div>
    );
  }

  if (view === 'data') {
    return (
      <div id="main">
        <DataView />
      </div>
    );
  }

  return (
    <div id="main">
      <AnalyticsView />
    </div>
  );
}
