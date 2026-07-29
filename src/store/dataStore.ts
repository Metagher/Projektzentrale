import { create } from 'zustand';
import { sDelete, sGet, sSet } from '../lib/supabase';
import { useConnectionStore } from './connectionStore';
import { DEFAULT_DOC_SECTIONS } from '../lib/constants';
import { migratePrio } from '../lib/migrations';
import { hasEchtlauf, todayStr, uid } from '../lib/format';
import type {
  Comm,
  Contact,
  DocData,
  DocEntryValue,
  DocSectionDef,
  Milestone,
  Project,
  ProjectCache,
  ProjectTyp,
  Task,
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
  return { contacts: [], comms: [], doc: {}, tasks: [], timeline: [], updates: [], aiSummary: null };
}

interface DataStoreState {
  projects: Project[] | null;
  docDefs: DocSectionDef[] | null;
  cache: Record<string, ProjectCache | undefined>;
  taskNrCounter: number | undefined;
  dashboardData: DashboardData | null;

  loadAll: () => Promise<void>;
  ensureProjectData: (id: string) => Promise<ProjectCache>;
  loadDashboardData: () => Promise<void>;
  createProject: (input: { name: string; kunde: string; typ: ProjectTyp }) => Promise<string>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  reorderProjects: (sourceId: string, targetId: string, placeAfter: boolean) => Promise<void>;

  nextTaskNr: () => Promise<number>;
  saveTask: (projectId: string, task: Task) => Promise<void>;
  createTask: (projectId: string, partial: Omit<Task, 'id' | 'nr' | 'erstelltAm' | 'abgeschlossenAm'>) => Promise<void>;
  deleteTask: (projectId: string, taskId: string) => Promise<void>;
  setAllOverdueTasksToToday: () => Promise<void>;
  setAllNoDateTasksToToday: () => Promise<void>;

  saveContact: (projectId: string, contact: Contact) => Promise<void>;
  deleteContact: (projectId: string, contactId: string) => Promise<void>;
  saveComm: (projectId: string, comm: Comm) => Promise<void>;
  deleteComm: (projectId: string, commId: string) => Promise<void>;
  saveMilestone: (projectId: string, m: Milestone) => Promise<void>;
  deleteMilestone: (projectId: string, id: string) => Promise<void>;
  saveUpdateEntry: (projectId: string, u: UpdateEntry) => Promise<void>;
  deleteUpdateEntry: (projectId: string, id: string) => Promise<void>;
  saveDocEntry: (projectId: string, defId: string, value: DocEntryValue) => Promise<void>;
  setDocHidden: (projectId: string, hidden: string[]) => Promise<void>;

  loadDocDefs: () => Promise<void>;
  saveDocDefs: (defs: DocSectionDef[]) => Promise<void>;
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

  loadAll: async () => {
    const sb = client();
    let projects = (await sGet<Project[]>(sb, 'projects')) || [];
    if (projects.some((p) => p.sortIndex === undefined)) {
      projects = projects.map((p, i) => (p.sortIndex === undefined ? { ...p, sortIndex: i } : p));
      await sSet(sb, 'projects', projects);
    }
    set({ projects });
    await get().loadDocDefs();
    await ensureTaskNumbers(get, set);
    await get().loadDashboardData();
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

  ensureProjectData: async (id) => {
    const existing = get().cache[id];
    if (existing) return existing;
    const sb = client();
    const [contacts, comms, doc, rawTasks, timeline, updates, aiSummary] = await Promise.all([
      sGet<Contact[]>(sb, 'contacts:' + id),
      sGet<Comm[]>(sb, 'comms:' + id),
      sGet<DocData>(sb, 'doc:' + id),
      sGet<Task[]>(sb, 'tasks:' + id),
      sGet<Milestone[]>(sb, 'timeline:' + id),
      sGet<UpdateEntry[]>(sb, 'updates:' + id),
      sGet<ProjectCache['aiSummary']>(sb, 'ai-summary:' + id),
    ]);
    let tasks = rawTasks || [];
    let migrated = false;
    tasks = tasks.map((t) => {
      const fixed = migratePrio(t.prioritaet);
      if (fixed !== t.prioritaet) {
        migrated = true;
        return { ...t, prioritaet: fixed };
      }
      return t;
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
    allTasks.sort((a, b) => (a.faelligAm || '9999').localeCompare(b.faelligAm || '9999'));
    waitingTasks.sort((a, b) => (a.faelligAm || '9999').localeCompare(b.faelligAm || '9999'));
    completedTasks.sort((a, b) => (b.faelligAm || '').localeCompare(a.faelligAm || ''));
    allMilestones.sort((a, b) => (a.datum || '9999').localeCompare(b.datum || '9999'));
    allContacts.sort((a, b) => a.name.localeCompare(b.name));
    const withDate = allTasks.filter((t) => t.faelligAm);
    const noDate = allTasks.filter((t) => !t.faelligAm);
    const today = todayStr();
    const overdueTasks = [...allTasks, ...waitingTasks]
      .filter((t) => t.faelligAm && t.faelligAm < today)
      .sort((a, b) => (a.faelligAm || '').localeCompare(b.faelligAm || ''));
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
    set({ projects });
    const sb = client();
    await sSet(sb, 'projects', projects);
    await Promise.all(
      ['contacts:', 'comms:', 'doc:', 'tasks:', 'timeline:', 'updates:', 'ai-summary:'].map((prefix) =>
        sDelete(sb, prefix + id),
      ),
    );
    const cache = { ...get().cache };
    delete cache[id];
    set({ cache });
  },

  reorderProjects: async (sourceId, targetId, placeAfter) => {
    const order: Record<string, number> = { aktiv: 0, pausiert: 1, abgeschlossen: 2 };
    const sorted = (get().projects || []).slice().sort((a, b) => {
      const oa = order[a.status] ?? 3;
      const ob = order[b.status] ?? 3;
      if (oa !== ob) return oa - ob;
      const ia = a.sortIndex ?? 0;
      const ib = b.sortIndex ?? 0;
      if (ia !== ib) return ia - ib;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    const srcIdx = sorted.findIndex((p) => p.id === sourceId);
    const tgtIdx = sorted.findIndex((p) => p.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0 || sorted[srcIdx].status !== sorted[tgtIdx].status) return;
    const [moved] = sorted.splice(srcIdx, 1);
    const newTgtIdx = sorted.findIndex((p) => p.id === targetId);
    sorted.splice(placeAfter ? newTgtIdx + 1 : newTgtIdx, 0, moved);
    sorted.forEach((p, i) => {
      p.sortIndex = i;
    });
    set({ projects: sorted });
    await sSet(client(), 'projects', sorted);
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
    const tasks = idx >= 0 ? data.tasks.map((t, i) => (i === idx ? task : t)) : [...data.tasks, task];
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
    };
    const data = await get().ensureProjectData(projectId);
    await persistTasks(get, set, projectId, [...data.tasks, task]);
    await get().loadDashboardData();
  },

  deleteTask: async (projectId, taskId) => {
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
      const tasks = data.tasks.map((t) => (ids.includes(t.id) ? { ...t, faelligAm: today } : t));
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

  saveContact: async (projectId, contact) => {
    const data = await get().ensureProjectData(projectId);
    const idx = data.contacts.findIndex((c) => c.id === contact.id);
    const contacts = idx >= 0 ? data.contacts.map((c, i) => (i === idx ? contact : c)) : [...data.contacts, contact];
    const cache = { ...get().cache, [projectId]: { ...data, contacts } };
    set({ cache });
    await sSet(client(), 'contacts:' + projectId, contacts);
  },

  deleteContact: async (projectId, contactId) => {
    const data = await get().ensureProjectData(projectId);
    const contacts = data.contacts.filter((c) => c.id !== contactId);
    const cache = { ...get().cache, [projectId]: { ...data, contacts } };
    set({ cache });
    await sSet(client(), 'contacts:' + projectId, contacts);
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

  setDocHidden: async (projectId, hidden) => {
    const data = await get().ensureProjectData(projectId);
    const doc = { ...data.doc, _hidden: hidden };
    const cache = { ...get().cache, [projectId]: { ...data, doc } };
    set({ cache });
    await sSet(client(), 'doc:' + projectId, doc);
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
