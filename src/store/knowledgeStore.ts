import { create } from 'zustand';
import { sGet, sSet } from '../lib/supabase';
import { useConnectionStore } from './connectionStore';
import { useDataStore } from './dataStore';
import { callAnthropicApi, parseJsonArrayResponse } from '../lib/ai';
import { computeDocLabels } from '../lib/docOutline';
import { htmlToPlainText, truncateText, uid } from '../lib/format';
import type { KnowledgeAiEntry, KnowledgeBase, KnowledgeManualEntry } from '../types/entities';

function client() {
  const c = useConnectionStore.getState().client;
  if (!c) throw new Error('Nicht mit Supabase verbunden.');
  return c;
}

interface KnowledgeStoreState {
  knowledgeBase: KnowledgeBase | undefined; // undefined = not loaded yet
  loading: boolean;
  error: string | null;
  search: string;
  editingId: string | null;

  ensureLoaded: () => Promise<void>;
  setSearch: (v: string) => void;
  setEditingId: (id: string | null) => void;
  addManual: (entry: Omit<KnowledgeManualEntry, 'id' | 'typ'>) => Promise<void>;
  updateManual: (id: string, patch: Partial<Omit<KnowledgeManualEntry, 'id' | 'typ'>>) => Promise<void>;
  deleteManual: (id: string) => Promise<void>;
  deleteAi: (id: string) => Promise<void>;
  refreshFromProjects: () => Promise<void>;
}

async function persist(kb: KnowledgeBase) {
  await sSet(client(), 'knowledge-base', kb);
}

export const useKnowledgeStore = create<KnowledgeStoreState>((set, get) => ({
  knowledgeBase: undefined,
  loading: false,
  error: null,
  search: '',
  editingId: null,

  ensureLoaded: async () => {
    if (get().knowledgeBase !== undefined) return;
    const kb = (await sGet<KnowledgeBase>(client(), 'knowledge-base')) || { manual: [], ai: [], aiUpdatedAt: null };
    if (!kb.manual) kb.manual = [];
    if (!kb.ai) kb.ai = [];
    set({ knowledgeBase: kb });
  },

  setSearch: (v) => set({ search: v }),
  setEditingId: (id) => set({ editingId: id }),

  addManual: async (entry) => {
    const kb = get().knowledgeBase;
    if (!kb) return;
    const next: KnowledgeBase = { ...kb, manual: [...kb.manual, { ...entry, id: uid(), typ: 'manual' }] };
    set({ knowledgeBase: next });
    await persist(next);
  },

  updateManual: async (id, patch) => {
    const kb = get().knowledgeBase;
    if (!kb) return;
    const next: KnowledgeBase = { ...kb, manual: kb.manual.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
    set({ knowledgeBase: next });
    await persist(next);
  },

  deleteManual: async (id) => {
    const kb = get().knowledgeBase;
    if (!kb) return;
    const next: KnowledgeBase = { ...kb, manual: kb.manual.filter((e) => e.id !== id) };
    set({ knowledgeBase: next });
    await persist(next);
  },

  deleteAi: async (id) => {
    const kb = get().knowledgeBase;
    if (!kb) return;
    const next: KnowledgeBase = { ...kb, ai: kb.ai.filter((e) => e.id !== id) };
    set({ knowledgeBase: next });
    await persist(next);
  },

  refreshFromProjects: async () => {
    set({ loading: true, error: null });
    try {
      const { projects, docDefs, ensureProjectData } = useDataStore.getState();
      const labels = computeDocLabels(docDefs || []);
      const docBlocks: string[] = [];
      for (const p of projects || []) {
        const data = await ensureProjectData(p.id);
        const hidden = (data.doc._hidden as string[] | undefined) || [];
        const visibleDefs = (docDefs || []).filter((d) => !hidden.includes(d.id));
        const lines: string[] = [];
        const documentationAreas = data.doc._documentationAreas;
        const areaNames = new Map<string, string>();
        if (Array.isArray(documentationAreas)) documentationAreas.forEach((area) => {
          if (typeof area === 'object' && 'name' in area && 'current' in area) {
            areaNames.set(area.id, area.name);
            const text = htmlToPlainText(area.current.content);
            if (text) lines.push(`Bereich ${area.name} – aktueller Stand: ${text}`);
          }
        });
        const currentState = data.doc._currentProjectState;
        if (areaNames.size === 0 && currentState && !Array.isArray(currentState)) {
          const text = htmlToPlainText(currentState.content);
          if (text) lines.push(`Aktueller Projektstand: ${text}`);
        }
        const statusHistory = data.doc._statusHistory;
        if (Array.isArray(statusHistory)) statusHistory.forEach((entry) => {
          if (typeof entry === 'object' && 'titel' in entry) {
            const text = htmlToPlainText(entry.content);
            lines.push(`${entry.datum} – Bereich ${areaNames.get(entry.bereichId || 'general') || 'Allgemein'} – ${entry.titel}${text ? `: ${text}` : ''}`);
          }
        });
        visibleDefs.forEach((d) => {
          const entry = data.doc[d.id];
          const text = entry && !Array.isArray(entry) ? htmlToPlainText(entry.content) : '';
          if (text) lines.push(`${labels[d.id] || ''} ${d.title}: ${text}`);
        });
        if (lines.length) docBlocks.push(`=== Projekt: ${p.name} ===\n${lines.join('\n')}`);
      }
      if (docBlocks.length === 0) {
        throw new Error('Keine Projektdokumentation vorhanden, aus der Wissen abgeleitet werden könnte.');
      }
      const docContext = truncateText(docBlocks.join('\n\n'), 150000);
      const kb = get().knowledgeBase || { manual: [], ai: [], aiUpdatedAt: null };
      const existingAiContext = kb.ai.map((e) => `- [${e.kategorie}] ${e.titel}: ${htmlToPlainText(e.inhalt)}`).join('\n');

      const systemPrompt =
        "Du pflegst ein projektübergreifendes 'Second Brain' / Wissensdatenbank für einen ERP-Consultant (winweb, Lebensmittel-/Fleischverarbeitungsbranche, EDI/EDIFACT, Bizerba/DIGI-Etikettierung). " +
        'Analysiere die Dokumentationen mehrerer Kundenprojekte und leite daraus wiederverwendbares, projektübergreifendes Wissen ab: technische Muster, wiederkehrende Konfigurationen, Erkenntnisse, Best Practices, typische Fallstricke. ' +
        'Fasse Wissen zum selben Thema aus mehreren Projekten zu EINEM Eintrag zusammen und nenne die relevanten Projektnamen. ' +
        'Erstelle KEINE Einträge zu rein projektspezifischen Details ohne übergreifenden Wert. ' +
        'Antworte AUSSCHLIESSLICH mit einem validen JSON-Array, ohne Erklärung, ohne Markdown-Codeblock, ohne führenden oder folgenden Text. ' +
        'Format je Element: {"titel": string, "kategorie": string (kurzes Schlagwort, z.B. "Bizerba/DIGI", "EDI/EDIFACT", "Etiketten", "Preisauszeichnung", "Sonstiges"), ' +
        '"inhalt": string (prägnanter Fließtext oder Stichpunkte, durch \\n getrennt), "projekte": Array von Projektnamen (string) die zu diesem Wissen beigetragen haben}.';
      const userContent =
        `PROJEKTDOKUMENTATIONEN:\n${docContext}` +
        (existingAiContext
          ? `\n\nBISHERIGE WISSENSEINTRÄGE (zur Orientierung — aktualisiere, verbessere oder ergänze basierend auf dem aktuellen Stand):\n${existingAiContext}`
          : '') +
        '\n\nErstelle jetzt die vollständige, aktuelle Liste der projektübergreifenden Wissenseinträge.';
      const text = await callAnthropicApi(systemPrompt, userContent, 3000);
      const parsed = parseJsonArrayResponse<Record<string, unknown>>(text);

      const ai: KnowledgeAiEntry[] = parsed
        .filter((e) => e && e.titel)
        .map((e) => ({
          id: uid(),
          titel: String(e.titel).slice(0, 150),
          kategorie: e.kategorie ? String(e.kategorie).slice(0, 60) : 'Allgemein',
          inhalt: '<p>' + String(e.inhalt || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n+/g, '</p><p>') + '</p>',
          projekte: Array.isArray(e.projekte) ? (e.projekte as unknown[]).map(String).slice(0, 20) : [],
          typ: 'ai' as const,
        }));
      const next: KnowledgeBase = { ...kb, ai, aiUpdatedAt: new Date().toISOString() };
      set({ knowledgeBase: next });
      await persist(next);
    } catch (err) {
      set({ error: `Wissensdatenbank konnte nicht aktualisiert werden. (${(err as Error).message})` });
    }
    set({ loading: false });
  },
}));
