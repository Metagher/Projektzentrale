import { create } from 'zustand';
import { sDelete, sGet, sSet } from '../lib/supabase';
import { useConnectionStore } from './connectionStore';
import { DEFAULT_DOC_SECTIONS } from '../lib/constants';
import { DEFAULT_TASK_COLOR_LABELS, DEFAULT_TASK_COLOR_ORDER, compareTaskColors, compareWaitingPerson, normalizeTaskColorLabels, normalizeTaskColorOrder, type TaskColorLabels } from '../lib/taskColors';
import { isDefaultWorkday, type WorkdayOverrides } from '../lib/workdays';
import { migratePrio, migrateTaskContent } from '../lib/migrations';
import { hasEchtlauf, todayStr, uid } from '../lib/format';
import { effectiveCustomerOrder, groupProjectsByCustomer } from '../lib/projectGroups';
import type {
  Comm,
  Contact,
  DocData,
  DocEntryValue,
  DocSectionDef,
  Milestone,
  ErpModule,
  CustomerModule,
  ProjectModuleConfig,
  TimeEntry,
  ActiveTimer,
  Project,
  ProjectDocumentationArea,
  ProjectStatusEntry,
  ProjectCache,
  ProjectTyp,
  Task,
  TaskColor,
  UpdateEntry,
} from '../types/entities';

function client() {
  const c = useConnectionStore.getState().client;
  if (!c) throw new Error('Nicht mit Supabase verbunden.');
  return c;
}

export interface TaskWithMeta extends Task {
  projectId: string;
  projectName: string;
}
export interface MilestoneWithMeta extends Milestone {
  projectId: string;
  projectName: string;
}
export interface ContactWithMeta {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
}

export interface DashboardData {
  openTasks: TaskWithMeta[];
  tasksWithDate: TaskWithMeta[];
  tasksNoDate: TaskWithMeta[];
  waitingTasks: TaskWithMeta[];
  completedTasks: TaskWithMeta[];
  upcomingMilestones: MilestoneWithMeta[];
  allContacts: ContactWithMeta[];
  overdueTasks: TaskWithMeta[];
}

function emptyProjectCache(): ProjectCache {
  return { contacts: [], comms: [], doc: {}, tasks: [], timeline: [], updates: [], aiSummary: null, moduleConfigs: [] };
}

interface DataStoreState {
  projects: Project[] | null;
  docDefs: DocSectionDef[] | null;
  cache: Record<string, ProjectCache | undefined>;
  taskNrCounter: number | undefined;
  dashboardData: DashboardData | null;
  taskColorOrder: TaskColor[];
  taskColorLabels: TaskColorLabels;
  waitingOptions: string[];
  workdayOverrides: WorkdayOverrides;
  customerOrder: string[];
  modules: ErpModule[];
  customerModules: CustomerModule[];
  timeEntries: TimeEntry[];
  activeTimer: ActiveTimer | null;

  loadAll: () => Promise<void>;
  ensureProjectData: (id: string) => Promise<ProjectCache>;
  loadDashboardData: () => Promise<void>;
  createProject: (input: { name: string; kunde: string; typ: ProjectTyp }) => Promise<string>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  reorderProjects: (sourceId: string, targetId: string, placeAfter: boolean) => Promise<void>;
  /** Reorders the customer groups themselves (independent of project order within a group). */
  reorderCustomerGroups: (sourceKey: string, targetKey: string, placeAfter: boolean) => Promise<void>;

  nextTaskNr: () => Promise<number>;
  saveTask: (projectId: string, task: Task) => Promise<void>;
  createTask: (projectId: string, partial: Omit<Task, 'id' | 'nr' | 'erstelltAm' | 'abgeschlossenAm'>) => Promise<string>;
  deleteTask: (projectId: string, taskId: string) => Promise<void>;
  setAllOverdueTasksToToday: () => Promise<void>;
  setAllNoDateTasksToToday: () => Promise<void>;
  reorderDailyTasks: (date: string, orderedTasks: TaskWithMeta[]) => Promise<void>;
  moveTaskToDailyDate: (projectId: string, taskId: string, date: string) => Promise<void>;

  saveContact: (projectId: string, contact: Contact) => Promise<void>;
  deleteContact: (projectId: string, contactId: string) => Promise<void>;
  saveComm: (projectId: string, comm: Comm) => Promise<void>;
  deleteComm: (projectId: string, commId: string) => Promise<void>;
  saveMilestone: (projectId: string, m: Milestone) => Promise<void>;
  deleteMilestone: (projectId: string, id: string) => Promise<void>;
  saveUpdateEntry: (projectId: string, u: UpdateEntry) => Promise<void>;
  deleteUpdateEntry: (projectId: string, id: string) => Promise<void>;
  saveDocEntry: (projectId: string, defId: string, value: DocEntryValue) => Promise<void>;
  saveProjectStatusEntry: (projectId: string, entry: ProjectStatusEntry) => Promise<void>;
  deleteProjectStatusEntry: (projectId: string, entryId: string) => Promise<void>;
  saveProjectDocumentationAreas: (projectId: string, areas: ProjectDocumentationArea[]) => Promise<void>;
  setDocHidden: (projectId: string, hidden: string[]) => Promise<void>;

  loadDocDefs: () => Promise<void>;
  saveDocDefs: (defs: DocSectionDef[]) => Promise<void>;
  saveTaskColorOrder: (order: TaskColor[]) => Promise<void>;
  saveTaskColorLabels: (labels: TaskColorLabels) => Promise<void>;
  saveWaitingOptions: (options: string[]) => Promise<void>;
  toggleWorkday: (date: string) => Promise<void>;
  saveModule: (module: ErpModule) => Promise<void>;
  reorderModule: (sourceId: string, targetId: string, placeAfter: boolean) => Promise<void>;
  deleteModule: (id: string) => Promise<void>;
  saveCustomerModule: (entry: CustomerModule) => Promise<void>;
  deleteCustomerModule: (kunde: string, moduleId: string) => Promise<void>;
  saveProjectModuleConfig: (projectId: string, config: ProjectModuleConfig) => Promise<void>;
  startTimer: (projectId: string, taskId?: string | null) => Promise<void>;
  stopTimer: () => Promise<void>;
  saveTimeEntry: (entry: TimeEntry) => Promise<void>;
  deleteTimeEntry: (id: string) => Promise<void>;

  /** Keeps task.commIds in sync after a comm's linked-tasks selection changed; persists tasks if anything changed. */
  syncTaskLinksForComm: (projectId: string, commId: string, oldTaskIds: string[], newTaskIds: string[]) => Promise<void>;
  /** Keeps comm.taskIds in sync after a task's linked-comms selection changed; persists comms if anything changed. */
  syncCommLinksForTask: (projectId: string, taskId: string, oldCommIds: string[], newCommIds: string[]) => Promise<void>;

  /**
   * Destructively replaces ALL data (projects, doc defs, and every project's contacts/
   * comms/doc/tasks/timeline/updates) — used by CSV import. Deletes storage keys of
   * previously existing projects first, then writes the new dataset.
   */
  importAllData: (input: {
    projects: Project[];
    docDefs: DocSectionDef[];
    perProject: Record<
      string,
      { contacts: Contact[]; comms: Comm[]; doc: DocData; tasks: Task[]; timeline: Milestone[]; updates: UpdateEntry[] }
    >;
    timeEntries: TimeEntry[];
  }) => Promise<void>;
}

async function persistTasks(get: () => DataStoreState, set: (p: Partial<DataStoreState>) => void, projectId: string, tasks: Task[]) {
  const cache = { ...get().cache };
  cache[projectId] = { ...(cache[projectId] || emptyProjectCache()), tasks };
  set({ cache });
  await sSet(client(), 'tasks:' + projectId, tasks);
}

export const useDataStore = create<DataStoreState>((set, get) => ({
  projects: null,
  docDefs: null,
  cache: {},
  taskNrCounter: undefined,
  dashboardData: null,
  taskColorOrder: DEFAULT_TASK_COLOR_ORDER,
  taskColorLabels: DEFAULT_TASK_COLOR_LABELS,
  waitingOptions: [],
  workdayOverrides: {},
  customerOrder: [],
  modules: [],
  customerModules: [],
  timeEntries: [],
  activeTimer: null,

  loadAll: async () => {
    const sb = client();
    let projects = (await sGet<Project[]>(sb, 'projects')) || [];
    if (projects.some((p) => p.sortIndex === undefined)) {
      projects = projects.map((p, i) => (p.sortIndex === undefined ? { ...p, sortIndex: i } : p));
      await sSet(sb, 'projects', projects);
    }
    const [storedColorOrder, storedColorLabels, storedWaitingOptions, workdayOverrides, storedCustomerOrder, modules, customerModules, timeEntries, activeTimer] = await Promise.all([
      sGet<TaskColor[]>(sb, 'task-color-order'),
      sGet<Partial<TaskColorLabels>>(sb, 'task-color-labels'),
      sGet<string[]>(sb, 'waiting-options'),
      sGet<WorkdayOverrides>(sb, 'workday-overrides'),
      sGet<string[]>(sb, 'customer-order'),
      sGet<ErpModule[]>(sb, 'erp-modules'),
      sGet<CustomerModule[]>(sb, 'customer-modules'),
      sGet<TimeEntry[]>(sb, 'time-entries'),
      sGet<ActiveTimer>(sb, 'active-timer'),
    ]);
    const nextModuleIndex = new Map<string, number>();
    const normalizedModules = (modules || []).map((module) => { const parentId = module.parentId || null; const group = parentId || '_root'; const fallbackIndex = nextModuleIndex.get(group) || 0; nextModuleIndex.set(group, fallbackIndex + 1); return { id: module.id, name: module.name, parentId, beschreibung: module.beschreibung || '', notizen: module.notizen || '', createdAt: module.createdAt || new Date().toISOString(), sortIndex: module.sortIndex ?? fallbackIndex }; });
    const legacyModuleFields = (modules || []).some((module) => { const legacy = module as ErpModule & { kategorie?: string; hersteller?: string; dokumentationsLink?: string }; return module.parentId === undefined || module.sortIndex === undefined || legacy.kategorie !== undefined || legacy.hersteller !== undefined || legacy.dokumentationsLink !== undefined; });
    if (legacyModuleFields) await sSet(sb, 'erp-modules', normalizedModules);
    const taskColorOrder = normalizeTaskColorOrder(storedColorOrder);
    const taskColorLabels = normalizeTaskColorLabels(storedColorLabels);
    set({
      projects, taskColorOrder, taskColorLabels,
      waitingOptions: storedWaitingOptions || [],
      workdayOverrides: workdayOverrides || {},
      customerOrder: storedCustomerOrder || [],
      modules: normalizedModules,
      customerModules: customerModules || [],
      timeEntries: timeEntries || [],
      activeTimer: activeTimer || null,
    });
    await get().loadDocDefs();
    await ensureTaskNumbers(get, set);
    await get().loadDashboardData();
    if (!storedWaitingOptions) {
      const inferred = Array.from(new Set((get().dashboardData?.waitingTasks || []).map((task) => task.wartetAuf.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'de'));
      set({ waitingOptions: inferred });
      await sSet(sb, 'waiting-options', inferred);
    }
  },

  loadDocDefs: async () => {
    const sb = client();
    let defs = await sGet<DocSectionDef[]>(sb, 'doc-section-defs');
    if (!defs) {
      defs = DEFAULT_DOC_SECTIONS.slice();
      await sSet(sb, 'doc-section-defs', defs);
    }
    set({ docDefs: defs });
  },

  saveDocDefs: async (defs) => {
    set({ docDefs: defs });
    await sSet(client(), 'doc-section-defs', defs);
  },

  saveTaskColorOrder: async (order) => {
    const normalized = normalizeTaskColorOrder(order);
    set({ taskColorOrder: normalized });
    await sSet(client(), 'task-color-order', normalized);
    await get().loadDashboardData();
  },

  saveTaskColorLabels: async (labels) => {
    const normalized = normalizeTaskColorLabels(labels);
    set({ taskColorLabels: normalized });
    await sSet(client(), 'task-color-labels', normalized);
  },

  saveWaitingOptions: async (options) => {
    const normalized = Array.from(new Set(options.map((option) => option.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'de'));
    set({ waitingOptions: normalized });
    await sSet(client(), 'waiting-options', normalized);
  },

  toggleWorkday: async (date) => {
    const current = get().workdayOverrides;
    const parsed = new Date(`${date}T12:00:00`);
    const defaultValue = isDefaultWorkday(parsed);
    const nextValue = !(current[date] ?? defaultValue);
    const next = { ...current };
    if (nextValue === defaultValue) delete next[date];
    else next[date] = nextValue;
    set({ workdayOverrides: next });
    await sSet(client(), 'workday-overrides', next);
  },

  ensureProjectData: async (id) => {
    const existing = get().cache[id];
    if (existing) return existing;
    const sb = client();
    const [contacts, comms, doc, rawTasks, timeline, updates, aiSummary, moduleConfigs] = await Promise.all([
      sGet<Contact[]>(sb, 'contacts:' + id),
      sGet<Comm[]>(sb, 'comms:' + id),
      sGet<DocData>(sb, 'doc:' + id),
      sGet<Task[]>(sb, 'tasks:' + id),
      sGet<Milestone[]>(sb, 'timeline:' + id),
      sGet<UpdateEntry[]>(sb, 'updates:' + id),
      sGet<ProjectCache['aiSummary']>(sb, 'ai-summary:' + id),
      sGet<ProjectModuleConfig[]>(sb, 'module-configs:' + id),
    ]);
    let tasks = rawTasks || [];
    let migrated = false;
    tasks = tasks.map((t) => {
      const fixed = migratePrio(t.prioritaet);
      const contentMigration = migrateTaskContent(t);
      if (fixed !== t.prioritaet || contentMigration.changed) {
        migrated = true;
        return { ...contentMigration.task, prioritaet: fixed };
      }
      return contentMigration.task;
    });
    if (migrated) await sSet(sb, 'tasks:' + id, tasks);
    const projectCache: ProjectCache = {
      contacts: contacts || [],
      comms: comms || [],
      doc: doc || {},
      tasks,
      timeline: timeline || [],
      updates: updates || [],
      aiSummary: aiSummary || null,
      moduleConfigs: moduleConfigs || [],
    };
    set({ cache: { ...get().cache, [id]: projectCache } });
    return projectCache;
  },

  loadDashboardData: async () => {
    const projects = get().projects || [];
    const allTasks: TaskWithMeta[] = [];
    const waitingTasks: TaskWithMeta[] = [];
    const completedTasks: TaskWithMeta[] = [];
    const allMilestones: MilestoneWithMeta[] = [];
    const allContacts: ContactWithMeta[] = [];
    for (const p of projects) {
      const c = await get().ensureProjectData(p.id);
      c.tasks.forEach((t) => {
        const withMeta: TaskWithMeta = { ...t, projectId: p.id, projectName: p.name };
        if (t.status === 'erledigt') completedTasks.push(withMeta);
        else if (t.status === 'wartet') waitingTasks.push(withMeta);
        else allTasks.push(withMeta);
      });
      c.contacts.forEach((ct) => {
        allContacts.push({ id: ct.id, name: ct.name, projectId: p.id, projectName: p.name });
      });
      if (hasEchtlauf(p)) {
        c.timeline.forEach((m) => {
          if (m.status !== 'erledigt') allMilestones.push({ ...m, projectId: p.id, projectName: p.name });
        });
      }
    }
    const colorOrder = get().taskColorOrder;
    allTasks.sort((a, b) => compareTaskColors(a, b, colorOrder) || (a.faelligAm || '9999').localeCompare(b.faelligAm || '9999'));
    waitingTasks.sort((a, b) => compareWaitingPerson(a, b) || compareTaskColors(a, b, colorOrder) || (a.faelligAm || '9999').localeCompare(b.faelligAm || '9999'));
    completedTasks.sort((a, b) => compareTaskColors(a, b, colorOrder) || (b.faelligAm || '').localeCompare(a.faelligAm || ''));
    allMilestones.sort((a, b) => (a.datum || '9999').localeCompare(b.datum || '9999'));
    allContacts.sort((a, b) => a.name.localeCompare(b.name));
    const withDate = allTasks.filter((t) => t.faelligAm);
    const noDate = allTasks.filter((t) => !t.faelligAm);
    const today = todayStr();
    const overdueTasks = [...allTasks, ...waitingTasks]
      .filter((t) => t.faelligAm && t.faelligAm < today)
      .sort((a, b) => compareTaskColors(a, b, colorOrder) || (a.faelligAm || '').localeCompare(b.faelligAm || ''));
    set({
      dashboardData: {
        openTasks: allTasks,
        tasksWithDate: withDate,
        tasksNoDate: noDate,
        waitingTasks,
        completedTasks,
        upcomingMilestones: allMilestones,
        allContacts,
        overdueTasks,
      },
    });
  },

  createProject: async ({ name, kunde, typ }) => {
    const projects = get().projects || [];
    const maxSortIndex = projects.reduce((m, p) => Math.max(m, p.sortIndex ?? 0), -1);
    const newP: Project = {
      id: uid(),
      name,
      kunde,
      typ,
      status: 'aktiv',
      beschreibung: '',
      createdAt: new Date().toISOString(),
      aktuelleVersion: '',
      sortIndex: maxSortIndex + 1,
      quickbarHidden: false,
    };
    const next = [...projects, newP];
    set({ projects: next });
    await sSet(client(), 'projects', next);
    return newP.id;
  },

  updateProject: async (id, patch) => {
    const projects = (get().projects || []).map((p) => (p.id === id ? { ...p, ...patch } : p));
    set({ projects });
    await sSet(client(), 'projects', projects);
  },

  deleteProject: async (id) => {
    const projects = (get().projects || []).filter((p) => p.id !== id);
    const timeEntries = get().timeEntries.filter((entry) => entry.projectId !== id);
    const activeTimer = get().activeTimer?.projectId === id ? null : get().activeTimer;
    set({ projects, timeEntries, activeTimer });
    const sb = client();
    await Promise.all([sSet(sb, 'projects', projects), sSet(sb, 'time-entries', timeEntries), activeTimer ? sSet(sb, 'active-timer', activeTimer) : sDelete(sb, 'active-timer')]);
    await Promise.all(
      ['contacts:', 'comms:', 'doc:', 'tasks:', 'timeline:', 'updates:', 'ai-summary:', 'module-configs:'].map((prefix) =>
        sDelete(sb, prefix + id),
      ),
    );
    const cache = { ...get().cache };
    delete cache[id];
    set({ cache });
  },

  /**
   * Moves sourceId to sit directly before/after targetId in the flat sortIndex order, then
   * renumbers all projects sequentially. Grouping (by status in the quickbar, by customer
   * in Projektverwaltung) is a pure rendering concern — callers restrict which drags are
   * valid via useDragReorder's getGroupKey, not this action, so the same reorder logic
   * works for every grouped view without the two stepping on each other's ordering.
   */
  reorderProjects: async (sourceId, targetId, placeAfter) => {
    const sorted = (get().projects || []).slice().sort((a, b) => {
      const ia = a.sortIndex ?? 0;
      const ib = b.sortIndex ?? 0;
      if (ia !== ib) return ia - ib;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    const srcIdx = sorted.findIndex((p) => p.id === sourceId);
    const tgtIdx = sorted.findIndex((p) => p.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) return;
    const [moved] = sorted.splice(srcIdx, 1);
    const newTgtIdx = sorted.findIndex((p) => p.id === targetId);
    sorted.splice(placeAfter ? newTgtIdx + 1 : newTgtIdx, 0, moved);
    sorted.forEach((p, i) => {
      p.sortIndex = i;
    });
    set({ projects: sorted });
    await sSet(client(), 'projects', sorted);
  },

  reorderCustomerGroups: async (sourceKey, targetKey, placeAfter) => {
    const groups = groupProjectsByCustomer(get().projects || []);
    const order = effectiveCustomerOrder(groups, get().customerOrder);
    const srcIdx = order.indexOf(sourceKey);
    const tgtIdx = order.indexOf(targetKey);
    if (srcIdx < 0 || tgtIdx < 0) return;
    const next = order.slice();
    const [moved] = next.splice(srcIdx, 1);
    const newTgtIdx = next.indexOf(targetKey);
    next.splice(placeAfter ? newTgtIdx + 1 : newTgtIdx, 0, moved);
    set({ customerOrder: next });
    await sSet(client(), 'customer-order', next);
  },

  nextTaskNr: async () => {
    let counter = get().taskNrCounter;
    if (counter === undefined) {
      counter = (await sGet<number>(client(), 'taskNrCounter')) || 0;
    }
    counter += 1;
    set({ taskNrCounter: counter });
    await sSet(client(), 'taskNrCounter', counter);
    return counter;
  },

  saveTask: async (projectId, task) => {
    const data = await get().ensureProjectData(projectId);
    const idx = data.tasks.findIndex((t) => t.id === task.id);
    const normalizedTask = idx >= 0 && data.tasks[idx].faelligAm !== task.faelligAm ? { ...task, tagesSortierung: 999 } : task;
    const tasks = idx >= 0 ? data.tasks.map((t, i) => (i === idx ? normalizedTask : t)) : [...data.tasks, normalizedTask];
    await persistTasks(get, set, projectId, tasks);
    await get().loadDashboardData();
  },

  createTask: async (projectId, partial) => {
    const nr = await get().nextTaskNr();
    const task: Task = {
      ...partial,
      id: uid(),
      nr,
      erstelltAm: new Date().toISOString(),
      abgeschlossenAm: null,
      tagesSortierung: 999,
    };
    const data = await get().ensureProjectData(projectId);
    await persistTasks(get, set, projectId, [...data.tasks, task]);
    await get().loadDashboardData();
    return task.id;
  },

  deleteTask: async (projectId, taskId) => {
    if (get().activeTimer?.projectId === projectId && get().activeTimer?.taskId === taskId) await get().stopTimer();
    const data = await get().ensureProjectData(projectId);
    const tasks = data.tasks.filter((t) => t.id !== taskId);
    await persistTasks(get, set, projectId, tasks);
    await get().loadDashboardData();
  },

  setAllOverdueTasksToToday: async () => {
    const today = todayStr();
    const byProject: Record<string, string[]> = {};
    (get().dashboardData?.overdueTasks || []).forEach((t) => {
      (byProject[t.projectId] = byProject[t.projectId] || []).push(t.id);
    });
    for (const projectId of Object.keys(byProject)) {
      const data = await get().ensureProjectData(projectId);
      const ids = byProject[projectId];
      const tasks = data.tasks.map((t) => (ids.includes(t.id) ? { ...t, faelligAm: today, tagesSortierung: 999 } : t));
      await persistTasks(get, set, projectId, tasks);
    }
    await get().loadDashboardData();
  },

  setAllNoDateTasksToToday: async () => {
    const today = todayStr();
    const byProject: Record<string, string[]> = {};
    (get().dashboardData?.tasksNoDate || []).forEach((t) => {
      (byProject[t.projectId] = byProject[t.projectId] || []).push(t.id);
    });
    for (const projectId of Object.keys(byProject)) {
      const data = await get().ensureProjectData(projectId);
      const ids = byProject[projectId];
      const tasks = data.tasks.map((t) => (ids.includes(t.id) ? { ...t, faelligAm: today } : t));
      await persistTasks(get, set, projectId, tasks);
    }
    await get().loadDashboardData();
  },

  reorderDailyTasks: async (date, orderedTasks) => {
    const byProject = new Map<string, Map<string, number>>();
    orderedTasks.forEach((task, index) => {
      if (task.faelligAm !== date) return;
      if (!byProject.has(task.projectId)) byProject.set(task.projectId, new Map());
      byProject.get(task.projectId)!.set(task.id, index + 1);
    });
    const projectIds = new Set((get().dashboardData?.tasksWithDate || []).filter((task) => task.faelligAm === date).map((task) => task.projectId));
    orderedTasks.forEach((task) => projectIds.add(task.projectId));
    for (const projectId of projectIds) {
      const ranks = byProject.get(projectId) || new Map<string, number>();
      const data = await get().ensureProjectData(projectId);
      const tasks = data.tasks.map((task) => task.faelligAm === date
        ? { ...task, tagesSortierung: ranks.get(task.id) ?? 999 }
        : task);
      await persistTasks(get, set, projectId, tasks);
    }
    await get().loadDashboardData();
  },

  moveTaskToDailyDate: async (projectId, taskId, date) => {
    const data = await get().ensureProjectData(projectId);
    const tasks = data.tasks.map((task) => task.id === taskId
      ? { ...task, faelligAm: date, tagesSortierung: 999 }
      : task);
    await persistTasks(get, set, projectId, tasks);
    await get().loadDashboardData();
  },

  saveContact: async (projectId, contact) => {
    const data = await get().ensureProjectData(projectId);
    const idx = data.contacts.findIndex((c) => c.id === contact.id);
    const contacts = idx >= 0 ? data.contacts.map((c, i) => (i === idx ? contact : c)) : [...data.contacts, contact];
    const cache = { ...get().cache, [projectId]: { ...data, contacts } };
    set({ cache });
    await sSet(client(), 'contacts:' + projectId, contacts);
    await get().loadDashboardData();
  },

  deleteContact: async (projectId, contactId) => {
    const data = await get().ensureProjectData(projectId);
    const contacts = data.contacts.filter((c) => c.id !== contactId);
    const cache = { ...get().cache, [projectId]: { ...data, contacts } };
    set({ cache });
    await sSet(client(), 'contacts:' + projectId, contacts);
    await get().loadDashboardData();
  },

  saveComm: async (projectId, comm) => {
    const data = await get().ensureProjectData(projectId);
    const idx = data.comms.findIndex((c) => c.id === comm.id);
    const comms = idx >= 0 ? data.comms.map((c, i) => (i === idx ? comm : c)) : [...data.comms, comm];
    const cache = { ...get().cache, [projectId]: { ...data, comms } };
    set({ cache });
    await sSet(client(), 'comms:' + projectId, comms);
  },

  deleteComm: async (projectId, commId) => {
    const data = await get().ensureProjectData(projectId);
    const comms = data.comms.filter((c) => c.id !== commId);
    const cache = { ...get().cache, [projectId]: { ...data, comms } };
    set({ cache });
    await sSet(client(), 'comms:' + projectId, comms);
  },

  saveMilestone: async (projectId, m) => {
    const data = await get().ensureProjectData(projectId);
    const idx = data.timeline.findIndex((x) => x.id === m.id);
    const timeline = idx >= 0 ? data.timeline.map((x, i) => (i === idx ? m : x)) : [...data.timeline, m];
    const cache = { ...get().cache, [projectId]: { ...data, timeline } };
    set({ cache });
    await sSet(client(), 'timeline:' + projectId, timeline);
    await get().loadDashboardData();
  },

  deleteMilestone: async (projectId, id) => {
    const data = await get().ensureProjectData(projectId);
    const timeline = data.timeline.filter((x) => x.id !== id);
    const cache = { ...get().cache, [projectId]: { ...data, timeline } };
    set({ cache });
    await sSet(client(), 'timeline:' + projectId, timeline);
    await get().loadDashboardData();
  },

  saveUpdateEntry: async (projectId, u) => {
    const data = await get().ensureProjectData(projectId);
    const idx = data.updates.findIndex((x) => x.id === u.id);
    const updates = idx >= 0 ? data.updates.map((x, i) => (i === idx ? u : x)) : [...data.updates, u];
    const cache = { ...get().cache, [projectId]: { ...data, updates } };
    set({ cache });
    await sSet(client(), 'updates:' + projectId, updates);
  },

  deleteUpdateEntry: async (projectId, id) => {
    const data = await get().ensureProjectData(projectId);
    const updates = data.updates.filter((x) => x.id !== id);
    const cache = { ...get().cache, [projectId]: { ...data, updates } };
    set({ cache });
    await sSet(client(), 'updates:' + projectId, updates);
  },

  saveDocEntry: async (projectId, defId, value) => {
    const data = await get().ensureProjectData(projectId);
    const doc = { ...data.doc, [defId]: value };
    const cache = { ...get().cache, [projectId]: { ...data, doc } };
    set({ cache });
    await sSet(client(), 'doc:' + projectId, doc);
  },

  saveProjectStatusEntry: async (projectId, entry) => {
    const data = await get().ensureProjectData(projectId);
    const current = (data.doc._statusHistory as ProjectStatusEntry[] | undefined) || [];
    const index = current.findIndex((item) => item.id === entry.id);
    const history = index >= 0 ? current.map((item, i) => i === index ? entry : item) : [...current, entry];
    const doc = { ...data.doc, _statusHistory: history };
    const cache = { ...get().cache, [projectId]: { ...data, doc } };
    set({ cache });
    await sSet(client(), 'doc:' + projectId, doc);
  },

  deleteProjectStatusEntry: async (projectId, entryId) => {
    const data = await get().ensureProjectData(projectId);
    const history = ((data.doc._statusHistory as ProjectStatusEntry[] | undefined) || []).filter((item) => item.id !== entryId);
    const doc = { ...data.doc, _statusHistory: history };
    const cache = { ...get().cache, [projectId]: { ...data, doc } };
    set({ cache });
    await sSet(client(), 'doc:' + projectId, doc);
  },

  saveProjectDocumentationAreas: async (projectId, areas) => {
    const data = await get().ensureProjectData(projectId);
    const doc = { ...data.doc, _documentationAreas: areas };
    const cache = { ...get().cache, [projectId]: { ...data, doc } };
    set({ cache });
    await sSet(client(), 'doc:' + projectId, doc);
  },

  setDocHidden: async (projectId, hidden) => {
    const data = await get().ensureProjectData(projectId);
    const doc = { ...data.doc, _hidden: hidden };
    const cache = { ...get().cache, [projectId]: { ...data, doc } };
    set({ cache });
    await sSet(client(), 'doc:' + projectId, doc);
  },

  saveModule: async (module) => {
    const current = get().modules;
    const exists = current.some((item) => item.id === module.id);
    const saved = exists ? module : { ...module, sortIndex: Math.max(-1, ...current.filter((item) => item.parentId === module.parentId).map((item) => item.sortIndex)) + 1 };
    const modules = exists ? current.map((item) => item.id === module.id ? saved : item) : [...current, saved];
    set({ modules });
    await sSet(client(), 'erp-modules', modules);
  },

  reorderModule: async (sourceId, targetId, placeAfter) => {
    const current = get().modules;
    const source = current.find((item) => item.id === sourceId);
    const target = current.find((item) => item.id === targetId);
    if (!source || !target || source.parentId !== target.parentId) return;
    const siblings = current.filter((item) => item.parentId === source.parentId).sort((a, b) => a.sortIndex - b.sortIndex);
    const sourceIndex = siblings.findIndex((item) => item.id === sourceId);
    siblings.splice(sourceIndex, 1);
    const targetIndex = siblings.findIndex((item) => item.id === targetId);
    siblings.splice(placeAfter ? targetIndex + 1 : targetIndex, 0, source);
    const order = new Map(siblings.map((item, index) => [item.id, index]));
    const modules = current.map((item) => order.has(item.id) ? { ...item, sortIndex: order.get(item.id) as number } : item);
    set({ modules });
    await sSet(client(), 'erp-modules', modules);
  },

  deleteModule: async (id) => {
    const ids = new Set([id, ...get().modules.filter((item) => item.parentId === id).map((item) => item.id)]);
    const modules = get().modules.filter((item) => !ids.has(item.id));
    const customerModules = get().customerModules.filter((item) => !ids.has(item.moduleId));
    const cache = { ...get().cache };
    await Promise.all(Object.entries(cache).map(async ([projectId, data]) => {
      if (!data) return;
      const moduleConfigs = data.moduleConfigs.filter((item) => !ids.has(item.moduleId));
      const tasks = data.tasks.map((task) => ({ ...task, moduleIds: (task.moduleIds || []).filter((moduleId) => !ids.has(moduleId)) }));
      cache[projectId] = { ...data, moduleConfigs, tasks };
      await Promise.all([sSet(client(), 'module-configs:' + projectId, moduleConfigs), sSet(client(), 'tasks:' + projectId, tasks)]);
    }));
    set({ modules, customerModules, cache });
    await Promise.all([sSet(client(), 'erp-modules', modules), sSet(client(), 'customer-modules', customerModules)]);
  },

  saveCustomerModule: async (entry) => {
    const current = get().customerModules;
    const customerModules = current.some((item) => item.kunde === entry.kunde && item.moduleId === entry.moduleId)
      ? current.map((item) => item.kunde === entry.kunde && item.moduleId === entry.moduleId ? entry : item)
      : [...current, entry];
    set({ customerModules });
    await sSet(client(), 'customer-modules', customerModules);
  },

  deleteCustomerModule: async (kunde, moduleId) => {
    const customerModules = get().customerModules.filter((item) => !(item.kunde === kunde && item.moduleId === moduleId));
    const cache = { ...get().cache };
    for (const project of (get().projects || []).filter((item) => item.kunde === kunde)) {
      const data = await get().ensureProjectData(project.id);
      const tasks = data.tasks.map((task) => ({ ...task, moduleIds: (task.moduleIds || []).filter((id) => id !== moduleId) }));
      cache[project.id] = { ...data, tasks };
      await sSet(client(), 'tasks:' + project.id, tasks);
    }
    set({ customerModules, cache });
    await sSet(client(), 'customer-modules', customerModules);
  },

  saveProjectModuleConfig: async (projectId, config) => {
    const data = await get().ensureProjectData(projectId);
    const moduleConfigs = data.moduleConfigs.some((item) => item.moduleId === config.moduleId)
      ? data.moduleConfigs.map((item) => item.moduleId === config.moduleId ? config : item)
      : [...data.moduleConfigs, config];
    const cache = { ...get().cache, [projectId]: { ...data, moduleConfigs } };
    set({ cache });
    await sSet(client(), 'module-configs:' + projectId, moduleConfigs);
  },

  startTimer: async (projectId, taskId = null) => {
    const current = get().activeTimer;
    if (current) {
      if (current.projectId === projectId && current.taskId === taskId) return;
      await get().stopTimer();
    }
    const activeTimer: ActiveTimer = { projectId, taskId, startedAt: new Date().toISOString() };
    set({ activeTimer });
    await sSet(client(), 'active-timer', activeTimer);
  },

  stopTimer: async () => {
    const timer = get().activeTimer;
    if (!timer) return;
    const endedAt = new Date().toISOString();
    const elapsedSeconds = Math.max(1, Math.round((Date.parse(endedAt) - Date.parse(timer.startedAt)) / 1000));
    const durationMinutes = elapsedSeconds / 60;
    const entry: TimeEntry = { id: uid(), ...timer, endedAt, durationMinutes, note: '', createdAt: endedAt };
    const timeEntries = [...get().timeEntries, entry];
    set({ timeEntries, activeTimer: null });
    await Promise.all([sSet(client(), 'time-entries', timeEntries), sDelete(client(), 'active-timer')]);
  },

  saveTimeEntry: async (entry) => {
    const current = get().timeEntries;
    const timeEntries = current.some((item) => item.id === entry.id)
      ? current.map((item) => item.id === entry.id ? entry : item)
      : [...current, entry];
    set({ timeEntries });
    await sSet(client(), 'time-entries', timeEntries);
  },

  deleteTimeEntry: async (id) => {
    const timeEntries = get().timeEntries.filter((item) => item.id !== id);
    set({ timeEntries });
    await sSet(client(), 'time-entries', timeEntries);
  },

  syncTaskLinksForComm: async (projectId, commId, oldTaskIds, newTaskIds) => {
    const data = await get().ensureProjectData(projectId);
    const oldSet = new Set(oldTaskIds);
    const newSet = new Set(newTaskIds);
    let changed = false;
    const tasks = data.tasks.map((t) => {
      const has = oldSet.has(t.id);
      const should = newSet.has(t.id);
      if (has && !should) {
        changed = true;
        return { ...t, commIds: (t.commIds || []).filter((id) => id !== commId) };
      }
      if (!has && should && !(t.commIds || []).includes(commId)) {
        changed = true;
        return { ...t, commIds: [...(t.commIds || []), commId] };
      }
      return t;
    });
    if (changed) await persistTasks(get, set, projectId, tasks);
  },

  syncCommLinksForTask: async (projectId, taskId, oldCommIds, newCommIds) => {
    const data = await get().ensureProjectData(projectId);
    const oldSet = new Set(oldCommIds);
    const newSet = new Set(newCommIds);
    let changed = false;
    const comms = data.comms.map((c) => {
      const has = oldSet.has(c.id);
      const should = newSet.has(c.id);
      if (has && !should) {
        changed = true;
        return { ...c, taskIds: (c.taskIds || []).filter((id) => id !== taskId) };
      }
      if (!has && should && !(c.taskIds || []).includes(taskId)) {
        changed = true;
        return { ...c, taskIds: [...(c.taskIds || []), taskId] };
      }
      return c;
    });
    if (changed) {
      const cache = { ...get().cache, [projectId]: { ...data, comms } };
      set({ cache });
      await sSet(client(), 'comms:' + projectId, comms);
    }
  },

  importAllData: async ({ projects, docDefs, perProject, timeEntries }) => {
    const sb = client();
    const previousProjects = get().projects || [];
    for (const p of previousProjects) {
      await Promise.all(
        ['contacts:', 'comms:', 'doc:', 'tasks:', 'timeline:', 'ai-summary:', 'updates:'].map((prefix) =>
          sDelete(sb, prefix + p.id),
        ),
      );
    }
    for (const p of projects) {
      const d = perProject[p.id] || { contacts: [], comms: [], doc: {}, tasks: [], timeline: [], updates: [] };
      await sSet(sb, 'contacts:' + p.id, d.contacts);
      await sSet(sb, 'comms:' + p.id, d.comms);
      await sSet(sb, 'doc:' + p.id, d.doc);
      await sSet(sb, 'tasks:' + p.id, d.tasks);
      await sSet(sb, 'timeline:' + p.id, d.timeline);
      await sSet(sb, 'updates:' + p.id, d.updates);
    }
    await sSet(sb, 'projects', projects);
    await sSet(sb, 'doc-section-defs', docDefs);
    await sSet(sb, 'time-entries', timeEntries);
    await sDelete(sb, 'active-timer');

    set({ projects, docDefs, cache: {}, timeEntries, activeTimer: null });
    await ensureTaskNumbers(get, set);
    await get().loadDashboardData();
  },
}));

/**
 * One-time-at-boot backfill: legacy tasks without a global sequential `nr` get one,
 * assigned chronologically by erstelltAm across all projects. Idempotent — no-ops once
 * every task has a number.
 */
async function ensureTaskNumbers(get: () => DataStoreState, set: (p: Partial<DataStoreState>) => void) {
  const projects = get().projects || [];
  const dataByProject: Record<string, ProjectCache> = {};
  let anyMissing = false;
  for (const p of projects) {
    const data = await get().ensureProjectData(p.id);
    dataByProject[p.id] = data;
    if (data.tasks.some((t) => !t.nr)) anyMissing = true;
  }
  if (!anyMissing) return;
  const allMissing: Task[] = [];
  projects.forEach((p) => {
    dataByProject[p.id].tasks.forEach((t) => {
      if (!t.nr) allMissing.push(t);
    });
  });
  allMissing.sort((a, b) => (a.erstelltAm || '').localeCompare(b.erstelltAm || '') || a.id.localeCompare(b.id));
  let maxExisting = 0;
  projects.forEach((p) => {
    dataByProject[p.id].tasks.forEach((t) => {
      if (t.nr && t.nr > maxExisting) maxExisting = t.nr;
    });
  });
  let counter = maxExisting;
  allMissing.forEach((t) => {
    counter += 1;
    t.nr = counter;
  });
  const sb = client();
  const cache = { ...get().cache };
  for (const p of projects) {
    cache[p.id] = dataByProject[p.id];
    await sSet(sb, 'tasks:' + p.id, dataByProject[p.id].tasks);
  }
  set({ cache, taskNrCounter: counter });
  await sSet(sb, 'taskNrCounter', counter);
}
