import type { Task, TaskPrio } from '../types/entities';
import { linkedContactIds } from './contacts';

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
  return {
    task: {
      ...rest,
      anforderung: task.anforderung || '',
      aktuellerStand: task.aktuellerStand || legacyContent,
      verlauf: task.verlauf || [],
      moduleIds: task.moduleIds || [],
      kontaktIds: linkedContactIds(task),
      termine: Array.from(new Set((task.termine || []).filter(Boolean))).sort(),
    },
    changed: hasLegacyFields || task.anforderung === undefined || task.aktuellerStand === undefined || task.verlauf === undefined || task.moduleIds === undefined || task.kontaktIds === undefined || task.termine === undefined,
  };
}
