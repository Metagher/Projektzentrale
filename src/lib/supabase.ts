import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useConnectionStore } from '../store/connectionStore';

const TABLE = 'projektzentrale_kv';

export async function verifySupabaseConnection(url: string, key: string): Promise<SupabaseClient> {
  const client = createClient(url, key);
  const { error } = await client.from(TABLE).select('key').limit(1);
  if (error) throw error;
  return client;
}

/** Jede Zeile gehört einem Nutzer (Row-Level-Security schließt daran an); ohne Login kein Zugriff. */
function currentUserId(): string | null {
  return useConnectionStore.getState().session?.user.id ?? null;
}

/**
 * Reads one JSON value from the projektzentrale_kv table. Mirrors the legacy app's sGet:
 * accepts the value both as a JSON string and as a native object, since existing rows in
 * Supabase were written by the old app using the string-wrapped form.
 */
export async function sGet<T>(client: SupabaseClient, key: string): Promise<T | null> {
  const userId = currentUserId();
  if (!userId) return null;
  try {
    const { data, error } = await client.from(TABLE).select('value').eq('key', key).eq('user_id', userId).maybeSingle();
    if (error || !data) return null;
    return typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
  } catch {
    return null;
  }
}

/**
 * Writes a JSON value, pre-stringified into the jsonb column — kept identical to the legacy
 * app's serialization so old and new rows stay indistinguishable in Supabase.
 */
export async function sSet(client: SupabaseClient, key: string, value: unknown): Promise<boolean> {
  const userId = currentUserId();
  if (!userId) return false;
  try {
    const { error } = await client
      .from(TABLE)
      .upsert({ key, user_id: userId, value: JSON.stringify(value), updated_at: new Date().toISOString() });
    if (error) throw error;
    useConnectionStore.getState().hideStorageBanner();
    return true;
  } catch (e) {
    console.error('Speicherfehler:', e);
    useConnectionStore.getState().showStorageBanner(
      'Speichern fehlgeschlagen.',
      'Deine letzte Änderung wurde möglicherweise nicht gespeichert. ' +
        'Bitte Internetverbindung prüfen und sicherheitshalber ein CSV-Backup sichern, bevor du die Seite schließt.',
      true,
    );
    return false;
  }
}

export async function sDelete(client: SupabaseClient, key: string): Promise<void> {
  const userId = currentUserId();
  if (!userId) return;
  try {
    await client.from(TABLE).delete().eq('key', key).eq('user_id', userId);
  } catch {
    // swallow, matches legacy no-op-on-failure behavior
  }
}
