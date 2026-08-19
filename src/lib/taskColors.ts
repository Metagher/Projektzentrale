import { TASK_COLORS, TASK_COLOR_LABELS } from './constants';
import type { Task, TaskColor } from '../types/entities';

export const DEFAULT_TASK_COLOR_ORDER: TaskColor[] = [...TASK_COLORS];
export type TaskColorLabels = Record<TaskColor, string>;
export const DEFAULT_TASK_COLOR_LABELS: TaskColorLabels = { ...TASK_COLOR_LABELS };

export function normalizeTaskColorOrder(value: TaskColor[] | null | undefined): TaskColor[] {
  const valid = (value || []).filter((color, index, list) => TASK_COLORS.includes(color) && list.indexOf(color) === index);
  return [...valid, ...TASK_COLORS.filter((color) => !valid.includes(color))];
}

export function normalizeTaskColorLabels(value: Partial<TaskColorLabels> | null | undefined): TaskColorLabels {
  return Object.fromEntries(TASK_COLORS.map((color) => [color, String(value?.[color] || '').trim() || TASK_COLOR_LABELS[color]])) as TaskColorLabels;
}

export function compareTaskColors(a: Pick<Task, 'farbe'>, b: Pick<Task, 'farbe'>, order: TaskColor[]): number {
  const aIndex = a.farbe ? order.indexOf(a.farbe) : order.length;
  const bIndex = b.farbe ? order.indexOf(b.farbe) : order.length;
  return (aIndex < 0 ? order.length : aIndex) - (bIndex < 0 ? order.length : bIndex);
}

export function compareWaitingPerson(a: Pick<Task, 'wartetAuf'>, b: Pick<Task, 'wartetAuf'>): number {
  const aPerson = (a.wartetAuf || '').trim();
  const bPerson = (b.wartetAuf || '').trim();
  if (!aPerson && bPerson) return 1;
  if (aPerson && !bPerson) return -1;
  return aPerson.localeCompare(bPerson, 'de', { sensitivity: 'base', numeric: true });
}
