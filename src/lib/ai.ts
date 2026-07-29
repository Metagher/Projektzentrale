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
