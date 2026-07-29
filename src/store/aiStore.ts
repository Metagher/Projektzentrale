import { create } from 'zustand';
import { sGet, sSet } from '../lib/supabase';
import { useConnectionStore } from './connectionStore';
import { useDataStore } from './dataStore';
import { callAiSearch, callAnthropicApi, clearAiKey, hasAiKey, setAiKey } from '../lib/ai';
import { buildAllProjectsContext, buildDailyBriefingContext, buildSingleProjectContext } from '../lib/aiContext';
import type { DailyBriefing, Project, ProjectCache } from '../types/entities';

function client() {
  const c = useConnectionStore.getState().client;
  if (!c) throw new Error('Nicht mit Supabase verbunden.');
  return c;
}

interface AiStoreState {
  keyPresent: boolean;
  saveKey: (key: string) => void;
  removeKey: () => void;

  dailyBriefing: DailyBriefing | null | undefined; // undefined = not loaded yet
  dailyBriefingLoading: boolean;
  dailyBriefingError: string | null;
  loadDailyBriefing: () => Promise<void>;
  refreshDailyBriefing: () => Promise<void>;

  aiQuery: string;
  aiAnswer: string;
  aiError: string | null;
  aiLoading: boolean;
  askGlobal: (question: string) => Promise<void>;

  projectAiQuery: string;
  projectAiAnswer: string;
  projectAiError: string | null;
  projectAiLoading: boolean;
  askProject: (p: Project, data: ProjectCache, question: string) => Promise<void>;

  projectAiSummaryLoading: boolean;
  projectAiSummaryError: string | null;
  refreshProjectAiSummary: (p: Project, data: ProjectCache) => Promise<void>;
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

async function generateProjectAiSummary(p: Project, data: ProjectCache): Promise<string[]> {
  const ctx = buildSingleProjectContext(p, data);
  const systemPrompt =
    'Du bist ein Assistent für einen ERP-Consultant im Bereich Lebensmittel-/Fleischverarbeitung. ' +
    'Fasse den aktuellen Stand eines Projekts in genau 5 kurzen, prägnanten Punkten zusammen — je Punkt maximal ein Satz. ' +
    'Berücksichtige besonders: offene Punkte/Risiken, letzte wichtige Kommunikation, anstehende oder überfällige Aufgaben, aktuellen Gesamtstatus. ' +
    'Nutze ausschließlich die bereitgestellten Projektdaten, erfinde nichts. Antworte NUR mit den 5 Punkten, jeder auf einer eigenen Zeile, ohne Einleitung, ohne Nummerierung, ohne Aufzählungszeichen.';
  const userContent = `PROJEKTDATEN:\n${ctx}\n\nErstelle jetzt die 5 Punkte.`;
  const text = await callAnthropicApi(systemPrompt, userContent, 600);
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^[\s\-•*\d.]+/, '').trim())
    .filter(Boolean)
    .slice(0, 5);
  return lines.length ? lines : ['Keine Zusammenfassung erhalten.'];
}

export const useAiStore = create<AiStoreState>((set) => ({
  keyPresent: hasAiKey(),
  saveKey: (key) => {
    setAiKey(key);
    set({ keyPresent: true });
  },
  removeKey: () => {
    clearAiKey();
    set({ keyPresent: false });
  },

  dailyBriefing: undefined,
  dailyBriefingLoading: false,
  dailyBriefingError: null,

  loadDailyBriefing: async () => {
    if (useAiStore.getState().dailyBriefing !== undefined) return;
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

  aiQuery: '',
  aiAnswer: '',
  aiError: null,
  aiLoading: false,

  askGlobal: async (question) => {
    set({ aiQuery: question, aiLoading: true, aiError: null, aiAnswer: '' });
    try {
      const ctx = await buildAllProjectsContext();
      const answer = await callAiSearch(ctx, question);
      set({ aiAnswer: answer });
    } catch (err) {
      set({ aiError: `Die KI-Suche ist fehlgeschlagen. Bitte erneut versuchen. (${(err as Error).message})` });
    }
    set({ aiLoading: false });
  },

  projectAiQuery: '',
  projectAiAnswer: '',
  projectAiError: null,
  projectAiLoading: false,

  askProject: async (p, data, question) => {
    set({ projectAiQuery: question, projectAiLoading: true, projectAiError: null, projectAiAnswer: '' });
    try {
      const ctx = buildSingleProjectContext(p, data);
      const answer = await callAiSearch(ctx, question);
      set({ projectAiAnswer: answer });
    } catch (err) {
      set({ projectAiError: `Die KI-Suche ist fehlgeschlagen. Bitte erneut versuchen. (${(err as Error).message})` });
    }
    set({ projectAiLoading: false });
  },

  projectAiSummaryLoading: false,
  projectAiSummaryError: null,

  refreshProjectAiSummary: async (p, data) => {
    set({ projectAiSummaryLoading: true, projectAiSummaryError: null });
    try {
      const points = await generateProjectAiSummary(p, data);
      const summary = { points, generatedAt: new Date().toISOString() };
      await sSet(client(), 'ai-summary:' + p.id, summary);
      const cache = { ...useDataStore.getState().cache };
      const existing = cache[p.id];
      if (existing) cache[p.id] = { ...existing, aiSummary: summary };
      useDataStore.setState({ cache });
    } catch (err) {
      set({ projectAiSummaryError: `KI-Übersicht konnte nicht erstellt werden. (${(err as Error).message})` });
    }
    set({ projectAiSummaryLoading: false });
  },
}));
