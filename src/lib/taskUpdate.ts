import type { Task } from '../types/entities';

export function taskUpdateLabel(task: Pick<Task, 'updateVormerkung' | 'updateRevision'>): string {
  if (!task.updateVormerkung) return '';
  const revision = task.updateRevision?.trim();
  return revision ? `Update ${revision}` : 'Update vorgemerkt';
}
