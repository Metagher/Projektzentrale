import type { DashFilter } from '../store/uiStore';
import type { ProjectTaskFilter } from '../store/projectUiStore';
import type { TaskWithMeta } from '../store/dataStore';
import type { Task } from '../types/entities';

export function applyDashboardFilters(tasks: TaskWithMeta[], f: DashFilter, dateAware: boolean): TaskWithMeta[] {
  return tasks.filter((t) => {
    if (f.projectId && t.projectId !== f.projectId) return false;
    if (f.prioritaet && (t.prioritaet || 'should') !== f.prioritaet) return false;
    if (f.kontaktId && t.kontaktId !== f.kontaktId) return false;
    if (dateAware && (f.von || f.bis)) {
      if (!t.faelligAm) return false;
      if (f.von && t.faelligAm < f.von) return false;
      if (f.bis && t.faelligAm > f.bis) return false;
    }
    return true;
  });
}

export function applyProjectTaskFilters<T extends Task>(tasks: T[], f: ProjectTaskFilter): T[] {
  return tasks.filter((t) => {
    if (f.prioritaet && (t.prioritaet || 'should') !== f.prioritaet) return false;
    if (f.kontaktId && t.kontaktId !== f.kontaktId) return false;
    if (f.von || f.bis) {
      if (!t.faelligAm) return false;
      if (f.von && t.faelligAm < f.von) return false;
      if (f.bis && t.faelligAm > f.bis) return false;
    }
    return true;
  });
}
