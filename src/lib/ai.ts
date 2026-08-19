const KEY_STORAGE = 'pz_anthropic_key';

export function hasAiKey(): boolean {
  return !!localStorage.getItem(KEY_STORAGE);
}

export function getAiKey(): string | null {
  return localStorage.getItem(KEY_STORAGE);
}

export function setAiKey(key: string): void {
  localStorage.setItem(KEY_STORAGE, key);
}

export function clearAiKey(): void {
  localStorage.removeItem(KEY_STORAGE);
}

export async function callAnthropicApi(systemPrompt: string, userContent: string, maxTokens?: number): Promise<string> {
  const apiKey = getAiKey();
  if (!apiKey) {
    throw new Error('Kein Anthropic API-Key hinterlegt. Trage ihn unter „⋯ Mehr → KI-Einstellungen” ein, um KI-Funktionen zu nutzen.');
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens || 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!response.ok) {
    let detail = '';
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message ? ' — ' + errBody.error.message : '';
    } catch {
      // ignore
    }
    throw new Error(`API-Fehler (${response.status})${detail}`);
  }
  const data = await response.json();
  const textBlocks: string[] = (data.content || [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text);
  return textBlocks.join('\n').trim();
}

/** Strips ```json fences from an AI response and parses it, validating the result is an array. */
export function parseJsonArrayResponse<T>(text: string): T[] {
  const cleaned = text.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error('Antwort war kein JSON-Array.');
  return parsed as T[];
}

export async function callAiSearch(contextText: string, question: string): Promise<string> {
  const systemPrompt =
    'Du bist ein Assistent für einen ERP-Consultant im Bereich Lebensmittel-/Fleischverarbeitung. ' +
    'Du beantwortest Fragen ausschließlich auf Basis der bereitgestellten Projektdaten (Kommunikationsverlauf, Dokumentation, Ansprechpartner, Aufgaben, Echtlauf-Zeitpläne). ' +
    'Antworte auf Deutsch, präzise und konkret. Nenne bei Aussagen zu einzelnen Projekten immer den Projektnamen. ' +
    'Wenn die Information in den Daten nicht enthalten ist, sag das ehrlich, statt zu spekulieren. Erfinde keine Fakten.';
  const userContent = `PROJEKTDATEN:\n${contextText}\n\nFRAGE: ${question}`;
  const text = await callAnthropicApi(systemPrompt, userContent, 1500);
  return text || 'Keine Antwort erhalten.';
}

export interface ExtractedTask {
  titel: string;
  beschreibung: string;
  faelligAm: string;
}

export async function extractTasksFromComm(
  comm: { datum: string; kanal: string; betreff: string; notiz: string },
  contactName: string | undefined,
  todayStr: string,
  htmlToPlainText: (html: string) => string,
): Promise<ExtractedTask[]> {
  const notizText = htmlToPlainText(comm.notiz);
  const systemPrompt =
    'Du analysierst einen einzelnen Kommunikationseintrag (Teams/Telefon/Mail/Vor-Ort-Notiz) eines ERP-Consultants namens Fabian, der Kundenprojekte im Bereich Lebensmittel-/Fleischverarbeitung betreut. ' +
    'Extrahiere ausschließlich konkrete Aufgaben, die FABIAN SELBST noch erledigen muss (z.B. eigene Zusagen, offene To-dos von ihm). ' +
    'Ignoriere Aufgaben oder Zusagen, die andere Personen (Kunde, Kollegen, Dritte) zu erledigen haben. ' +
    'Antworte AUSSCHLIESSLICH mit einem validen JSON-Array, ohne Erklärung, ohne Markdown-Codeblock, ohne führenden oder folgenden Text. ' +
    'Format je Element: {"titel": string (kurz, max. ca. 80 Zeichen), "beschreibung": string (kurzer Kontext, oder leerer String), ' +
    '"faelligAm": string im Format JJJJ-MM-TT falls im Text ein konkretes oder eindeutig relatives Datum genannt wird, sonst leerer String}. ' +
    'Wenn keine Aufgaben für Fabian erkennbar sind, antworte mit [].';
  const userContent =
    `Heutiges Datum: ${todayStr}\n` +
    `Datum des Eintrags: ${comm.datum || 'unbekannt'}\n` +
    `Kanal: ${comm.kanal}\n` +
    `Ansprechpartner: ${contactName || 'unbekannt'}\n` +
    `Betreff: ${comm.betreff || '(kein Betreff)'}\n` +
    `Notiz:\n${notizText || '(keine Notiz erfasst)'}`;
  const text = await callAnthropicApi(systemPrompt, userContent, 800);
  let parsed: unknown;
  try {
    parsed = parseJsonArrayResponse<Record<string, unknown>>(text);
  } catch {
    throw new Error('Antwort der KI konnte nicht gelesen werden');
  }
  return (parsed as Record<string, unknown>[])
    .filter((t) => t && t.titel)
    .map((t) => ({
      titel: String(t.titel).slice(0, 200),
      beschreibung: t.beschreibung ? String(t.beschreibung) : '',
      faelligAm: /^\d{4}-\d{2}-\d{2}$/.test(String(t.faelligAm)) ? String(t.faelligAm) : '',
    }));
}
