import type { View } from '../store/uiStore';

export interface NavigationItem {
  view: View;
  label: string;
  icon: string;
  requiresAi?: boolean;
}

export const PRIMARY_NAVIGATION: NavigationItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: '⌂' },
  { view: 'project-management', label: 'Projektverwaltung', icon: '▦' },
  { view: 'knowledge', label: 'Wissensdatenbank', icon: '◇' },
  { view: 'analytics', label: 'Auswertung', icon: '↗' },
  { view: 'ai', label: 'KI-Suche', icon: '✦', requiresAi: true },
];

export const SECONDARY_NAVIGATION: NavigationItem[] = [
  { view: 'settings', label: 'Oberpunkte verwalten', icon: '⚙' },
  { view: 'data', label: 'CSV Import / Export', icon: '⇄' },
  { view: 'ai-settings', label: 'KI-Einstellungen', icon: '⌁' },
];
