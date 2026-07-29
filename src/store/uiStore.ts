import { create } from 'zustand';

export type View =
  | 'dashboard'
  | 'project'
  | 'settings'
  | 'data'
  | 'ai'
  | 'knowledge'
  | 'analytics'
  | 'ai-settings';

interface UiState {
  view: View;
  selectedId: string | null;
  activeTab: string;
  search: string;
  moreNavExpanded: boolean;
  goTo: (view: View, selectedId?: string | null) => void;
  setSearch: (v: string) => void;
  toggleMoreNav: () => void;
  setActiveTab: (tab: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  view: 'dashboard',
  selectedId: null,
  activeTab: 'aufgaben',
  search: '',
  moreNavExpanded: false,

  goTo: (view, selectedId = null) => set({ view, selectedId }),
  setSearch: (v) => set({ search: v }),
  toggleMoreNav: () => set((s) => ({ moreNavExpanded: !s.moreNavExpanded })),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
