import type { TaskBilledTimeEntry } from '../types/entities';

/** Leitet die Legacy-Summenfelder (billedMinutes/billedDate) aus den einzelnen Zeitbuchungen ab. */
export function summarizeBilledZeiten(entries: TaskBilledTimeEntry[] | undefined): { billedMinutes: number; billedDate: string } {
  const list = entries || [];
  const billedMinutes = list.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  const billedDate = list.reduce((latest, entry) => (entry.datum && entry.datum > latest ? entry.datum : latest), '');
  return { billedMinutes, billedDate };
}
