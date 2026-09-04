import type { Task, TaskPrio, TaskProgressEntry } from '../types/entities';
import { linkedContactIds } from './contacts';
import { uid } from './format';

const LEGACY_PRIO: Record<string, TaskPrio> = { hoch: 'must', mittel: 'should', niedrig: 'could' };

export function migratePrio(val: string | undefined): TaskPrio {
  return LEGACY_PRIO[val || ''] || (val as TaskPrio) || 'should';
}

/** Datum, mit dem migrierte Anforderung/Aktueller-Stand-Inhalte als ältester Verlaufseintrag einsortiert werden. */
const REQUIREMENT_MIGRATION_DATE = '2026-08-01';

export function migrateTaskContent(task: Task): { task: Task; changed: boolean } {
  const hasLegacyFields = Object.prototype.hasOwnProperty.call(task, 'beschreibung') || Object.prototype.hasOwnProperty.call(task, 'notizen');
  const description = task.beschreibung?.trim() || '';
  const notes = task.notizen?.trim() || '';
  const legacyContent = description && notes
    ? `<h3>Beschreibung</h3>${description}<h3>Interne Notizen</h3>${notes}`
    : description || notes;

  const hasRequirementFields = Object.prototype.hasOwnProperty.call(task, 'anforderung') || Object.prototype.hasOwnProperty.call(task, 'aktuellerStand');
  const anforderung = task.anforderung?.trim() || legacyContent;
  const aktuellerStand = task.aktuellerStand?.trim() || '';
  const requirementContent = anforderung && aktuellerStand
    ? `<h3>Anforderung</h3>${anforderung}<h3>Aktueller Stand</h3>${aktuellerStand}`
    : anforderung || aktuellerStand;
  const verlauf = task.verlauf || [];
  const migratedVerlauf: TaskProgressEntry[] = requirementContent
    ? [...verlauf, {
        id: uid(),
        datum: REQUIREMENT_MIGRATION_DATE,
        titel: 'Anforderung & früherer Stand (migriert)',
        content: requirementContent,
        createdAt: `${REQUIREMENT_MIGRATION_DATE}T00:00:00.000Z`,
        updatedAt: `${REQUIREMENT_MIGRATION_DATE}T00:00:00.000Z`,
      }]
    : verlauf;

  const { beschreibung: _beschreibung, notizen: _notizen, anforderung: _anforderung, aktuellerStand: _aktuellerStand, ...rest } = task;
  void _beschreibung;
  void _notizen;
  void _anforderung;
  void _aktuellerStand;
  return {
    task: {
      ...rest,
      verlauf: migratedVerlauf,
      moduleIds: task.moduleIds || [],
      kontaktIds: linkedContactIds(task),
      termine: Array.from(new Set((task.termine || []).filter(Boolean))).sort(),
    },
    changed: hasLegacyFields || hasRequirementFields || task.verlauf === undefined || task.moduleIds === undefined || task.kontaktIds === undefined || task.termine === undefined,
  };
}
