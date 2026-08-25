import type { DashFilter } from '../store/uiStore';
import type { ProjectTaskFilter } from '../store/projectUiStore';
import type { TaskWithMeta } from '../store/dataStore';
import type { Task } from '../types/entities';
import { linkedContactIds } from './contacts';

export function applyDashboardFilters<T extends TaskWithMeta>(tasks: T[], f: DashFilter, dateAware: boolean): T[] {
  return tasks.filter((t) => {
    if (f.projectId && t.projectId !== f.projectId) return false;
    if (f.kontaktId && !linkedContactIds(t).includes(f.kontaktId)) return false;
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
    if (f.kontaktId && !linkedContactIds(t).includes(f.kontaktId)) return false;
    if (f.von || f.bis) {
      if (!t.faelligAm) return false;
      if (f.von && t.faelligAm < f.von) return false;
      if (f.bis && t.faelligAm > f.bis) return false;
    }
    return true;
  });
}
