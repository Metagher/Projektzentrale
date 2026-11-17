import { create } from 'zustand';
import {
  claimInboxItem, deleteInboxItems, INBOX_TABLE, listInboxItems, markInboxError, retryInboxItem,
  type InboxItem,
} from '../lib/supabase';
import {
  parseInboxPayload, peekInboxTyp, validateAufgabe, validateKommunikation, validateNotiz,
  type InboxAufgabePayload, type InboxKommunikationPayload, type InboxNotizPayload,
} from '../lib/inboxFormat';
import { resolveContactIds, resolveProject } from '../lib/inboxResolve';
import { useConnectionStore } from './connectionStore';
import { useDataStore } from './dataStore';
import { useQuickNoteStore } from './quickNoteStore';
import { useUiStore } from './uiStore';
import { useToastStore } from './toastStore';
import { getProjectUiStore } from './projectUiStore';
import { openTaskInDashboard } from '../lib/navigation';
import { fmtDate, todayStr, uid } from '../lib/format';
import { normalizeAfn } from '../lib/afn';
import { inboxTextToHtml, plainTextToHtml } from '../lib/richText';
import type { Project } from '../types/entities';

function client() {
  const c = useConnectionStore.getState().client;
  if (!c) throw new Error('Nicht mit Supabase verbunden.');
  return c;
}

const POLL_MS = 30000;

interface InboxStoreState {
  /** Nur die fehlerhaften Zeilen — allein die braucht die Inbox-Ansicht und der Zähler in der
   * Navigation anzuzeigen; erfolgreich verarbeitete Zeilen werden sofort gelöscht. */
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
        if (item.status === 'fehler') continue; // nur über "Erneut versuchen" erneut angehen
        const claimed = await claimInboxItem(sb, item.id);
        if (!claimed) continue; // von einem anderen Tab schon beansprucht, oder Claim noch frisch
        await processItem(item);
      }
    } finally {
      const items = await listInboxItems(client());
      set({ errorItems: items.filter((item) => item.status === 'fehler'), processing: false });
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
  const result = payload.typ === 'aufgabe' ? await processAufgabe(payload, projects)
    : payload.typ === 'kommunikation' ? await processKommunikation(payload, projects)
    : await processNotiz(payload, projects);

  if (result.ok) {
    await deleteInboxItems(client(), [item.id]);
    useToastStore.getState().push({ message: result.message, actionLabel: 'Öffnen', onAction: result.onOpen });
  } else {
    await markInboxError(client(), item.id, result.error);
  }
}

type ProcessResult = { ok: true; message: string; onOpen: () => void } | { ok: false; error: string };

async function processAufgabe(payload: InboxAufgabePayload, projects: Project[]): Promise<ProcessResult> {
  const validated = validateAufgabe(payload);
  if (!validated.ok) return { ok: false, error: validated.error };
  const v = validated.value;
  const resolved = resolveProject(projects, v.projekt);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const project = resolved.value;

  const { createTask } = useDataStore.getState();
  const data = await useDataStore.getState().ensureProjectData(project.id);
  const kontaktIds = v.kontaktNamen.length ? resolveContactIds(data.contacts, v.kontaktNamen) : [];
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
  const kontaktIds = v.kontaktName ? resolveContactIds(data.contacts, [v.kontaktName]) : [];
  const datum = v.datum || new Date().toISOString().slice(0, 10);
  const teilprojekt = v.teilprojekt
    ? data.subprojects.find((sp) => sp.name.trim().toLocaleLowerCase('de') === v.teilprojekt.toLocaleLowerCase('de'))?.name || ''
    : '';

  const commId = uid();
  const newTaskIds: string[] = [];
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
  }

  await saveComm(project.id, {
    id: commId,
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
    message: `Kommunikationseintrag in ${project.name} angelegt.`,
    onOpen: () => {
      useUiStore.setState({ view: 'project', selectedId: project.id, activeTab: 'kommunikation', sidebarOpen: false });
      getProjectUiStore('primary').getState().jumpToComm(commId);
    },
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
  await useDataStore.getState().saveProjectNote(project.id, {
    id: uid(),
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
    message: `Notiz in ${project.name} angelegt.`,
    onOpen: () => useUiStore.setState({ view: 'project', selectedId: project.id, activeTab: 'notizen', sidebarOpen: false }),
  };
}

export { peekInboxTyp };
