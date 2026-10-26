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
  | 'ai-settings'
  | 'company-chatbot';

export type DashboardTab = 'liste' | 'ohne-datum' | 'wartet' | 'erledigt';
export interface WorkspacePane { view: 'dashboard' | 'calendar' | 'knowledge' | 'project'; selectedId: string | null; activeTab: string; }

export interface DashFilter {
  projectId: string;
  kontaktId: string;
  von: string;
  bis: string;
}

const EMPTY_DASH_FILTER: DashFilter = { projectId: '', kontaktId: '', von: '', bis: '' };

const TOUCH_MODE_KEY = 'pz-touch-mode';

function readStoredTouchMode(): boolean | null {
  try {
    const raw = localStorage.getItem(TOUCH_MODE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch { /* localStorage unavailable */ }
  return null;
}

/** First launch on a device with no stored preference: guess tablet-sized touch screens (e.g. iPad), never phones or desktop mice. */
function detectTabletByDefault(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches
      && window.matchMedia('(min-width: 700px)').matches
      && window.matchMedia('(max-width: 1400px)').matches;
  } catch { return false; }
}

function applyTouchModeClass(active: boolean) {
  try { document.documentElement.classList.toggle('touch-mode', active); } catch { /* no DOM yet */ }
}

const initialTouchMode = readStoredTouchMode() ?? detectTabletByDefault();
applyTouchModeClass(initialTouchMode);

interface UiState {
  view: View;
  selectedId: string | null;
  activeTab: string;
  search: string;
  moreNavExpanded: boolean;
  sidebarOpen: boolean;
  secondaryPane: WorkspacePane | null;
  touchMode: boolean;

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
  setTouchMode: (value: boolean) => void;
  toggleTouchMode: () => void;

  setDashboardTab: (tab: DashboardTab) => void;
  setCalendarMonth: (m: { year: number; month: number }) => void;
  toggleDashFilters: () => void;
  setDashFilter: (patch: Partial<DashFilter>) => void;
  resetDashFilter: () => void;
  setDashboardEditingTaskId: (id: string | null) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  view: 'dashboard',
  selectedId: null,
  activeTab: 'aufgaben',
  search: '',
  moreNavExpanded: false,
  sidebarOpen: false,
  secondaryPane: null,
  touchMode: initialTouchMode,

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
  setTouchMode: (value) => {
    applyTouchModeClass(value);
    try { localStorage.setItem(TOUCH_MODE_KEY, String(value)); } catch { /* localStorage unavailable */ }
    set({ touchMode: value });
  },
  toggleTouchMode: () => get().setTouchMode(!get().touchMode),

  setDashboardTab: (tab) => set({ dashboardTab: tab }),
  setCalendarMonth: (m) => set({ calendarMonth: m }),
  toggleDashFilters: () => set((s) => ({ showDashFilters: !s.showDashFilters })),
  setDashFilter: (patch) => set((s) => ({ dashFilter: { ...s.dashFilter, ...patch } })),
  resetDashFilter: () => set({ dashFilter: EMPTY_DASH_FILTER }),
  setDashboardEditingTaskId: (id) => set({ dashboardEditingTaskId: id }),
}));
