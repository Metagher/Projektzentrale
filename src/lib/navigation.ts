import { useUiStore, type View } from '../store/uiStore';

export interface NavigationItem {
  view: View;
  label: string;
  icon: string;
  requiresAi?: boolean;
}

/** Opens a task for inline editing on the dashboard's Liste tab, from anywhere in the app. */
export function openTaskInDashboard(taskId: string): void {
  useUiStore.setState({
    view: 'dashboard',
    selectedId: null,
    sidebarOpen: false,
    dashboardTab: 'liste',
    dashboardEditingTaskId: taskId,
  });
}

export const PRIMARY_NAVIGATION: NavigationItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: '⌂' },
  { view: 'calendar', label: 'Kalender', icon: '▤' },
  { view: 'project-management', label: 'Projektverwaltung', icon: '▦' },
  { view: 'knowledge', label: 'Wissensdatenbank', icon: '◇' },
  { view: 'analytics', label: 'Auswertung', icon: '↗' },
  { view: 'ai', label: 'KI-Suche', icon: '✦', requiresAi: true },
  { view: 'company-chatbot', label: 'Unternehmens-Chatbot', icon: '◉' },
];

export const SECONDARY_NAVIGATION: NavigationItem[] = [
  { view: 'settings', label: 'Einstellungen', icon: '⚙' },
  { view: 'data', label: 'CSV Import / Export', icon: '⇄' },
  { view: 'ai-settings', label: 'KI-Einstellungen', icon: '⌁' },
];
