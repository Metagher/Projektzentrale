import type { SupabaseClient } from '@supabase/supabase-js';
import { create } from 'zustand';
import { verifySupabaseConnection } from '../lib/supabase';

const URL_KEY = 'pz_supabase_url';
const KEY_KEY = 'pz_supabase_key';

type Status = 'booting' | 'setup' | 'ready';

interface ConnectionState {
  status: Status;
  client: SupabaseClient | null;
  setupError: string | null;
  setupUrl: string;
  setupKey: string;
  connecting: boolean;
  bannerTitle: string | null;
  bannerBody: string;
  bannerDismissible: boolean;
  boot: () => Promise<void>;
  connect: (url: string, key: string) => Promise<void>;
  showStorageBanner: (title: string, body: string, dismissible: boolean) => void;
  hideStorageBanner: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'booting',
  client: null,
  setupError: null,
  setupUrl: '',
  setupKey: '',
  connecting: false,
  bannerTitle: null,
  bannerBody: '',
  bannerDismissible: true,

  boot: async () => {
    const storedUrl = localStorage.getItem(URL_KEY);
    const storedKey = localStorage.getItem(KEY_KEY);
    if (!storedUrl || !storedKey) {
      set({ status: 'setup' });
      return;
    }
    try {
      const client = await verifySupabaseConnection(storedUrl, storedKey);
      set({ status: 'ready', client, setupUrl: storedUrl, setupKey: storedKey });
    } catch (e) {
      set({
        status: 'setup',
        setupUrl: storedUrl,
        setupKey: storedKey,
        setupError: `Verbindung fehlgeschlagen. Bitte prüfen. (${(e as Error).message || ''})`,
      });
    }
  },

  connect: async (url, key) => {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    const cleanKey = key.trim();
    if (!cleanUrl || !cleanKey) {
      set({ setupError: 'Bitte Project URL und anon key eintragen.', setupUrl: cleanUrl, setupKey: cleanKey });
      return;
    }
    set({ connecting: true, setupUrl: cleanUrl, setupKey: cleanKey });
    try {
      const client = await verifySupabaseConnection(cleanUrl, cleanKey);
      localStorage.setItem(URL_KEY, cleanUrl);
      localStorage.setItem(KEY_KEY, cleanKey);
      set({ status: 'ready', client, connecting: false, setupError: null });
    } catch (e) {
      set({
        connecting: false,
        setupError:
          'Verbindung fehlgeschlagen. Bitte Project URL und anon key prüfen — und ob schema.sql im Supabase SQL-Editor ausgeführt wurde. ' +
          `(${(e as Error).message || ''})`,
      });
    }
  },

  showStorageBanner: (title, body, dismissible) =>
    set({ bannerTitle: title, bannerBody: body, bannerDismissible: dismissible }),
  hideStorageBanner: () => set({ bannerTitle: null }),
}));
