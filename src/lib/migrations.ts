import type { TaskPrio } from '../types/entities';

const LEGACY_PRIO: Record<string, TaskPrio> = { hoch: 'must', mittel: 'should', niedrig: 'could' };

export function migratePrio(val: string | undefined): TaskPrio {
  return LEGACY_PRIO[val || ''] || (val as TaskPrio) || 'should';
}
