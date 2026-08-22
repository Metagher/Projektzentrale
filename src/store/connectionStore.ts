import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { create } from 'zustand';
import { verifySupabaseConnection } from '../lib/supabase';
import { sendLoginCode, verifyLoginCode, signOut as authSignOut } from '../lib/auth';

const URL_KEY = 'pz_supabase_url';
const KEY_KEY = 'pz_supabase_key';

type Status = 'booting' | 'setup' | 'login' | 'ready';
type LoginStep = 'email' | 'code';

interface ConnectionState {
  status: Status;
  client: SupabaseClient | null;
  session: Session | null;
  setupError: string | null;
  setupUrl: string;
  setupKey: string;
  connecting: boolean;
  bannerTitle: string | null;
  bannerBody: string;
  bannerDismissible: boolean;
  loginStep: LoginStep;
  loginEmail: string;
  loginCode: string;
  loginBusy: boolean;
  loginError: string | null;
  boot: () => Promise<void>;
  connect: (url: string, key: string) => Promise<void>;
  requestLoginCode: (email: string) => Promise<void>;
  verifyLoginCode: (code: string) => Promise<void>;
  resetLoginStep: () => void;
  signOut: () => Promise<void>;
  showStorageBanner: (title: string, body: string, dismissible: boolean) => void;
  hideStorageBanner: () => void;
}

function attachAuthListener(client: SupabaseClient, set: (partial: Partial<ConnectionState>) => void) {
  client.auth.onAuthStateChange((_event, session) => {
    set({ session, status: session ? 'ready' : 'login' });
  });
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  status: 'booting',
  client: null,
  session: null,
  setupError: null,
  setupUrl: '',
  setupKey: '',
  connecting: false,
  bannerTitle: null,
  bannerBody: '',
  bannerDismissible: true,
  loginStep: 'email',
  loginEmail: '',
  loginCode: '',
  loginBusy: false,
  loginError: null,

  boot: async () => {
    const storedUrl = localStorage.getItem(URL_KEY);
    const storedKey = localStorage.getItem(KEY_KEY);
    if (!storedUrl || !storedKey) {
      set({ status: 'setup' });
      return;
    }
    try {
      const client = await verifySupabaseConnection(storedUrl, storedKey);
      attachAuthListener(client, set);
      set({ client, setupUrl: storedUrl, setupKey: storedKey });
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
      attachAuthListener(client, set);
      set({ client, connecting: false, setupError: null });
    } catch (e) {
      set({
        connecting: false,
        setupError:
          'Verbindung fehlgeschlagen. Bitte Project URL und anon key prüfen — und ob schema.sql im Supabase SQL-Editor ausgeführt wurde. ' +
          `(${(e as Error).message || ''})`,
      });
    }
  },

  requestLoginCode: async (email) => {
    const client = get().client;
    const cleanEmail = email.trim();
    if (!client || !cleanEmail) return;
    set({ loginBusy: true, loginError: null });
    try {
      await sendLoginCode(client, cleanEmail);
      set({ loginBusy: false, loginStep: 'code', loginEmail: cleanEmail, loginCode: '' });
    } catch (e) {
      set({ loginBusy: false, loginError: `Code konnte nicht gesendet werden. (${(e as Error).message || ''})` });
    }
  },

  verifyLoginCode: async (code) => {
    const client = get().client;
    const { loginEmail } = get();
    const cleanCode = code.trim();
    if (!client || !cleanCode) return;
    set({ loginBusy: true, loginError: null });
    try {
      await verifyLoginCode(client, loginEmail, cleanCode);
      set({ loginBusy: false });
    } catch (e) {
      set({ loginBusy: false, loginError: `Code ungültig oder abgelaufen. (${(e as Error).message || ''})` });
    }
  },

  resetLoginStep: () => set({ loginStep: 'email', loginCode: '', loginError: null }),

  signOut: async () => {
    const client = get().client;
    if (!client) return;
    await authSignOut(client);
    set({ loginStep: 'email', loginEmail: '', loginCode: '', loginError: null });
  },

  showStorageBanner: (title, body, dismissible) =>
    set({ bannerTitle: title, bannerBody: body, bannerDismissible: dismissible }),
  hideStorageBanner: () => set({ bannerTitle: null }),
}));
