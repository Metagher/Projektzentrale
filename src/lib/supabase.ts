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

export const INBOX_TABLE = 'projektzentrale_inbox';

export type InboxStatus = 'neu' | 'wird_verarbeitet' | 'fehler';

export interface InboxItem {
  id: string;
  content: string;
  source: string | null;
  status: InboxStatus;
  error_message: string | null;
  claimed_at: string | null;
  created_at: string;
}

/** Ein hängengebliebener Claim (Tab geschlossen, bevor fertig verarbeitet wurde) gilt nach dieser
 * Zeit nicht mehr als aktiv und darf erneut beansprucht werden. */
const STALE_CLAIM_MS = 2 * 60 * 1000;

/** Alle Posteingang-Zeilen des Nutzers, älteste zuerst — für die Verarbeitung und die
 * Fehler-Anzeige. Spalten fehlen noch (Schema-Migration nicht ausgeführt)? Dann liefert Supabase
 * einen Fehler, den wir wie "keine Zeilen" behandeln, statt die App zu blockieren. */
export async function listInboxItems(client: SupabaseClient): Promise<InboxItem[]> {
  const userId = currentUserId();
  if (!userId) return [];
  try {
    const { data, error } = await client
      .from(INBOX_TABLE)
      .select('id, content, source, status, error_message, claimed_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

/**
 * Beansprucht eine Zeile exklusiv zur Verarbeitung — per bedingtem UPDATE, das nur dann etwas
 * ändert, wenn die Zeile noch "neu" ist oder ihr Claim als hängengeblieben gilt. Dieses UPDATE ist
 * durch Postgres' Zeilensperren atomar: laufen zwei Tabs gleichzeitig los, gewinnt genau einer,
 * das zweite UPDATE betrifft 0 Zeilen. Damit genügt eine Statusspalte statt eines
 * DELETE-vor-Verarbeitung (das hätte bei einem Fehler danach die Zeile samt Fehlermeldung bereits
 * gelöscht — widerspricht der Vorgabe, fehlgeschlagene Zeilen für Korrektur/Wiederholung zu
 * behalten).
 */
export async function claimInboxItem(client: SupabaseClient, id: string): Promise<boolean> {
  const userId = currentUserId();
  if (!userId) return false;
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  try {
    const { data, error } = await client
      .from(INBOX_TABLE)
      .update({ status: 'wird_verarbeitet', claimed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .or(`status.eq.neu,and(status.eq.wird_verarbeitet,claimed_at.lt.${staleBefore})`)
      .select('id');
    if (error) return false;
    return !!data && data.length > 0;
  } catch {
    return false;
  }
}

/** Markiert eine beanspruchte Zeile nach gescheiterter Verarbeitung mit Fehlertext — sie bleibt
 * bestehen, damit sie in der Inbox-Ansicht korrigiert, erneut versucht oder gelöscht werden kann. */
export async function markInboxError(client: SupabaseClient, id: string, message: string): Promise<void> {
  const userId = currentUserId();
  if (!userId) return;
  try {
    await client.from(INBOX_TABLE).update({ status: 'fehler', error_message: message }).eq('id', id).eq('user_id', userId);
  } catch {
    // swallow — die Zeile bleibt dann einfach auf "wird_verarbeitet" stehen und gilt nach
    // STALE_CLAIM_MS wieder als beanspruchbar.
  }
}

/** Setzt eine fehlerhafte Zeile für einen erneuten Versuch zurück auf "neu", optional mit
 * korrigiertem Inhalt (manuelle Korrektur in der Inbox-Ansicht). */
export async function retryInboxItem(client: SupabaseClient, id: string, content?: string): Promise<void> {
  const userId = currentUserId();
  if (!userId) return;
  const patch: Record<string, unknown> = { status: 'neu', error_message: null, claimed_at: null };
  if (content !== undefined) patch.content = content;
  try {
    await client.from(INBOX_TABLE).update(patch).eq('id', id).eq('user_id', userId);
  } catch {
    // swallow, matches sDelete's no-op-on-failure behavior
  }
}

/** Entfernt bereits übernommene (oder vom Nutzer verworfene) Posteingang-Einträge. */
export async function deleteInboxItems(client: SupabaseClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const userId = currentUserId();
  if (!userId) return;
  try {
    await client.from(INBOX_TABLE).delete().eq('user_id', userId).in('id', ids);
  } catch {
    // swallow, matches sDelete's no-op-on-failure behavior
  }
}
