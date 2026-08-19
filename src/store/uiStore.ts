import { create } from 'zustand';

export type View =
  | 'dashboard'
  | 'calendar'
  | 'project-management'
  | 'project'
  | 'settings'
  | 'data'
  | 'ai'
  | 'knowledge'
  | 'analytics'
  | 'ai-settings';

export type DashboardTab = 'liste' | 'ohne-datum' | 'wartet' | 'erledigt';
export interface WorkspacePane { view: 'dashboard' | 'calendar' | 'knowledge' | 'project'; selectedId: string | null; activeTab: string; }

export interface DashFilter {
  projectId: string;
  kontaktId: string;
  von: string;
  bis: string;
}

const EMPTY_DASH_FILTER: DashFilter = { projectId: '', kontaktId: '', von: '', bis: '' };

interface UiState {
  view: View;
  selectedId: string | null;
  activeTab: string;
  search: string;
  moreNavExpanded: boolean;
  sidebarOpen: boolean;
  secondaryPane: WorkspacePane | null;

  dashboardTab: DashboardTab;
  calendarMonth: { year: number; month: number } | null;
  showDashFilters: boolean;
  dashFilter: DashFilter;
  dashboardEditingTaskId: string | null;

  goTo: (view: View, selectedId?: string | null) => void;
  setSearch: (v: string) => void;
  toggleMoreNav: () => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  setSecondaryPane: (pane: WorkspacePane) => void;
  setSecondaryTab: (tab: string) => void;
  closeSecondaryPane: () => void;
  setActiveTab: (tab: string) => void;

  setDashboardTab: (tab: DashboardTab) => void;
  setCalendarMonth: (m: { year: number; month: number }) => void;
  toggleDashFilters: () => void;
  setDashFilter: (patch: Partial<DashFilter>) => void;
  resetDashFilter: () => void;
  setDashboardEditingTaskId: (id: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  view: 'dashboard',
  selectedId: null,
  activeTab: 'aufgaben',
  search: '',
  moreNavExpanded: false,
  sidebarOpen: false,
  secondaryPane: null,

  dashboardTab: 'liste',
  calendarMonth: null,
  showDashFilters: false,
  dashFilter: EMPTY_DASH_FILTER,
  dashboardEditingTaskId: null,

  goTo: (view, selectedId = null) => set({ view, selectedId, sidebarOpen: false }),
  setSearch: (v) => set({ search: v }),
  toggleMoreNav: () => set((s) => ({ moreNavExpanded: !s.moreNavExpanded })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
  setSecondaryPane: (pane) => set({ secondaryPane: pane }),
  setSecondaryTab: (activeTab) => set((state) => ({ secondaryPane: state.secondaryPane ? { ...state.secondaryPane, activeTab } : null })),
  closeSecondaryPane: () => set({ secondaryPane: null }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  setDashboardTab: (tab) => set({ dashboardTab: tab }),
  setCalendarMonth: (m) => set({ calendarMonth: m }),
  toggleDashFilters: () => set((s) => ({ showDashFilters: !s.showDashFilters })),
  setDashFilter: (patch) => set((s) => ({ dashFilter: { ...s.dashFilter, ...patch } })),
  resetDashFilter: () => set({ dashFilter: EMPTY_DASH_FILTER }),
  setDashboardEditingTaskId: (id) => set({ dashboardEditingTaskId: id }),
}));
