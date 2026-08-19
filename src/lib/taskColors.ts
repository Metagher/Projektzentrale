import { TASK_COLORS } from './constants';
import type { Task, TaskColor } from '../types/entities';

export const DEFAULT_TASK_COLOR_ORDER: TaskColor[] = [...TASK_COLORS];

export function normalizeTaskColorOrder(value: TaskColor[] | null | undefined): TaskColor[] {
  const valid = (value || []).filter((color, index, list) => TASK_COLORS.includes(color) && list.indexOf(color) === index);
  return [...valid, ...TASK_COLORS.filter((color) => !valid.includes(color))];
}

export function compareTaskColors(a: Pick<Task, 'farbe'>, b: Pick<Task, 'farbe'>, order: TaskColor[]): number {
  const aIndex = a.farbe ? order.indexOf(a.farbe) : order.length;
  const bIndex = b.farbe ? order.indexOf(b.farbe) : order.length;
  return (aIndex < 0 ? order.length : aIndex) - (bIndex < 0 ? order.length : bIndex);
}
