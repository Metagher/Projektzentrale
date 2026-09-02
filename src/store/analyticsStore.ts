import { create } from 'zustand';
import { sGet, sSet } from '../lib/supabase';
import { useConnectionStore } from './connectionStore';
import type { AfnLogEntry } from '../types/entities';

function client() {
  const c = useConnectionStore.getState().client;
  if (!c) throw new Error('Nicht mit Supabase verbunden.');
  return c;
}

export type AnalyticsSubTab = 'projekte' | 'aufgaben' | 'zeiten' | 'abrechnung' | 'afn';

interface AnalyticsStoreState {
  analyticsYear: number;
  analyticsSubTab: AnalyticsSubTab;
  analyticsDailyRange: number;
  afnLog: AfnLogEntry[] | undefined; // undefined = not loaded yet

  setAnalyticsYear: (y: number) => void;
  setAnalyticsSubTab: (t: AnalyticsSubTab) => void;
  setAnalyticsDailyRange: (n: number) => void;
  loadAfnLog: () => Promise<void>;
  saveAfnLogEntry: (datum: string, nummer: number) => Promise<boolean>;
}

export const useAnalyticsStore = create<AnalyticsStoreState>((set, get) => ({
  analyticsYear: new Date().getFullYear(),
  analyticsSubTab: 'projekte',
  analyticsDailyRange: 30,
  afnLog: undefined,

  setAnalyticsYear: (y) => set({ analyticsYear: y }),
  setAnalyticsSubTab: (t) => set({ analyticsSubTab: t }),
  setAnalyticsDailyRange: (n) => set({ analyticsDailyRange: n }),

  loadAfnLog: async () => {
    if (get().afnLog !== undefined) return;
    const log = (await sGet<AfnLogEntry[]>(client(), 'afnLeseLog')) || [];
    set({ afnLog: log });
  },

  saveAfnLogEntry: async (datum, nummer) => {
    const log = (get().afnLog || []).slice();
    const idx = log.findIndex((e) => e.datum === datum);
    if (idx >= 0) log[idx] = { datum, nummer };
    else log.push({ datum, nummer });
    set({ afnLog: log });
    return sSet(client(), 'afnLeseLog', log);
  },
}));
