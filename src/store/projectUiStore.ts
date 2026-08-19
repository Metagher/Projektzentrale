import { createContext, createElement, useContext, type ReactNode } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import { useUiStore } from './uiStore';
import { useDataStore } from './dataStore';

export type TaskFilterTab = 'offen' | 'wartet' | 'erledigt';
export type ProjectUiScope = 'primary' | 'secondary';

export interface ProjectTaskFilter { kontaktId: string; von: string; bis: string; }
const EMPTY_PROJECT_TASK_FILTER: ProjectTaskFilter = { kontaktId: '', von: '', bis: '' };

export interface ProjectUiState {
  editingContact: string | null;
  editingComm: string | null;
  editingTaskId: string | null;
  editingMilestone: string | null;
  editingUpdateId: string | null;
  editingDocSectionId: string | null;
  showNewCommForm: boolean;
  showNewTaskForm: boolean;
  showNewUpdateForm: boolean;
  showTaskFilters: boolean;
  showCompletedKanban: boolean;
  taskFilterTab: TaskFilterTab;
  projectTaskFilter: ProjectTaskFilter;
  setEditingContact: (id: string | null) => void;
  setEditingComm: (id: string | null) => void;
  setEditingTaskId: (id: string | null) => void;
  setEditingMilestone: (id: string | null) => void;
  setEditingUpdateId: (id: string | null) => void;
  setEditingDocSectionId: (id: string | null) => void;
  setShowNewCommForm: (value: boolean) => void;
  setShowNewTaskForm: (value: boolean) => void;
  setShowNewUpdateForm: (value: boolean) => void;
  toggleShowTaskFilters: () => void;
  toggleShowCompletedKanban: () => void;
  setTaskFilterTab: (tab: TaskFilterTab) => void;
  setProjectTaskFilter: (patch: Partial<ProjectTaskFilter>) => void;
  resetProjectTaskFilter: () => void;
  jumpToTask: (taskId: string) => void;
  jumpToComm: (commId: string) => void;
}

function activateTab(scope: ProjectUiScope, tab: string) {
  if (scope === 'secondary') useUiStore.getState().setSecondaryTab(tab);
  else useUiStore.getState().setActiveTab(tab);
}

function createScopedStore(scope: ProjectUiScope): StoreApi<ProjectUiState> {
  return createStore<ProjectUiState>((set) => ({
    editingContact: null, editingComm: null, editingTaskId: null, editingMilestone: null,
    editingUpdateId: null, editingDocSectionId: null, showNewCommForm: false,
    showNewTaskForm: false, showNewUpdateForm: false, showTaskFilters: false,
    showCompletedKanban: false, taskFilterTab: 'offen', projectTaskFilter: EMPTY_PROJECT_TASK_FILTER,
    setEditingContact: (id) => set({ editingContact: id }),
    setEditingComm: (id) => set({ editingComm: id }),
    setEditingTaskId: (id) => set({ editingTaskId: id }),
    setEditingMilestone: (id) => set({ editingMilestone: id }),
    setEditingUpdateId: (id) => set({ editingUpdateId: id }),
    setEditingDocSectionId: (id) => set({ editingDocSectionId: id }),
    setShowNewCommForm: (value) => set({ showNewCommForm: value }),
    setShowNewTaskForm: (value) => set({ showNewTaskForm: value }),
    setShowNewUpdateForm: (value) => set({ showNewUpdateForm: value }),
    toggleShowTaskFilters: () => set((state) => ({ showTaskFilters: !state.showTaskFilters })),
    toggleShowCompletedKanban: () => set((state) => ({ showCompletedKanban: !state.showCompletedKanban })),
    setTaskFilterTab: (tab) => set({ taskFilterTab: tab }),
    setProjectTaskFilter: (patch) => set((state) => ({ projectTaskFilter: { ...state.projectTaskFilter, ...patch } })),
    resetProjectTaskFilter: () => set({ projectTaskFilter: EMPTY_PROJECT_TASK_FILTER }),
    jumpToTask: (taskId) => {
      const selectedId = scope === 'secondary' ? useUiStore.getState().secondaryPane?.selectedId : useUiStore.getState().selectedId;
      const task = selectedId ? useDataStore.getState().cache[selectedId]?.tasks.find((item) => item.id === taskId) : undefined;
      activateTab(scope, 'aufgaben');
      set({ taskFilterTab: task?.status === 'erledigt' ? 'erledigt' : task?.status === 'wartet' ? 'wartet' : 'offen', editingTaskId: taskId, editingComm: null });
    },
    jumpToComm: (commId) => { activateTab(scope, 'kommunikation'); set({ editingComm: commId, editingTaskId: null }); },
  }));
}

const scopedStores: Record<ProjectUiScope, StoreApi<ProjectUiState>> = {
  primary: createScopedStore('primary'),
  secondary: createScopedStore('secondary'),
};
const ProjectUiContext = createContext<StoreApi<ProjectUiState>>(scopedStores.primary);

export function ProjectUiScopeProvider({ scope, children }: { scope: ProjectUiScope; children: ReactNode }) {
  return createElement(ProjectUiContext.Provider, { value: scopedStores[scope] }, children);
}

export function getProjectUiStore(scope: ProjectUiScope = 'primary') { return scopedStores[scope]; }

export function useProjectUiStore(): ProjectUiState;
export function useProjectUiStore<T>(selector: (state: ProjectUiState) => T): T;
export function useProjectUiStore<T>(selector?: (state: ProjectUiState) => T): T | ProjectUiState {
  const store = useContext(ProjectUiContext);
  const resolvedSelector = (selector || ((state: ProjectUiState) => state)) as (state: ProjectUiState) => T | ProjectUiState;
  return useStore(store, resolvedSelector);
}
