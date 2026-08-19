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
 * Groups projects by customer. Without an explicit customerOrder, each group falls back
 * to appearing at the position of its first project in the status+sortIndex order (so
 * reordering projects alone still keeps both views in sync automatically). Pass the
 * persisted customerOrder through orderCustomerGroups to make group order explicit and
 * independently draggable.
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

/**
 * The full, current list of customer keys in display order: previously stored order first
 * (dropping keys whose customer no longer has any project), then any new/unlisted
 * customers appended in their groupProjectsByCustomer fallback order. Always a permutation
 * of the current groups' keys, so it's safe to persist directly after a reorder.
 */
export function effectiveCustomerOrder(groups: ProjectGroup[], storedOrder: string[]): string[] {
  const existingKeys = new Set(groups.map((g) => g.key));
  const kept = storedOrder.filter((key) => existingKeys.has(key));
  const known = new Set(kept);
  const missing = groups.map((g) => g.key).filter((key) => !known.has(key));
  return [...kept, ...missing];
}

/** Sorts groups by the persisted customer order, defaulting unlisted ones to the end. */
export function orderCustomerGroups(groups: ProjectGroup[], storedOrder: string[]): ProjectGroup[] {
  const order = effectiveCustomerOrder(groups, storedOrder);
  const byKey = new Map(groups.map((g) => [g.key, g]));
  return order.map((key) => byKey.get(key)).filter((g): g is ProjectGroup => !!g);
}
