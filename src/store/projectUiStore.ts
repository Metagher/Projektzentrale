import { create } from 'zustand';
import { useUiStore } from './uiStore';
import { useDataStore } from './dataStore';

export type TaskFilterTab = 'offen' | 'wartet' | 'erledigt';

export interface ProjectTaskFilter {
  prioritaet: string;
  kontaktId: string;
  von: string;
  bis: string;
}

const EMPTY_PROJECT_TASK_FILTER: ProjectTaskFilter = { prioritaet: '', kontaktId: '', von: '', bis: '' };

interface ProjectUiState {
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
  setShowNewCommForm: (v: boolean) => void;
  setShowNewTaskForm: (v: boolean) => void;
  setShowNewUpdateForm: (v: boolean) => void;
  toggleShowTaskFilters: () => void;
  toggleShowCompletedKanban: () => void;
  setTaskFilterTab: (tab: TaskFilterTab) => void;
  setProjectTaskFilter: (patch: Partial<ProjectTaskFilter>) => void;
  resetProjectTaskFilter: () => void;

  jumpToTask: (taskId: string) => void;
  jumpToComm: (commId: string) => void;
}

export const useProjectUiStore = create<ProjectUiState>((set) => ({
  editingContact: null,
  editingComm: null,
  editingTaskId: null,
  editingMilestone: null,
  editingUpdateId: null,
  editingDocSectionId: null,
  showNewCommForm: false,
  showNewTaskForm: false,
  showNewUpdateForm: false,
  showTaskFilters: false,
  showCompletedKanban: false,
  taskFilterTab: 'offen',
  projectTaskFilter: EMPTY_PROJECT_TASK_FILTER,

  setEditingContact: (id) => set({ editingContact: id }),
  setEditingComm: (id) => set({ editingComm: id }),
  setEditingTaskId: (id) => set({ editingTaskId: id }),
  setEditingMilestone: (id) => set({ editingMilestone: id }),
  setEditingUpdateId: (id) => set({ editingUpdateId: id }),
  setEditingDocSectionId: (id) => set({ editingDocSectionId: id }),
  setShowNewCommForm: (v) => set({ showNewCommForm: v }),
  setShowNewTaskForm: (v) => set({ showNewTaskForm: v }),
  setShowNewUpdateForm: (v) => set({ showNewUpdateForm: v }),
  toggleShowTaskFilters: () => set((s) => ({ showTaskFilters: !s.showTaskFilters })),
  toggleShowCompletedKanban: () => set((s) => ({ showCompletedKanban: !s.showCompletedKanban })),
  setTaskFilterTab: (tab) => set({ taskFilterTab: tab }),
  setProjectTaskFilter: (patch) => set((s) => ({ projectTaskFilter: { ...s.projectTaskFilter, ...patch } })),
  resetProjectTaskFilter: () => set({ projectTaskFilter: EMPTY_PROJECT_TASK_FILTER }),

  jumpToTask: (taskId) => {
    const selectedId = useUiStore.getState().selectedId;
    const data = selectedId ? useDataStore.getState().cache[selectedId] : undefined;
    const task = data?.tasks.find((t) => t.id === taskId);
    useUiStore.getState().setActiveTab('aufgaben');
    set({
      taskFilterTab: task ? (task.status === 'erledigt' ? 'erledigt' : task.status === 'wartet' ? 'wartet' : 'offen') : 'offen',
      editingTaskId: taskId,
      editingComm: null,
    });
  },
  jumpToComm: (commId) => {
    useUiStore.getState().setActiveTab('kommunikation');
    set({ editingComm: commId, editingTaskId: null });
  },
}));
