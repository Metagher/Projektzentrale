import { create } from 'zustand';
import {
  claimInboxItem, deleteInboxItems, INBOX_TABLE, listInboxItems, markInboxError, markInboxResult,
  purgeStaleProcessedItems, retryInboxItem, type InboxItem, type InboxResult, type InboxResultTask,
} from '../lib/supabase';
import {
  parseInboxPayload, peekInboxTyp, validateAenderungAufgabe, validateAenderungBase,
  validateAenderungKommunikation, validateAenderungKontakt, validateAufgabe, validateKommunikation,
  validateKontakt, validateNotiz,
  type InboxAenderungPayload, type InboxAufgabePayload, type InboxKommunikationPayload,
  type InboxKontaktPayload, type InboxNotizPayload,
} from '../lib/inboxFormat';
import { resolveContacts, resolveProject, resolveSubprojectName, type ContactMatch } from '../lib/inboxResolve';
import { useConnectionStore } from './connectionStore';
import { useDataStore } from './dataStore';
import { useQuickNoteStore } from './quickNoteStore';
import { useUiStore } from './uiStore';
import { useToastStore } from './toastStore';
import { getProjectUiStore } from './projectUiStore';
import { openTaskInDashboard } from '../lib/navigation';
import { fmtDate, fmtDateTime, todayStr, uid } from '../lib/format';
import { normalizeAfn } from '../lib/afn';
import { inboxTextToHtml, plainTextToHtml } from '../lib/richText';
import type { Comm, Contact, Project, Task, TaskHistoryEntry } from '../types/entities';

function client() {
  const c = useConnectionStore.getState().client;
  if (!c) throw new Error('Nicht mit Supabase verbunden.');
  return c;
}

const POLL_MS = 30000;

interface InboxStoreState {
  /** Fehlerhafte UND erfolgreich verarbeitete-mit-Warnung Zeilen — beides braucht die
   * Inbox-Ansicht und der Zähler in der Navigation. Sauber verarbeitete Zeilen (ohne Warnung)
   * werden kurz nach der Verarbeitung automatisch aufgeräumt, siehe purgeStaleProcessedItems. */
  errorItems: InboxItem[];
  processing: boolean;
  started: boolean;

  ensureStarted: () => void;
  refresh: () => Promise<void>;
  retry: (id: string) => Promise<void>;
  retryWithContent: (id: string, content: string) => Promise<void>;
  discard: (id: string) => Promise<void>;
}

export const useInboxStore = create<InboxStoreState>((set, get) => ({
  errorItems: [],
  processing: false,
  started: false,

  ensureStarted: () => {
    if (get().started) return;
    set({ started: true });
    void get().refresh();
    window.setInterval(() => void get().refresh(), POLL_MS);
    try {
      const sb = client();
      const userId = useConnectionStore.getState().session?.user.id;
      if (userId) {
        sb.channel('projektzentrale-inbox')
          .on('postgres_changes', { event: '*', schema: 'public', table: INBOX_TABLE, filter: `user_id=eq.${userId}` }, () => void get().refresh())
          .subscribe();
      }
    } catch {
      // Kein Login/keine Verbindung — Polling übernimmt, sobald ensureStarted erneut aufgerufen
      // wird bzw. beim nächsten Intervall greift die Verbindung dann ohnehin.
    }
  },

  refresh: async () => {
    if (get().processing) return; // keine zwei Durchläufe gleichzeitig (auch nicht aus Realtime + Polling zusammen)
    // Projekte sind noch nicht geladen (Race mit dataStore.loadAll() direkt nach dem Login) — ohne
    // diese Bremse würde jede Projekt-Auflösung fälschlich "nicht gefunden" melden. Einfach beim
    // nächsten Polling-Intervall bzw. Realtime-Event erneut versuchen, keine Fehlzeile erzeugen.
    if (useDataStore.getState().projects === null) return;
    set({ processing: true });
    try {
      const sb = client();
      const items = await listInboxItems(sb);
      // Bewusst nacheinander statt parallel: mehrere Zeilen für dasselbe Projekt dürfen sich beim
      // Schreiben auf denselben Speicher-Key (z.B. tasks:<projektId>) nicht überholen.
      for (const item of items) {
        if (item.status === 'fehler' || item.status === 'warnung') continue; // nur über "Erneut versuchen"/manuell
        const claimed = await claimInboxItem(sb, item.id);
        if (!claimed) continue; // von einem anderen Tab schon beansprucht, oder Claim noch frisch
        await processItem(item);
      }
      await purgeStaleProcessedItems(sb);
    } finally {
      const items = await listInboxItems(client());
      set({ errorItems: items.filter((item) => item.status === 'fehler' || item.status === 'warnung'), processing: false });
    }
  },

  retry: async (id) => {
    await retryInboxItem(client(), id);
    await get().refresh();
  },

  retryWithContent: async (id, content) => {
    await retryInboxItem(client(), id, content);
    await get().refresh();
  },

  discard: async (id) => {
    await deleteInboxItems(client(), [id]);
    set((state) => ({ errorItems: state.errorItems.filter((item) => item.id !== id) }));
  },
}));

async function processItem(item: InboxItem): Promise<void> {
  const payload = parseInboxPayload(item.content);
  if (!payload) {
    // Kein erkennbares JSON-Format → wie bisher als reine Textnotiz behandeln, nichts geht verloren.
    await useQuickNoteStore.getState().addWithContent(plainTextToHtml(item.content));
    await deleteInboxItems(client(), [item.id]);
    return;
  }

  const projects = useDataStore.getState().projects || [];
  const result =
    payload.typ === 'aufgabe' ? await processAufgabe(payload, projects)
    : payload.typ === 'kommunikation' ? await processKommunikation(payload, projects)
    : payload.typ === 'notiz' ? await processNotiz(payload, projects)
    : payload.typ === 'kontakt' ? await processKontakt(payload, projects)
    : await processAenderung(payload, projects);

  if (!result.ok) {
    await markInboxError(client(), item.id, result.error);
    return;
  }

  useToastStore.getState().push({ message: result.message, actionLabel: 'Öffnen', onAction: result.onOpen });

  const inboxResult: InboxResult = {
    entityTyp: result.entityTyp,
    entityId: result.entityId,
    projectId: result.projectId,
    kontakte: result.contacts,
    angelegteAufgaben: result.angelegteAufgaben,
  };
  if (result.warnings.length > 0) {
    await markInboxResult(client(), item.id, 'warnung', result.warnings.join(' '), inboxResult);
  } else {
    await markInboxResult(client(), item.id, 'verarbeitet', null, inboxResult);
  }
}

type ProcessResult =
  | {
      ok: true;
      entityTyp: InboxResult['entityTyp'];
      entityId: string;
      projectId: string;
      contacts: ContactMatch[];
      warnings: string[];
      message: string;
      onOpen: () => void;
      /** Nur bei kommunikation mit "aufgaben": die dabei neu angelegten Aufgaben mit ihrer id. */
      angelegteAufgaben?: InboxResultTask[];
    }
  | { ok: false; error: string };

function changedByClaudeMarker(): string {
  return `<p><em>Geändert durch Claude am ${fmtDateTime(new Date().toISOString())}.</em></p>`;
}

async function processAufgabe(payload: InboxAufgabePayload, projects: Project[]): Promise<ProcessResult> {
  const validated = validateAufgabe(payload);
  if (!validated.ok) return { ok: false, error: validated.error };
  const v = validated.value;
  const resolved = resolveProject(projects, v.projekt);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const project = resolved.value;

  const { createTask } = useDataStore.getState();
  const data = await useDataStore.getState().ensureProjectData(project.id);
  const { matched, warnings } = resolveContacts(data.contacts, v.kontaktNamen);
  const kontaktIds = matched.map((m) => m.id);
  const now = new Date().toISOString();

  const taskId = await createTask(project.id, {
    titel: v.titel,
    faelligAm: v.faelligAm,
    status: v.status,
    wartetAuf: v.status === 'wartet' ? v.wartetAuf : '',
    wartetSeit: v.status === 'wartet' ? now.slice(0, 10) : '',
    kontaktId: kontaktIds[0] || '',
    kontaktIds,
    verlauf: v.beschreibung.trim()
      ? [{ id: uid(), datum: now.slice(0, 10), titel: 'Beschreibung', content: inboxTextToHtml(v.beschreibung), createdAt: now, updatedAt: now }]
      : [],
    afns: v.afns.map(normalizeAfn),
    commIds: [],
    farbe: v.farbe,
    kategorie: v.kategorie,
    doku: v.doku,
    dokuErledigt: false,
    dokuZiel: v.doku ? 'project' : '',
  });

  return {
    ok: true,
    entityTyp: 'aufgabe',
    entityId: taskId,
    projectId: project.id,
    contacts: matched,
    warnings,
    message: `Aufgabe „${v.titel}“ in ${project.name} angelegt.`,
    onOpen: () => openTaskInDashboard(taskId),
  };
}

async function processKommunikation(payload: InboxKommunikationPayload, projects: Project[]): Promise<ProcessResult> {
  const validated = validateKommunikation(payload);
  if (!validated.ok) return { ok: false, error: validated.error };
  const v = validated.value;
  const resolved = resolveProject(projects, v.projekt);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const project = resolved.value;

  const { createTask, saveComm } = useDataStore.getState();
  const data = await useDataStore.getState().ensureProjectData(project.id);
  const { matched, warnings } = resolveContacts(data.contacts, v.kontaktNamen);
  const kontaktIds = matched.map((m) => m.id);
  const datum = v.datum || new Date().toISOString().slice(0, 10);
  const teilprojekt = v.teilprojekt ? resolveSubprojectName(data.subprojects, v.teilprojekt) : '';

  const commId = uid();
  const newTaskIds: string[] = [];
  const angelegteAufgaben: InboxResultTask[] = [];
  for (const titel of v.aufgaben) {
    const taskId = await createTask(project.id, {
      titel,
      faelligAm: '',
      status: 'offen',
      wartetAuf: '',
      kontaktId: '',
      verlauf: [],
      afns: [],
      commIds: [commId],
      doku: false,
      dokuErledigt: false,
      dokuZiel: '',
    });
    newTaskIds.push(taskId);
    angelegteAufgaben.push({ id: taskId, titel });
  }

  await saveComm(project.id, {
    id: commId,
    nr: 0,
    datum,
    kanal: v.kanal,
    kontaktId: kontaktIds[0] || '',
    kontaktIds,
    betreff: v.betreff || `${v.kanal} ${fmtDate(datum)}`,
    notiz: inboxTextToHtml(v.inhalt),
    afns: [],
    taskIds: newTaskIds,
    teilprojekt,
  });

  return {
    ok: true,
    entityTyp: 'kommunikation',
    entityId: commId,
    projectId: project.id,
    contacts: matched,
    warnings,
    message: `Kommunikationseintrag in ${project.name} angelegt.`,
    onOpen: () => openCommInProject(project.id, commId),
    angelegteAufgaben: angelegteAufgaben.length > 0 ? angelegteAufgaben : undefined,
  };
}

async function processNotiz(payload: InboxNotizPayload, projects: Project[]): Promise<ProcessResult> {
  const validated = validateNotiz(payload);
  if (!validated.ok) return { ok: false, error: validated.error };
  const v = validated.value;

  if (!v.projekt) {
    const noteId = await useQuickNoteStore.getState().addWithContent(inboxTextToHtml(v.inhalt));
    return {
      ok: true,
      entityTyp: 'notiz',
      entityId: noteId,
      projectId: '',
      contacts: [],
      warnings: [],
      message: 'Schnellnotiz angelegt.',
      onOpen: () => {
        useUiStore.setState({ view: 'quick-notes' });
        useQuickNoteStore.getState().select(noteId);
      },
    };
  }

  const resolved = resolveProject(projects, v.projekt);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const project = resolved.value;
  const now = new Date().toISOString();
  const noteId = uid();
  await useDataStore.getState().saveProjectNote(project.id, {
    id: noteId,
    titel: v.titel || `Notiz vom ${fmtDate(todayStr())}`,
    inhalt: inboxTextToHtml(v.inhalt),
    folderId: null,
    sortIndex: 999,
    global: false,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  });

  return {
    ok: true,
    entityTyp: 'notiz',
    entityId: noteId,
    projectId: project.id,
    contacts: [],
    warnings: [],
    message: `Notiz in ${project.name} angelegt.`,
    onOpen: () => useUiStore.setState({ view: 'project', selectedId: project.id, activeTab: 'notizen', sidebarOpen: false }),
  };
}

async function processKontakt(payload: InboxKontaktPayload, projects: Project[]): Promise<ProcessResult> {
  const validated = validateKontakt(payload);
  if (!validated.ok) return { ok: false, error: validated.error };
  const v = validated.value;
  const resolved = resolveProject(projects, v.projekt);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const project = resolved.value;

  const { saveContact } = useDataStore.getState();
  const data = await useDataStore.getState().ensureProjectData(project.id);
  const lower = v.name.toLocaleLowerCase('de');
  const existing = data.contacts.find((c) => c.name.trim().toLocaleLowerCase('de') === lower);

  if (existing) {
    return {
      ok: true,
      entityTyp: 'kontakt',
      entityId: existing.id,
      projectId: project.id,
      contacts: [],
      warnings: [],
      message: `Ansprechpartner „${v.name}“ existierte in ${project.name} bereits.`,
      onOpen: () => openContactInProject(project.id),
    };
  }

  const contact: Contact = { id: uid(), name: v.name, rolle: v.rolle, telefon: v.telefon, email: v.email, notiz: '' };
  await saveContact(project.id, contact);

  return {
    ok: true,
    entityTyp: 'kontakt',
    entityId: contact.id,
    projectId: project.id,
    contacts: [],
    warnings: [],
    message: `Ansprechpartner „${v.name}“ in ${project.name} angelegt.`,
    onOpen: () => openContactInProject(project.id),
  };
}

async function processAenderung(payload: InboxAenderungPayload, projects: Project[]): Promise<ProcessResult> {
  const base = validateAenderungBase(payload);
  if (!base.ok) return { ok: false, error: base.error };
  const { ziel, projekt, id } = base.value;
  const resolved = resolveProject(projects, projekt);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const project = resolved.value;
  const raw = payload.aenderungen || {};

  if (ziel === 'aufgabe') return applyAenderungAufgabe(project, id, raw);
  if (ziel === 'kommunikation') return applyAenderungKommunikation(project, id, raw);
  return applyAenderungKontakt(project, id, raw);
}

async function applyAenderungAufgabe(project: Project, id: string, raw: Record<string, unknown>): Promise<ProcessResult> {
  const validated = validateAenderungAufgabe(raw);
  if (!validated.ok) return { ok: false, error: validated.error };
  const fields = validated.value;
  const data = await useDataStore.getState().ensureProjectData(project.id);
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return { ok: false, error: `Aufgabe mit id "${id}" in Projekt "${project.name}" nicht gefunden.` };

  const now = new Date().toISOString();
  const updated: Task = { ...task };
  let contacts: ContactMatch[] = [];
  let warnings: string[] = [];

  if (fields.titel !== undefined) updated.titel = fields.titel;
  if (fields.status !== undefined) updated.status = fields.status;
  if (fields.status === 'wartet') updated.wartetSeit = now.slice(0, 10);
  if (fields.prioritaet !== undefined) updated.prioritaet = fields.prioritaet;
  if (fields.faelligAm !== undefined) updated.faelligAm = fields.faelligAm;
  if (fields.kategorie !== undefined) updated.kategorie = fields.kategorie;
  if (fields.farbe !== undefined) updated.farbe = fields.farbe;
  if (fields.wartetAuf !== undefined) updated.wartetAuf = fields.wartetAuf;
  if (fields.afns !== undefined) updated.afns = fields.afns.map(normalizeAfn);
  if (fields.doku !== undefined) updated.doku = fields.doku;

  if (fields.kontaktNamen !== undefined) {
    const r = resolveContacts(data.contacts, fields.kontaktNamen);
    updated.kontaktIds = r.matched.map((m) => m.id);
    updated.kontaktId = updated.kontaktIds[0] || '';
    contacts = r.matched;
    warnings = warnings.concat(r.warnings);
  }
  if (fields.kontaktNamenHinzufuegen !== undefined) {
    const r = resolveContacts(data.contacts, fields.kontaktNamenHinzufuegen);
    const existingIds = new Set(updated.kontaktIds || []);
    const added = r.matched.filter((m) => !existingIds.has(m.id));
    updated.kontaktIds = [...(updated.kontaktIds || []), ...added.map((m) => m.id)];
    if (!updated.kontaktId) updated.kontaktId = updated.kontaktIds[0] || '';
    contacts = [...contacts, ...added];
    warnings = warnings.concat(r.warnings);
  }

  // Verknüpfung zu Kommunikationseinträgen (additiv, symmetrisch zu kontaktNamenHinzufuegen) —
  // unbekannte ids brechen VOR jeder Änderung ab (nichts wird geändert), siehe Validierung unten.
  const oldCommIds = task.commIds || [];
  let newCommIds: string[] | undefined;
  if (fields.kommunikationIdsHinzufuegen !== undefined || fields.kommunikationIdsEntfernen !== undefined) {
    const toAdd = fields.kommunikationIdsHinzufuegen || [];
    const toRemove = fields.kommunikationIdsEntfernen || [];
    const unknown = [...toAdd, ...toRemove].filter((cid) => !data.comms.some((c) => c.id === cid));
    if (unknown.length > 0) {
      return { ok: false, error: `Kommunikationseintrag(e) mit id ${unknown.map((i) => `"${i}"`).join(', ')} in Projekt "${project.name}" nicht gefunden.` };
    }
    const removeSet = new Set(toRemove);
    newCommIds = Array.from(new Set([...oldCommIds.filter((cid) => !removeSet.has(cid)), ...toAdd]));
    updated.commIds = newCommIds;
  }

  const verlauf = [...(task.verlauf || [])];
  if (fields.beschreibung !== undefined && fields.beschreibung.trim()) {
    verlauf.push({ id: uid(), datum: now.slice(0, 10), titel: 'Beschreibung', content: inboxTextToHtml(fields.beschreibung), createdAt: now, updatedAt: now });
  }
  updated.verlauf = verlauf;

  const claudeHistoryEntry: TaskHistoryEntry = { id: uid(), timestamp: now, text: 'Geändert durch Claude' };
  updated.history = [claudeHistoryEntry, ...(task.history || [])];

  await useDataStore.getState().saveTask(project.id, updated);
  if (newCommIds !== undefined) {
    await useDataStore.getState().syncCommLinksForTask(project.id, task.id, oldCommIds, newCommIds);
  }

  return {
    ok: true,
    entityTyp: 'aufgabe',
    entityId: task.id,
    projectId: project.id,
    contacts,
    warnings,
    message: `Aufgabe „${updated.titel}“ in ${project.name} geändert.`,
    onOpen: () => openTaskInDashboard(task.id),
  };
}

async function applyAenderungKommunikation(project: Project, id: string, raw: Record<string, unknown>): Promise<ProcessResult> {
  const validated = validateAenderungKommunikation(raw);
  if (!validated.ok) return { ok: false, error: validated.error };
  const fields = validated.value;
  const data = await useDataStore.getState().ensureProjectData(project.id);
  const comm = data.comms.find((c) => c.id === id);
  if (!comm) return { ok: false, error: `Kommunikationseintrag mit id "${id}" in Projekt "${project.name}" nicht gefunden.` };

  const updated: Comm = { ...comm };
  let contacts: ContactMatch[] = [];
  let warnings: string[] = [];

  if (fields.betreff !== undefined) updated.betreff = fields.betreff;
  if (fields.kanal !== undefined) updated.kanal = fields.kanal;
  if (fields.datum !== undefined) updated.datum = fields.datum;
  if (fields.teilprojekt !== undefined) {
    const resolvedSp = resolveSubprojectName(data.subprojects, fields.teilprojekt);
    if (resolvedSp) updated.teilprojekt = resolvedSp;
    else warnings.push(`Teilprojekt "${fields.teilprojekt}" wurde nicht gefunden — unverändert gelassen.`);
  }
  if (fields.inhalt !== undefined) updated.notiz = inboxTextToHtml(fields.inhalt);
  if (fields.inhaltAnhaengen !== undefined) updated.notiz = (updated.notiz || '') + inboxTextToHtml(fields.inhaltAnhaengen);

  if (fields.kontaktNamen !== undefined) {
    const r = resolveContacts(data.contacts, fields.kontaktNamen);
    updated.kontaktIds = r.matched.map((m) => m.id);
    updated.kontaktId = updated.kontaktIds[0] || '';
    contacts = r.matched;
    warnings = warnings.concat(r.warnings);
  }
  if (fields.kontaktNamenHinzufuegen !== undefined) {
    const r = resolveContacts(data.contacts, fields.kontaktNamenHinzufuegen);
    const existingIds = new Set(updated.kontaktIds || []);
    const added = r.matched.filter((m) => !existingIds.has(m.id));
    updated.kontaktIds = [...(updated.kontaktIds || []), ...added.map((m) => m.id)];
    if (!updated.kontaktId) updated.kontaktId = updated.kontaktIds[0] || '';
    contacts = [...contacts, ...added];
    warnings = warnings.concat(r.warnings);
  }

  // Verknüpfung zu Aufgaben (additiv) — unbekannte ids brechen VOR jeder Änderung ab.
  const oldTaskIds = comm.taskIds || [];
  let newTaskIds: string[] | undefined;
  if (fields.aufgabenIdsHinzufuegen !== undefined || fields.aufgabenIdsEntfernen !== undefined) {
    const toAdd = fields.aufgabenIdsHinzufuegen || [];
    const toRemove = fields.aufgabenIdsEntfernen || [];
    const unknown = [...toAdd, ...toRemove].filter((tid) => !data.tasks.some((t) => t.id === tid));
    if (unknown.length > 0) {
      return { ok: false, error: `Aufgabe(n) mit id ${unknown.map((i) => `"${i}"`).join(', ')} in Projekt "${project.name}" nicht gefunden.` };
    }
    const removeSet = new Set(toRemove);
    newTaskIds = Array.from(new Set([...oldTaskIds.filter((tid) => !removeSet.has(tid)), ...toAdd]));
    updated.taskIds = newTaskIds;
  }

  updated.notiz = (updated.notiz || '') + changedByClaudeMarker();

  await useDataStore.getState().saveComm(project.id, updated);
  if (newTaskIds !== undefined) {
    await useDataStore.getState().syncTaskLinksForComm(project.id, comm.id, oldTaskIds, newTaskIds);
  }

  return {
    ok: true,
    entityTyp: 'kommunikation',
    entityId: comm.id,
    projectId: project.id,
    contacts,
    warnings,
    message: `Kommunikationseintrag in ${project.name} geändert.`,
    onOpen: () => openCommInProject(project.id, comm.id),
  };
}

async function applyAenderungKontakt(project: Project, id: string, raw: Record<string, unknown>): Promise<ProcessResult> {
  const validated = validateAenderungKontakt(raw);
  if (!validated.ok) return { ok: false, error: validated.error };
  const fields = validated.value;
  const data = await useDataStore.getState().ensureProjectData(project.id);
  const contact = data.contacts.find((c) => c.id === id);
  if (!contact) return { ok: false, error: `Kontakt mit id "${id}" in Projekt "${project.name}" nicht gefunden.` };

  const updated: Contact = { ...contact };
  if (fields.name !== undefined) updated.name = fields.name;
  if (fields.rolle !== undefined) updated.rolle = fields.rolle;
  if (fields.telefon !== undefined) updated.telefon = fields.telefon;
  if (fields.email !== undefined) updated.email = fields.email;
  updated.notiz = (updated.notiz || '') + changedByClaudeMarker();

  await useDataStore.getState().saveContact(project.id, updated);

  return {
    ok: true,
    entityTyp: 'kontakt',
    entityId: contact.id,
    projectId: project.id,
    contacts: [],
    warnings: [],
    message: `Ansprechpartner „${updated.name}“ in ${project.name} geändert.`,
    onOpen: () => openContactInProject(project.id),
  };
}

function openCommInProject(projectId: string, commId: string) {
  useUiStore.setState({ view: 'project', selectedId: projectId, activeTab: 'kommunikation', sidebarOpen: false });
  getProjectUiStore('primary').getState().jumpToComm(commId);
}

function openContactInProject(projectId: string) {
  useUiStore.setState({ view: 'project-management', selectedId: projectId, sidebarOpen: false });
}

/** Öffnet den Eintrag, auf den eine verarbeitete Inbox-Zeile verweist — für den "Öffnen"-Button
 * in der Fehler-/Warnungs-Ansicht, wo kein frischer onOpen-Closure mehr vorhanden ist (die Zeile
 * wurde ggf. in einer früheren Session bzw. einem früheren Tab verarbeitet). */
export function openInboxResult(result: InboxResult): void {
  if (result.entityTyp === 'aufgabe') { openTaskInDashboard(result.entityId); return; }
  if (result.entityTyp === 'kommunikation') { openCommInProject(result.projectId, result.entityId); return; }
  if (result.entityTyp === 'kontakt') { openContactInProject(result.projectId); return; }
  if (result.projectId) {
    useUiStore.setState({ view: 'project', selectedId: result.projectId, activeTab: 'notizen', sidebarOpen: false });
  } else {
    useUiStore.setState({ view: 'quick-notes' });
    useQuickNoteStore.getState().select(result.entityId);
  }
}

export { peekInboxTyp };
