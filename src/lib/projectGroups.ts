import type { Project } from '../types/entities';

const STATUS_ORDER: Record<string, number> = { aktiv: 0, pausiert: 1, abgeschlossen: 2 };

export interface ProjectGroup {
  key: string;
  label: string;
  projects: Project[];
}

export function sortProjectsByStatusAndOrder(projects: Project[]): Project[] {
  return projects
    .slice()
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) || (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
}

/** Same customer-name normalization used everywhere projects are grouped by Kunde. */
export function customerKey(kunde: string): { key: string; label: string } {
  const label = kunde.trim() || 'Ohne Kunde';
  return { key: label.toLocaleLowerCase('de'), label };
}

/**
 * Groups projects by customer, in the same order used by the quick-access bar: projects
 * are first ordered by status then sortIndex, and each customer group appears at the
 * position of its first project in that order — so reordering projects (which only ever
 * changes sortIndex) keeps both views in sync automatically.
 */
export function groupProjectsByCustomer(projects: Project[]): ProjectGroup[] {
  const sorted = sortProjectsByStatusAndOrder(projects);
  return sorted.reduce<ProjectGroup[]>((groups, project) => {
    const { key, label } = customerKey(project.kunde);
    const existing = groups.find((g) => g.key === key);
    if (existing) existing.projects.push(project);
    else groups.push({ key, label, projects: [project] });
    return groups;
  }, []);
}
