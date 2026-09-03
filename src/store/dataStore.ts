import { create } from 'zustand';
import { sDelete, sGet, sSet } from '../lib/supabase';
import { useConnectionStore } from './connectionStore';
import { DEFAULT_DOC_SECTIONS } from '../lib/constants';
import { DEFAULT_TASK_COLOR_LABELS, DEFAULT_TASK_COLOR_ORDER, compareTaskColors, compareWaitingPerson, normalizeTaskColorLabels, normalizeTaskColorOrder, type TaskColorLabels } from '../lib/taskColors';
import { isDefaultWorkday, type WorkdayOverrides } from '../lib/workdays';
import { migratePrio, migrateTaskContent } from '../lib/migrations';
import { hasEchtlauf, todayStr, uid } from '../lib/format';
import { customerKey, effectiveCustomerOrder, groupProjectsByCustomer } from '../lib/projectGroups';
import { linkedContactIds, normalizeContactLinks } from '../lib/contacts';
import { DEFAULT_EXPLORER_BASE_PATH, normalizeExplorerBasePath } from '../lib/explorerPaths';
import { normalizeAbrechnungFilterPresets, type AbrechnungFilterPreset } from '../lib/abrechnungFilterPresets';
import type {
  Abrechnung,
  Comm,
  Contact,
  DocData,
  DocEntryValue,
  DocSectionDef,
  Milestone,
  ErpModule,
  CustomerModule,
  ProjectModuleConfig,
  ProjectNote,
  ProjectNoteFolder,
  ProjectTimeType,
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

export const DEFAULT_PROJECT_TIME_TYPES: ProjectTimeType[] = [{ id: 'allgemein', name: 'Allgemeine Projektzeit' }];
export const DEFAULT_ABRECHNUNGS_ARTEN: string[] = ['VO', 'MODUL', 'BO', 'ÜST', 'MM', 'DL'];

function client() {
  const c = useConnectionStore.getState().client;
  if (!c) throw new Error('Nicht mit Supabase verbunden.');
  return c;
}

export interface TaskWithMeta extends Task {
  projectId: string;
  projectName: string;
}
export interface CalendarTaskWithMeta extends TaskWithMeta {
  calendarDate: string;
  calendarKind: 'due' | 'appointment';
  calendarEntryId: string;
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
  calendarTasks: CalendarTaskWithMeta[];
  tasksNoDate: TaskWithMeta[];
  waitingTasks: TaskWithMeta[];
  completedTasks: TaskWithMeta[];
  upcomingMilestones: MilestoneWithMeta[];
  allContacts: ContactWithMeta[];
  overdueTasks: TaskWithMeta[];
}

function emptyProjectCache(): ProjectCache {
  return { contacts: [], comms: [], doc: {}, tasks: [], timeline: [], updates: [], aiSummary: null, moduleConfigs: [], notes: [], noteFolders: [] };
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
  projectTimeTypes: ProjectTimeType[];
  workdayOverrides: WorkdayOverrides;
  customerOrder: string[];
  modules: ErpModule[];
  customerModules: CustomerModule[];
  timeEntries: TimeEntry[];
  activeTimer: ActiveTimer | null;
  /** Globaler Basisordner, unter dem pro Aufgaben-ID ein Unterordner mit Projektdateien liegt. */
  explorerBasePath: string;
  /** Globale Liste aller Abrechnungs-/Provisionsvorgänge, projekt- oder kundenbezogen. */
  abrechnungen: Abrechnung[];
  /** Konfigurierbare Liste der Abrechnungsarten (z. B. VO, MODUL, BO, ÜST, MM, DL). */
  abrechnungsArten: string[];
  /** Provisionsfaktor je Abrechnungsart in Prozent (Provision = Wert * Faktor / 100). Fehlt eine Art, gibt es keine Automatik. */
  abrechnungsFaktoren: Record<string, number>;
  /** Vordefinierte Stundensätze in Cent für die Schnellberechnung von Wert = Stundensatz × Stunden. */
  stundensaetze: number[];
  /** Vorbelegte Abrechnungsart, wenn eine Abrechnung aus einer Aufgabe oder einem Kommunikationseintrag heraus erfasst wird. */
  abrechnungLinkedDefaultArt: string;
  /** Feste Liste verkaufbarer Module (Abrechnung.modul bei Art=MODUL), damit Bezeichnungen konsistent bleiben. */
  abrechnungsModule: string[];
  /** Konfigurierbare Standardfilter für die Abrechnungsseiten (Projekt und Global), per Button anwendbar. */
  abrechnungFilterPresets: AbrechnungFilterPreset[];

  loadAll: () => Promise<void>;
  ensureProjectData: (id: string) => Promise<ProjectCache>;
  loadDashboardData: () => Promise<void>;
  saveExplorerBasePath: (path: string) => Promise<void>;
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
  saveProjectTimeTypes: (types: ProjectTimeType[]) => Promise<void>;
  toggleWorkday: (date: string) => Promise<void>;
  saveModule: (module: ErpModule) => Promise<void>;
  reorderModule: (sourceId: string, targetId: string, placeAfter: boolean) => Promise<void>;
  deleteModule: (id: string) => Promise<void>;
  saveCustomerModule: (entry: CustomerModule) => Promise<void>;
  deleteCustomerModule: (kunde: string, moduleId: string) => Promise<void>;
  saveProjectModuleConfig: (projectId: string, config: ProjectModuleConfig) => Promise<void>;
  saveProjectNote: (projectId: string, note: ProjectNote) => Promise<void>;
  deleteProjectNote: (projectId: string, noteId: string) => Promise<void>;
  saveProjectNoteFolders: (projectId: string, folders: ProjectNoteFolder[]) => Promise<void>;
  saveAbrechnung: (entry: Abrechnung) => Promise<void>;
  importAbrechnungen: (entries: Abrechnung[]) => Promise<{ added: number; updated: number }>;
  deleteAbrechnung: (id: string) => Promise<void>;
  matchAbrechnungenToProjects: () => Promise<{ updated: number; unmatched: Abrechnung[] }>;
  saveAbrechnungsArten: (arten: string[]) => Promise<void>;
  saveAbrechnungsFaktoren: (faktoren: Record<string, number>) => Promise<void>;
  saveStundensaetze: (values: number[]) => Promise<void>;
  saveAbrechnungLinkedDefaultArt: (art: string) => Promise<void>;
  saveAbrechnungsModule: (modules: string[]) => Promise<void>;
  saveAbrechnungFilterPresets: (presets: AbrechnungFilterPreset[]) => Promise<void>;
  startTimer: (projectId: string, taskId?: string | null, timeTypeId?: string) => Promise<void>;
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
      { contacts: Contact[]; comms: Comm[]; doc: DocData; tasks: Task[]; timeline: Milestone[]; updates: UpdateEntry[]; notes: ProjectNote[]; noteFolders: ProjectNoteFolder[] }
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

function linkedProjectIds(projects: Project[], projectId: string, requested?: string[]): string[] {
  const existing = new Set(projects.map((project) => project.id));
  const ids = Array.from(new Set((requested?.length ? requested : [projectId]).filter((id) => existing.has(id))));
  return ids.length ? ids : [projectId];
}

function customerProjectIds(projects: Project[], projectId: string): string[] {
  const project = projects.find((item) => item.id === projectId);
  if (!project?.kunde.trim()) return [projectId];
  const key = customerKey(project.kunde).key;
  return projects.filter((item) => item.kunde.trim() && customerKey(item.kunde).key === key).map((item) => item.id);
}

function taskWithoutMeta(task: TaskWithMeta): Task {
  const { projectId: _projectId, projectName: _projectName, ...base } = task;
  void _projectId;
  void _projectName;
  return base;
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
  projectTimeTypes: DEFAULT_PROJECT_TIME_TYPES,
  workdayOverrides: {},
  customerOrder: [],
  modules: [],
  customerModules: [],
  timeEntries: [],
  activeTimer: null,
  explorerBasePath: DEFAULT_EXPLORER_BASE_PATH,
  abrechnungen: [],
  abrechnungsArten: DEFAULT_ABRECHNUNGS_ARTEN,
  abrechnungsFaktoren: {},
  stundensaetze: [],
  abrechnungLinkedDefaultArt: 'BO',
  abrechnungsModule: [],
  abrechnungFilterPresets: [],

  loadAll: async () => {
    const sb = client();
    let projects = (await sGet<Project[]>(sb, 'projects')) || [];
    if (projects.some((p) => p.sortIndex === undefined)) {
      projects = projects.map((p, i) => (p.sortIndex === undefined ? { ...p, sortIndex: i } : p));
      await sSet(sb, 'projects', projects);
    }
    const [storedColorOrder, storedColorLabels, storedWaitingOptions, storedProjectTimeTypes, workdayOverrides, storedCustomerOrder, modules, customerModules, timeEntries, activeTimer, storedExplorerBasePath, storedAbrechnungen, storedAbrechnungsArten, storedAbrechnungsFaktoren, storedStundensaetze, storedAbrechnungLinkedDefaultArt, storedAbrechnungFilterPresets, storedAbrechnungsModule] = await Promise.all([
      sGet<TaskColor[]>(sb, 'task-color-order'),
      sGet<Partial<TaskColorLabels>>(sb, 'task-color-labels'),
      sGet<string[]>(sb, 'waiting-options'),
      sGet<ProjectTimeType[]>(sb, 'project-time-types'),
      sGet<WorkdayOverrides>(sb, 'workday-overrides'),
      sGet<string[]>(sb, 'customer-order'),
      sGet<ErpModule[]>(sb, 'erp-modules'),
      sGet<CustomerModule[]>(sb, 'customer-modules'),
      sGet<TimeEntry[]>(sb, 'time-entries'),
      sGet<ActiveTimer>(sb, 'active-timer'),
      sGet<string>(sb, 'explorer-base-path'),
      sGet<Abrechnung[]>(sb, 'abrechnungen'),
      sGet<string[]>(sb, 'abrechnungs-arten'),
      sGet<Record<string, number>>(sb, 'abrechnungs-faktoren'),
      sGet<number[]>(sb, 'stundensaetze'),
      sGet<string>(sb, 'abrechnung-linked-default-art'),
      sGet<AbrechnungFilterPreset[]>(sb, 'abrechnung-filter-presets'),
      sGet<string[]>(sb, 'abrechnungs-module'),
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
      projectTimeTypes: storedProjectTimeTypes?.length ? storedProjectTimeTypes : DEFAULT_PROJECT_TIME_TYPES,
      workdayOverrides: workdayOverrides || {},
      customerOrder: storedCustomerOrder || [],
      modules: normalizedModules,
      customerModules: customerModules || [],
      timeEntries: timeEntries || [],
      activeTimer: activeTimer || null,
      explorerBasePath: storedExplorerBasePath || DEFAULT_EXPLORER_BASE_PATH,
      abrechnungen: storedAbrechnungen || [],
      abrechnungsArten: storedAbrechnungsArten?.length ? storedAbrechnungsArten : DEFAULT_ABRECHNUNGS_ARTEN,
      abrechnungsFaktoren: storedAbrechnungsFaktoren || {},
      stundensaetze: storedStundensaetze || [],
      abrechnungLinkedDefaultArt: storedAbrechnungLinkedDefaultArt || 'BO',
      abrechnungFilterPresets: storedAbrechnungFilterPresets || [],
      abrechnungsModule: storedAbrechnungsModule || [],
    });
    await get().loadDocDefs();
    await ensureTaskNumbers(get, set);
    await get().loadDashboardData();
    if (!storedWaitingOptions) {
      const inferred = Array.from(new Set((get().dashboardData?.waitingTasks || []).map((task) => task.wartetAuf.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'de'));
      set({ waitingOptions: inferred });
      await sSet(sb, 'waiting-options', inferred);
    }
    if (!storedProjectTimeTypes?.length) await sSet(sb, 'project-time-types', DEFAULT_PROJECT_TIME_TYPES);
    if (!storedAbrechnungsArten?.length) await sSet(sb, 'abrechnungs-arten', DEFAULT_ABRECHNUNGS_ARTEN);
    await migrateLegacyBilledTimeToAbrechnungen(get, set);
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

  saveExplorerBasePath: async (path) => {
    const normalized = normalizeExplorerBasePath(path) || DEFAULT_EXPLORER_BASE_PATH;
    set({ explorerBasePath: normalized });
    await sSet(client(), 'explorer-base-path', normalized);
  },

  saveProjectTimeTypes: async (types) => {
    const seen = new Set<string>();
    const normalized = types.map((type) => ({ id: type.id || uid(), name: type.name.trim() }))
      .filter((type) => type.name && !seen.has(type.name.toLocaleLowerCase('de')) && seen.add(type.name.toLocaleLowerCase('de')));
    const next = normalized.length ? normalized : DEFAULT_PROJECT_TIME_TYPES;
    set({ projectTimeTypes: next });
    await sSet(client(), 'project-time-types', next);
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
    const [contacts, comms, doc, rawTasks, timeline, updates, aiSummary, moduleConfigs, notes, noteFolders] = await Promise.all([
      sGet<Contact[]>(sb, 'contacts:' + id),
      sGet<Comm[]>(sb, 'comms:' + id),
      sGet<DocData>(sb, 'doc:' + id),
      sGet<Task[]>(sb, 'tasks:' + id),
      sGet<Milestone[]>(sb, 'timeline:' + id),
      sGet<UpdateEntry[]>(sb, 'updates:' + id),
      sGet<ProjectCache['aiSummary']>(sb, 'ai-summary:' + id),
      sGet<ProjectModuleConfig[]>(sb, 'module-configs:' + id),
      sGet<ProjectNote[]>(sb, 'notes:' + id),
      sGet<ProjectNoteFolder[]>(sb, 'note-folders:' + id),
    ]);
    const siblingIds = customerProjectIds(get().projects || [], id).filter((projectId) => projectId !== id);
    const siblingContacts = await Promise.all(siblingIds.map((projectId) => sGet<Contact[]>(sb, 'contacts:' + projectId)));
    const mergedContacts = new Map<string, Contact>();
    [...(contacts || []), ...siblingContacts.flatMap((items) => items || [])].forEach((contact) => mergedContacts.set(contact.id, contact));
    const customerContacts = Array.from(mergedContacts.values()).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    if (customerContacts.length !== (contacts || []).length) await sSet(sb, 'contacts:' + id, customerContacts);
    let tasks = rawTasks || [];
    let migrated = false;
    tasks = tasks.map((t) => {
      const fixed = migratePrio(t.prioritaet);
      const contentMigration = migrateTaskContent(t);
      const dokuZiel = t.dokuZiel ?? (t.doku ? 'project' : '');
      const projectIds = linkedProjectIds(get().projects || [], id, t.projectIds);
      if (fixed !== t.prioritaet || contentMigration.changed || t.dokuZiel === undefined || !t.projectIds?.length) {
        migrated = true;
        return { ...contentMigration.task, prioritaet: fixed, dokuZiel, projectIds };
      }
      return { ...contentMigration.task, projectIds };
    });
    if (migrated) await sSet(sb, 'tasks:' + id, tasks);
    const normalizedComms = (comms || []).map((comm) => normalizeContactLinks(comm, linkedContactIds(comm)));
    if ((comms || []).some((comm, index) => comm.kontaktIds === undefined || comm.kontaktId !== normalizedComms[index].kontaktId)) {
      await sSet(sb, 'comms:' + id, normalizedComms);
    }
    const projectCache: ProjectCache = {
      contacts: customerContacts,
      comms: normalizedComms,
      doc: doc || {},
      tasks,
      timeline: timeline || [],
      updates: updates || [],
      aiSummary: aiSummary || null,
      moduleConfigs: moduleConfigs || [],
      notes: notes || [],
      noteFolders: noteFolders || [],
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
    const seenMilestones = new Set<string>();
    const allContacts: ContactWithMeta[] = [];
    const calendarTasks: CalendarTaskWithMeta[] = [];
    const seenTaskIds = new Set<string>();
    const seenContacts = new Set<string>();
    for (const p of projects) {
      const c = await get().ensureProjectData(p.id);
      c.tasks.forEach((t) => {
        if (seenTaskIds.has(t.id)) return;
        seenTaskIds.add(t.id);
        const withMeta: TaskWithMeta = { ...t, projectId: p.id, projectName: p.name };
        if (t.status !== 'erledigt') {
          if (t.faelligAm) calendarTasks.push({ ...withMeta, calendarDate: t.faelligAm, calendarKind: 'due', calendarEntryId: `${t.id}:due:${t.faelligAm}` });
          (t.termine || []).forEach((date, index) => calendarTasks.push({ ...withMeta, calendarDate: date, calendarKind: 'appointment', calendarEntryId: `${t.id}:appointment:${date}:${index}` }));
        }
        if (t.status === 'erledigt') completedTasks.push(withMeta);
        else if (t.status === 'wartet') waitingTasks.push(withMeta);
        else allTasks.push(withMeta);
      });
      c.contacts.forEach((ct) => {
        const contactKey = `${customerKey(p.kunde).key}:${ct.id}`;
        if (seenContacts.has(contactKey)) return;
        seenContacts.add(contactKey);
        allContacts.push({ id: ct.id, name: ct.name, projectId: p.id, projectName: p.name });
      });
      if (hasEchtlauf(p)) {
        c.timeline.forEach((m) => {
          if (m.status === 'erledigt' || seenMilestones.has(m.id)) return;
          seenMilestones.add(m.id);
          const linkedProjects = (m.projectIds?.length ? m.projectIds : [p.id]).map((id) => projects.find((project) => project.id === id)).filter((project): project is Project => !!project);
          allMilestones.push({ ...m, projectId: linkedProjects[0]?.id || p.id, projectName: linkedProjects.map((project) => project.name).join(', ') || p.name });
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
        calendarTasks,
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
    const previous = (get().projects || []).find((project) => project.id === id);
    const projects = (get().projects || []).map((p) => (p.id === id ? { ...p, ...patch } : p));
    const cache = { ...get().cache };
    if (patch.kunde !== undefined && patch.kunde !== previous?.kunde) delete cache[id];
    set({ projects, cache });
    await sSet(client(), 'projects', projects);
  },

  deleteProject: async (id) => {
    const allProjects = get().projects || [];
    const projects = allProjects.filter((p) => p.id !== id);
    const timeEntries = get().timeEntries.filter((entry) => entry.projectId !== id);
    const activeTimer = get().activeTimer?.projectId === id ? null : get().activeTimer;
    // Abrechnungen bleiben als Historie erhalten, verlieren aber die Projektverknüpfung.
    const abrechnungen = get().abrechnungen.map((item) => (item.projectId === id ? { ...item, projectId: undefined } : item));
    const cache = { ...get().cache };
    for (const project of projects) {
      const data = await get().ensureProjectData(project.id);
      const tasks = data.tasks.flatMap((task) => {
        const currentLinks = linkedProjectIds(allProjects, project.id, task.projectIds);
        if (!currentLinks.includes(id)) return [task];
        const remainingLinks = currentLinks.filter((linkedId) => linkedId !== id && projects.some((item) => item.id === linkedId));
        return remainingLinks.length ? [{ ...task, projectIds: remainingLinks }] : [];
      });
      cache[project.id] = { ...data, tasks };
      await sSet(client(), 'tasks:' + project.id, tasks);
    }
    set({ projects, timeEntries, activeTimer, abrechnungen, cache });
    const sb = client();
    await Promise.all([sSet(sb, 'projects', projects), sSet(sb, 'time-entries', timeEntries), sSet(sb, 'abrechnungen', abrechnungen), activeTimer ? sSet(sb, 'active-timer', activeTimer) : sDelete(sb, 'active-timer')]);
    await Promise.all(
      ['contacts:', 'comms:', 'doc:', 'tasks:', 'timeline:', 'updates:', 'ai-summary:', 'module-configs:', 'notes:', 'note-folders:'].map((prefix) =>
        sDelete(sb, prefix + id),
      ),
    );
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
    const projects = get().projects || [];
    await Promise.all(projects.map((project) => get().ensureProjectData(project.id)));
    const origin = get().cache[projectId] || emptyProjectCache();
    const previous = origin.tasks.find((item) => item.id === task.id);
    const projectIds = linkedProjectIds(projects, projectId, task.projectIds);
    const taskWithContacts = normalizeContactLinks(task, linkedContactIds(task));
    const normalizedTask = previous && previous.faelligAm !== task.faelligAm
      ? { ...taskWithContacts, projectIds, tagesSortierung: 999 }
      : { ...taskWithContacts, projectIds };
    const cache = { ...get().cache };
    await Promise.all(projects.map(async (project) => {
      const data = cache[project.id] || emptyProjectCache();
      const exists = data.tasks.some((item) => item.id === task.id);
      const shouldExist = projectIds.includes(project.id);
      if (!exists && !shouldExist) return;
      const tasks = shouldExist
        ? (exists ? data.tasks.map((item) => item.id === task.id ? normalizedTask : item) : [...data.tasks, normalizedTask])
        : data.tasks.filter((item) => item.id !== task.id);
      cache[project.id] = { ...data, tasks };
      await sSet(client(), 'tasks:' + project.id, tasks);
    }));
    set({ cache });
    await get().loadDashboardData();
  },

  createTask: async (projectId, partial) => {
    const nr = await get().nextTaskNr();
    const projectIds = linkedProjectIds(get().projects || [], projectId, partial.projectIds);
    const task: Task = normalizeContactLinks({
      ...partial,
      projectIds,
      id: uid(),
      nr,
      erstelltAm: new Date().toISOString(),
      abgeschlossenAm: null,
      tagesSortierung: 999,
    }, linkedContactIds(partial));
    for (const linkedId of projectIds) {
      const data = await get().ensureProjectData(linkedId);
      await persistTasks(get, set, linkedId, [...data.tasks.filter((item) => item.id !== task.id), task]);
    }
    await get().loadDashboardData();
    return task.id;
  },

  deleteTask: async (_projectId, taskId) => {
    if (get().activeTimer?.taskId === taskId) await get().stopTimer();
    for (const project of get().projects || []) {
      const data = await get().ensureProjectData(project.id);
      if (!data.tasks.some((task) => task.id === taskId)) continue;
      await persistTasks(get, set, project.id, data.tasks.filter((task) => task.id !== taskId));
    }
    if (get().abrechnungen.some((item) => item.taskId === taskId)) {
      // Abrechnungen bleiben als Historie erhalten, verlieren aber die Aufgabenverknüpfung.
      const abrechnungen = get().abrechnungen.map((item) => (item.taskId === taskId ? { ...item, taskId: undefined } : item));
      set({ abrechnungen });
      await sSet(client(), 'abrechnungen', abrechnungen);
    }
    await get().loadDashboardData();
  },

  setAllOverdueTasksToToday: async () => {
    const today = todayStr();
    for (const task of get().dashboardData?.overdueTasks || []) await get().saveTask(task.projectId, { ...taskWithoutMeta(task), faelligAm: today, tagesSortierung: 999 });
  },

  setAllNoDateTasksToToday: async () => {
    const today = todayStr();
    for (const task of get().dashboardData?.tasksNoDate || []) await get().saveTask(task.projectId, { ...taskWithoutMeta(task), faelligAm: today, tagesSortierung: 999 });
  },

  reorderDailyTasks: async (date, orderedTasks) => {
    const rankById = new Map(orderedTasks.filter((task) => task.faelligAm === date).map((task, index) => [task.id, index + 1]));
    const affected = (get().dashboardData?.tasksWithDate || []).filter((task) => task.faelligAm === date);
    for (const task of affected) await get().saveTask(task.projectId, { ...taskWithoutMeta(task), tagesSortierung: rankById.get(task.id) ?? 999 });
  },

  moveTaskToDailyDate: async (projectId, taskId, date) => {
    const data = await get().ensureProjectData(projectId);
    const task = data.tasks.find((item) => item.id === taskId);
    if (task) await get().saveTask(projectId, { ...task, faelligAm: date, tagesSortierung: 999 });
  },

  saveContact: async (projectId, contact) => {
    const cache = { ...get().cache };
    for (const linkedId of customerProjectIds(get().projects || [], projectId)) {
      const data = await get().ensureProjectData(linkedId);
      const contacts = data.contacts.some((item) => item.id === contact.id)
        ? data.contacts.map((item) => item.id === contact.id ? contact : item)
        : [...data.contacts, contact];
      contacts.sort((a, b) => a.name.localeCompare(b.name, 'de'));
      cache[linkedId] = { ...data, contacts };
      await sSet(client(), 'contacts:' + linkedId, contacts);
    }
    set({ cache });
    await get().loadDashboardData();
  },

  deleteContact: async (projectId, contactId) => {
    const cache = { ...get().cache };
    for (const linkedId of customerProjectIds(get().projects || [], projectId)) {
      const data = await get().ensureProjectData(linkedId);
      const contacts = data.contacts.filter((contact) => contact.id !== contactId);
      cache[linkedId] = { ...data, contacts };
      await sSet(client(), 'contacts:' + linkedId, contacts);
    }
    set({ cache });
    await get().loadDashboardData();
  },

  saveComm: async (projectId, comm) => {
    const data = await get().ensureProjectData(projectId);
    const normalizedComm = normalizeContactLinks(comm, linkedContactIds(comm));
    const idx = data.comms.findIndex((c) => c.id === comm.id);
    const comms = idx >= 0 ? data.comms.map((c, i) => (i === idx ? normalizedComm : c)) : [...data.comms, normalizedComm];
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
    if (get().abrechnungen.some((item) => item.commId === commId)) {
      // Abrechnungen bleiben als Historie erhalten, verlieren aber die Kommunikationsverknüpfung.
      const abrechnungen = get().abrechnungen.map((item) => (item.commId === commId ? { ...item, commId: undefined } : item));
      set({ abrechnungen });
      await sSet(client(), 'abrechnungen', abrechnungen);
    }
  },

  saveMilestone: async (projectId, m) => {
    const projects = get().projects || [];
    const origin = projects.find((project) => project.id === projectId);
    const allowedIds = new Set(projects.filter((project) => project.kunde === origin?.kunde && (project.id === projectId || hasEchtlauf(project))).map((project) => project.id));
    const projectIds = Array.from(new Set([projectId, ...(m.projectIds || [])])).filter((id) => allowedIds.has(id));
    const originData = await get().ensureProjectData(projectId);
    const previous = originData.timeline.find((item) => item.id === m.id);
    const previousIds = previous?.projectIds?.length ? previous.projectIds : previous ? [projectId] : [];
    const sharedMilestone = { ...m, projectIds };
    for (const linkedId of new Set([...previousIds, ...projectIds])) {
      const data = await get().ensureProjectData(linkedId);
      const exists = data.timeline.some((item) => item.id === m.id);
      const timeline = projectIds.includes(linkedId)
        ? exists ? data.timeline.map((item) => item.id === m.id ? sharedMilestone : item) : [...data.timeline, sharedMilestone]
        : data.timeline.filter((item) => item.id !== m.id);
      set({ cache: { ...get().cache, [linkedId]: { ...data, timeline } } });
      await sSet(client(), 'timeline:' + linkedId, timeline);
    }
    await get().loadDashboardData();
  },

  deleteMilestone: async (projectId, id) => {
    const data = await get().ensureProjectData(projectId);
    const milestone = data.timeline.find((item) => item.id === id);
    const projectIds = milestone?.projectIds?.length ? milestone.projectIds : [projectId];
    for (const linkedId of projectIds) {
      const linkedData = await get().ensureProjectData(linkedId);
      const timeline = linkedData.timeline.filter((item) => item.id !== id);
      set({ cache: { ...get().cache, [linkedId]: { ...linkedData, timeline } } });
      await sSet(client(), 'timeline:' + linkedId, timeline);
    }
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

  saveAbrechnung: async (entry) => {
    const current = get().abrechnungen;
    const abrechnungen = current.some((item) => item.id === entry.id)
      ? current.map((item) => item.id === entry.id ? entry : item)
      : [...current, entry];
    set({ abrechnungen });
    await sSet(client(), 'abrechnungen', abrechnungen);
  },

  importAbrechnungen: async (entries) => {
    const current = get().abrechnungen;
    const byId = new Map(current.map((item) => [item.id, item]));
    let added = 0;
    let updated = 0;
    entries.forEach((entry) => {
      if (byId.has(entry.id)) updated++; else added++;
      byId.set(entry.id, entry);
    });
    const abrechnungen = Array.from(byId.values());
    set({ abrechnungen });
    await sSet(client(), 'abrechnungen', abrechnungen);
    return { added, updated };
  },

  deleteAbrechnung: async (id) => {
    const abrechnungen = get().abrechnungen.filter((item) => item.id !== id);
    set({ abrechnungen });
    await sSet(client(), 'abrechnungen', abrechnungen);
  },

  matchAbrechnungenToProjects: async () => {
    const projects = get().projects || [];
    const projectsByKunde = new Map<string, Project[]>();
    projects.forEach((project) => {
      const key = project.kunde.trim().toLocaleLowerCase('de');
      if (!key) return;
      projectsByKunde.set(key, [...(projectsByKunde.get(key) || []), project]);
    });
    let updated = 0;
    const abrechnungen = get().abrechnungen.map((item) => {
      if (item.projectId || !item.kunde.trim()) return item;
      const matches = projectsByKunde.get(item.kunde.trim().toLocaleLowerCase('de'));
      if (!matches || matches.length !== 1) return item;
      updated++;
      return { ...item, projectId: matches[0].id };
    });
    if (updated) {
      set({ abrechnungen });
      await sSet(client(), 'abrechnungen', abrechnungen);
    }
    const unmatched = abrechnungen.filter((item) => !item.projectId && item.kunde.trim());
    return { updated, unmatched };
  },

  saveAbrechnungsArten: async (arten) => {
    const normalized = Array.from(new Set(arten.map((art) => art.trim()).filter(Boolean)));
    const next = normalized.length ? normalized : DEFAULT_ABRECHNUNGS_ARTEN;
    set({ abrechnungsArten: next });
    await sSet(client(), 'abrechnungs-arten', next);
  },

  saveAbrechnungsFaktoren: async (faktoren) => {
    set({ abrechnungsFaktoren: faktoren });
    await sSet(client(), 'abrechnungs-faktoren', faktoren);
  },

  saveStundensaetze: async (values) => {
    const next = Array.from(new Set(values.filter((value) => value > 0))).sort((a, b) => a - b);
    set({ stundensaetze: next });
    await sSet(client(), 'stundensaetze', next);
  },

  saveAbrechnungLinkedDefaultArt: async (art) => {
    set({ abrechnungLinkedDefaultArt: art });
    await sSet(client(), 'abrechnung-linked-default-art', art);
  },

  saveAbrechnungsModule: async (modules) => {
    const next = Array.from(new Set(modules.map((item) => item.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'de'));
    set({ abrechnungsModule: next });
    await sSet(client(), 'abrechnungs-module', next);
  },

  saveAbrechnungFilterPresets: async (presets) => {
    const next = normalizeAbrechnungFilterPresets(presets);
    set({ abrechnungFilterPresets: next });
    await sSet(client(), 'abrechnung-filter-presets', next);
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

  saveProjectNote: async (projectId, note) => {
    const data = await get().ensureProjectData(projectId);
    const notes = data.notes.some((item) => item.id === note.id)
      ? data.notes.map((item) => item.id === note.id ? note : item)
      : [...data.notes, note];
    const cache = { ...get().cache, [projectId]: { ...data, notes } };
    set({ cache });
    await sSet(client(), 'notes:' + projectId, notes);
  },

  deleteProjectNote: async (projectId, noteId) => {
    const data = await get().ensureProjectData(projectId);
    const notes = data.notes.filter((item) => item.id !== noteId);
    const cache = { ...get().cache, [projectId]: { ...data, notes } };
    set({ cache });
    await sSet(client(), 'notes:' + projectId, notes);
  },

  saveProjectNoteFolders: async (projectId, noteFolders) => {
    const data = await get().ensureProjectData(projectId);
    const cache = { ...get().cache, [projectId]: { ...data, noteFolders } };
    set({ cache });
    await sSet(client(), 'note-folders:' + projectId, noteFolders);
  },

  startTimer: async (projectId, taskId = null, timeTypeId) => {
    const current = get().activeTimer;
    const selectedType = taskId ? undefined : get().projectTimeTypes.find((type) => type.id === timeTypeId) || get().projectTimeTypes[0];
    if (current) {
      if (current.projectId === projectId && current.taskId === taskId && (taskId || current.timeTypeId === selectedType?.id)) return;
      await get().stopTimer();
    }
    const activeTimer: ActiveTimer = { projectId, taskId, startedAt: new Date().toISOString(), ...(selectedType ? { timeTypeId: selectedType.id, timeTypeName: selectedType.name } : {}) };
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
        ['contacts:', 'comms:', 'doc:', 'tasks:', 'timeline:', 'ai-summary:', 'updates:', 'module-configs:', 'notes:', 'note-folders:'].map((prefix) =>
          sDelete(sb, prefix + p.id),
        ),
      );
    }
    for (const p of projects) {
      const d = perProject[p.id] || { contacts: [], comms: [], doc: {}, tasks: [], timeline: [], updates: [], notes: [], noteFolders: [] };
      await sSet(sb, 'contacts:' + p.id, d.contacts);
      await sSet(sb, 'comms:' + p.id, d.comms);
      await sSet(sb, 'doc:' + p.id, d.doc);
      await sSet(sb, 'tasks:' + p.id, d.tasks);
      await sSet(sb, 'timeline:' + p.id, d.timeline);
      await sSet(sb, 'updates:' + p.id, d.updates);
      await sSet(sb, 'notes:' + p.id, d.notes);
      await sSet(sb, 'note-folders:' + p.id, d.noteFolders);
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

interface LegacyTaskBilledEntry { id: string; minutes: number; datum: string }
interface LegacyTaskFields { billedZeiten?: LegacyTaskBilledEntry[]; billedMinutes?: number; billedDate?: string }
interface LegacyCommFields { billedMinutes?: number }
interface LegacyFreeBilledEntry { id: string; datum: string; minutes: number; teilprojekt?: string; hinweis?: string }

/**
 * Einmalige Migration: wandelt die frühere, einfache Abrechnungs-Zeiterfassung (Task.billedZeiten,
 * Comm.billedMinutes, freie projektbezogene Zeiterfassung) in Datensätze des neuen, globalen
 * Abrechnungs-/Provisionsmoduls um und entfernt anschließend die alten Felder/Keys. Läuft dank
 * eines persistierten Flags nur einmal.
 */
async function migrateLegacyBilledTimeToAbrechnungen(get: () => DataStoreState, set: (p: Partial<DataStoreState>) => void) {
  const sb = client();
  if (await sGet<boolean>(sb, 'abrechnungen-migrated')) return;
  const projects = get().projects || [];
  const now = new Date().toISOString();
  const newAbrechnungen: Abrechnung[] = [];
  const processedTaskIds = new Set<string>();
  const cache = { ...get().cache };

  for (const project of projects) {
    const data = cache[project.id];
    if (!data) continue;

    let tasksChanged = false;
    const tasks = data.tasks.map((task) => {
      const legacy = task as unknown as LegacyTaskFields;
      const hasLegacyFields = legacy.billedZeiten !== undefined || legacy.billedMinutes !== undefined || legacy.billedDate !== undefined;
      if (!hasLegacyFields) return task;
      tasksChanged = true;
      if (!processedTaskIds.has(task.id)) {
        processedTaskIds.add(task.id);
        (legacy.billedZeiten || []).forEach((entry) => {
          if (!(entry.minutes > 0)) return;
          newAbrechnungen.push({
            id: uid(),
            projectId: project.id,
            kunde: project.kunde,
            datum: entry.datum || todayStr(),
            art: 'BO',
            minutes: entry.minutes,
            wertCents: 0,
            provisionCents: 0,
            freigegeben: false,
            bemerkung: `Migriert von Aufgabe${task.nr ? ' #' + task.nr : ''}${task.titel ? ' · ' + task.titel : ''}`,
            createdAt: now,
          });
        });
      }
      const rest = { ...task } as Record<string, unknown>;
      delete rest.billedZeiten;
      delete rest.billedMinutes;
      delete rest.billedDate;
      return rest as unknown as Task;
    });
    if (tasksChanged) {
      cache[project.id] = { ...data, tasks };
      await sSet(sb, 'tasks:' + project.id, tasks);
    }

    let commsChanged = false;
    const comms = (cache[project.id] || data).comms.map((comm) => {
      const legacy = comm as unknown as LegacyCommFields;
      if (legacy.billedMinutes === undefined) return comm;
      commsChanged = true;
      if (legacy.billedMinutes > 0) {
        newAbrechnungen.push({
          id: uid(),
          projectId: project.id,
          kunde: project.kunde,
          datum: comm.datum || todayStr(),
          art: 'BO',
          minutes: legacy.billedMinutes,
          wertCents: 0,
          provisionCents: 0,
          freigegeben: false,
          teilprojekt: comm.teilprojekt,
          bemerkung: `Migriert von Kommunikation · ${comm.betreff || comm.kanal}`,
          createdAt: now,
        });
      }
      const rest = { ...comm } as Record<string, unknown>;
      delete rest.billedMinutes;
      return rest as unknown as Comm;
    });
    if (commsChanged) {
      cache[project.id] = { ...(cache[project.id] || data), comms };
      await sSet(sb, 'comms:' + project.id, comms);
    }

    const legacyFree = await sGet<LegacyFreeBilledEntry[]>(sb, 'billed-time-entries:' + project.id);
    if (legacyFree) {
      legacyFree.forEach((entry) => {
        if (!(entry.minutes > 0)) return;
        newAbrechnungen.push({
          id: uid(),
          projectId: project.id,
          kunde: project.kunde,
          datum: entry.datum || todayStr(),
          art: 'BO',
          minutes: entry.minutes,
          wertCents: 0,
          provisionCents: 0,
          freigegeben: false,
          teilprojekt: entry.teilprojekt,
          bemerkung: entry.hinweis ? `Migriert · ${entry.hinweis}` : 'Migriert von freier Zeiterfassung',
          createdAt: now,
        });
      });
      await sDelete(sb, 'billed-time-entries:' + project.id);
    }
  }

  if (newAbrechnungen.length) {
    const abrechnungen = [...get().abrechnungen, ...newAbrechnungen];
    set({ abrechnungen, cache });
    await sSet(sb, 'abrechnungen', abrechnungen);
  } else {
    set({ cache });
  }
  await sSet(sb, 'abrechnungen-migrated', true);
}

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
