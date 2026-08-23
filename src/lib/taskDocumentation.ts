import type { Task, TaskDocumentationTarget } from '../types/entities';

export function taskDocumentationTarget(task: Pick<Task, 'doku' | 'dokuZiel'>): TaskDocumentationTarget {
  return task.dokuZiel || (task.doku ? 'project' : '');
}

export function taskDocumentationLabel(task: Pick<Task, 'doku' | 'dokuZiel'>): string {
  const target = taskDocumentationTarget(task);
  if (target === 'global') return 'Globale Doku';
  if (target === 'project') return 'Projektdoku';
  return '';
}
