import { create } from 'zustand';
import { sGet, sSet } from '../lib/supabase';
import { useConnectionStore } from './connectionStore';
import { uid } from '../lib/format';
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

  ensureLoaded: () => Promise<void>;
  select: (id: string | null) => void;
  create: () => Promise<string>;
  save: (id: string, inhalt: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useQuickNoteStore = create<QuickNoteStoreState>((set, get) => ({
  notes: undefined,
  selectedId: null,

  ensureLoaded: async () => {
    if (get().notes !== undefined) return;
    const notes = (await sGet<QuickNote[]>(client(), 'quick-notes')) || [];
    set({ notes });
  },

  select: (id) => set({ selectedId: id }),

  create: async () => {
    const now = new Date().toISOString();
    const note: QuickNote = { id: uid(), inhalt: '', createdAt: now, updatedAt: now };
    const notes = [note, ...(get().notes || [])];
    set({ notes, selectedId: note.id });
    await persist(notes);
    return note.id;
  },

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
