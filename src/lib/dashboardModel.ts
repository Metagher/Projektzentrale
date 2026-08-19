import type { DashboardData } from '../store/dataStore';
import type { Project } from '../types/entities';
import { todayStr } from './format';

export interface DashboardSummary {
  activeProjects: number;
  openTasks: number;
  overdueTasks: number;
  upcomingMilestones: number;
}

export function getDashboardSummary(projects: Project[], data: DashboardData): DashboardSummary {
  const today = new Date(todayStr()).getTime();
  const inThirtyDays = today + 30 * 86_400_000;

  return {
    activeProjects: projects.filter((project) => project.status === 'aktiv').length,
    openTasks: data.openTasks.length,
    overdueTasks: data.overdueTasks.length,
    upcomingMilestones: data.upcomingMilestones.filter((milestone) => {
      if (!milestone.datum) return false;
      const date = new Date(milestone.datum).getTime();
      return date >= today && date <= inThirtyDays;
    }).length,
  };
}
