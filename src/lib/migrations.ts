import type { Task, TaskPrio } from '../types/entities';
import { linkedContactIds } from './contacts';
import { uid } from './format';
import { summarizeBilledZeiten } from './taskBilling';

const LEGACY_PRIO: Record<string, TaskPrio> = { hoch: 'must', mittel: 'should', niedrig: 'could' };

export function migratePrio(val: string | undefined): TaskPrio {
  return LEGACY_PRIO[val || ''] || (val as TaskPrio) || 'should';
}

export function migrateTaskContent(task: Task): { task: Task; changed: boolean } {
  const hasLegacyFields = Object.prototype.hasOwnProperty.call(task, 'beschreibung') || Object.prototype.hasOwnProperty.call(task, 'notizen');
  const description = task.beschreibung?.trim() || '';
  const notes = task.notizen?.trim() || '';
  const legacyContent = description && notes
    ? `<h3>Beschreibung</h3>${description}<h3>Interne Notizen</h3>${notes}`
    : description || notes;
  const { beschreibung: _beschreibung, notizen: _notizen, ...rest } = task;
  void _beschreibung;
  void _notizen;
  const legacyBilledMinutes = Math.max(0, Number(task.billedMinutes) || 0);
  const billedZeitenMissing = task.billedZeiten === undefined;
  const billedZeiten = billedZeitenMissing
    ? (legacyBilledMinutes > 0 ? [{ id: uid(), minutes: legacyBilledMinutes, datum: task.billedDate || '' }] : [])
    : task.billedZeiten!;
  const { billedMinutes, billedDate } = summarizeBilledZeiten(billedZeiten);
  return {
    task: {
      ...rest,
      anforderung: task.anforderung || '',
      aktuellerStand: task.aktuellerStand || legacyContent,
      verlauf: task.verlauf || [],
      moduleIds: task.moduleIds || [],
      billedZeiten,
      billedMinutes,
      billedDate,
      kontaktIds: linkedContactIds(task),
      termine: Array.from(new Set((task.termine || []).filter(Boolean))).sort(),
    },
    changed: hasLegacyFields || task.anforderung === undefined || task.aktuellerStand === undefined || task.verlauf === undefined || task.moduleIds === undefined || billedZeitenMissing || (Math.max(0, Number(task.billedMinutes) || 0)) !== billedMinutes || (task.billedDate || '') !== billedDate || task.kontaktIds === undefined || task.termine === undefined,
  };
}
