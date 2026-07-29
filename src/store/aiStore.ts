import { create } from 'zustand';
import { sGet, sSet } from '../lib/supabase';
import { useConnectionStore } from './connectionStore';
import { useDataStore } from './dataStore';
import { callAnthropicApi } from '../lib/ai';
import { buildDailyBriefingContext } from '../lib/aiContext';
import type { DailyBriefing } from '../types/entities';

function client() {
  const c = useConnectionStore.getState().client;
  if (!c) throw new Error('Nicht mit Supabase verbunden.');
  return c;
}

interface AiStoreState {
  dailyBriefing: DailyBriefing | null | undefined; // undefined = not loaded yet
  dailyBriefingLoading: boolean;
  dailyBriefingError: string | null;
  loadDailyBriefing: () => Promise<void>;
  refreshDailyBriefing: () => Promise<void>;
}

async function generateDailyBriefing(): Promise<string[]> {
  const dashboardData = useDataStore.getState().dashboardData;
  const ctx = buildDailyBriefingContext(dashboardData);
  const systemPrompt =
    'Du bist der persönliche Berater eines ERP-Consultants, der viele Projekte parallel betreut (Lebensmittel-/Fleischverarbeitungsbranche). ' +
    'Erstelle auf Basis der offenen Aufgaben und anstehenden Meilenstein-Termine eine kurze, handlungsorientierte Tages-Einschätzung: was heute Priorität haben sollte, was überfällig ist, worauf besonders zu achten ist. ' +
    "Aufgaben, die als BLOCKIERT/'wartet auf' markiert sind, kann der Nutzer gerade nicht selbst vorantreiben — erwähne sie höchstens kurz als Erinnerung (z.B. ggf. nachhaken), aber fordere nicht dazu auf, sie 'heute zu erledigen'. " +
    'Sei konkret und direkt, wie ein guter Berater, der Prioritäten setzt statt nur aufzuzählen. Maximal 6 kurze Punkte, je maximal ein Satz. ' +
    'Nutze ausschließlich die bereitgestellten Daten, erfinde nichts. Antworte NUR mit den Punkten, jeder auf einer eigenen Zeile, ohne Einleitung, ohne Nummerierung, ohne Aufzählungszeichen.';
  const userContent = `DATEN:\n${ctx}\n\nErstelle jetzt deine Einschätzung für heute.`;
  const text = await callAnthropicApi(systemPrompt, userContent, 700);
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^[\s\-•*\d.]+/, '').trim())
    .filter(Boolean)
    .slice(0, 6);
  return lines.length ? lines : ['Keine Einschätzung erhalten.'];
}

export const useAiStore = create<AiStoreState>((set, get) => ({
  dailyBriefing: undefined,
  dailyBriefingLoading: false,
  dailyBriefingError: null,

  loadDailyBriefing: async () => {
    if (get().dailyBriefing !== undefined) return;
    const briefing = (await sGet<DailyBriefing>(client(), 'ai-daily-briefing')) || null;
    set({ dailyBriefing: briefing });
  },

  refreshDailyBriefing: async () => {
    set({ dailyBriefingLoading: true, dailyBriefingError: null });
    try {
      const points = await generateDailyBriefing();
      const briefing: DailyBriefing = { points, generatedAt: new Date().toISOString() };
      set({ dailyBriefing: briefing });
      await sSet(client(), 'ai-daily-briefing', briefing);
    } catch (err) {
      set({ dailyBriefingError: `Die Einschätzung konnte nicht erstellt werden. (${(err as Error).message})` });
    }
    set({ dailyBriefingLoading: false });
  },
}));
