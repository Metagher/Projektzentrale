import { create } from 'zustand';
import { deleteInboxItems, listInboxItems, sGet, sSet } from '../lib/supabase';
import { useConnectionStore } from './connectionStore';
import { uid } from '../lib/format';
import { plainTextToHtml } from '../lib/richText';
import type { QuickNote } from '../types/entities';

function client() {
  const c = useConnectionStore.getState().client;
  if (!c) throw new Error('Nicht mit Supabase verbunden.');
  return c;
}

async function persist(notes: QuickNote[]) {
  await sSet(client(), 'quick-notes', notes);
}

interface QuickNoteStoreState {
  notes: QuickNote[] | undefined; // undefined = noch nicht geladen
  selectedId: string | null;
  /** Id der zuletzt über create() angelegten Notiz, damit deren Editor direkt im
   * Handschrift-Modus startet — in derselben State-Änderung wie selectedId gesetzt, damit
   * keine Race zwischen dem Promise-Abschluss von create() und dem Re-Render entsteht. */
  justCreatedId: string | null;

  ensureLoaded: () => Promise<void>;
  /** Übernimmt extern eingereichte Notizen (Posteingang, z.B. per Apple Kurzbefehl aus Apple
   * Notizen) in die normale Liste und räumt den Posteingang danach leer. */
  importFromInbox: () => Promise<void>;
  select: (id: string | null) => void;
  create: () => Promise<string>;
  clearJustCreated: () => void;
  save: (id: string, inhalt: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useQuickNoteStore = create<QuickNoteStoreState>((set, get) => ({
  notes: undefined,
  selectedId: null,
  justCreatedId: null,

  ensureLoaded: async () => {
    if (get().notes !== undefined) return;
    const notes = (await sGet<QuickNote[]>(client(), 'quick-notes')) || [];
    set({ notes });
  },

  importFromInbox: async () => {
    const items = await listInboxItems(client());
    if (items.length === 0) return;
    const imported: QuickNote[] = items.map((item) => ({
      id: uid(),
      inhalt: plainTextToHtml(item.content),
      createdAt: item.created_at,
      updatedAt: item.created_at,
    }));
    const notes = [...imported, ...(get().notes || [])];
    set({ notes });
    await persist(notes);
    await deleteInboxItems(client(), items.map((item) => item.id));
  },

  select: (id) => set({ selectedId: id }),

  create: async () => {
    const now = new Date().toISOString();
    const note: QuickNote = { id: uid(), inhalt: '', createdAt: now, updatedAt: now };
    const notes = [note, ...(get().notes || [])];
    set({ notes, selectedId: note.id, justCreatedId: note.id });
    await persist(notes);
    return note.id;
  },

  clearJustCreated: () => set({ justCreatedId: null }),

  save: async (id, inhalt) => {
    const notes = (get().notes || []).map((note) => (note.id === id ? { ...note, inhalt, updatedAt: new Date().toISOString() } : note));
    set({ notes });
    await persist(notes);
  },

  remove: async (id) => {
    const notes = (get().notes || []).filter((note) => note.id !== id);
    set({ notes, selectedId: get().selectedId === id ? null : get().selectedId });
    await persist(notes);
  },
}));
