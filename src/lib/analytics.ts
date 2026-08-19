import type { TaskWithMeta } from '../store/dataStore';

export function isoWeekInfo(dateStr: string): { year: number; week: number } {
  const date = new Date(dateStr);
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.getTime();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const week = 1 + Math.round((firstThursday - target.getTime()) / 604800000);
  return { year: new Date(firstThursday).getUTCFullYear(), week };
}

export function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function avg(arr: number[]): number | null {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function fmtDays(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return (Math.round(n * 10) / 10).toString().replace('.', ',') + ' Tag(e)';
}

export interface DailyOpenCount {
  date: Date;
  count: number;
}

/**
 * Counts, for each of the last `days` days, how many tasks were already created and not
 * yet completed as of 00:00 that day. Tasks without erstelltAm are excluded.
 */
export function computeDailyOpenCounts(allTasks: TaskWithMeta[], days: number): DailyOpenCount[] {
  const withCreated = allTasks.filter((t) => t.erstelltAm);
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const result: DailyOpenCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(todayStart.getTime() - i * 86400000);
    const count = withCreated.filter((t) => {
      const created = new Date(t.erstelltAm);
      if (created >= dayStart) return false;
      if (!t.abgeschlossenAm) return true;
      return new Date(t.abgeschlossenAm) >= dayStart;
    }).length;
    result.push({ date: dayStart, count });
  }
  return result;
}

export interface TaskAnalyticsData {
  withDurationCount: number;
  avgDuration: number | null;
  medianDuration: number | null;
  byProject: { name: string; durations: number[] }[];
  sortedYears: number[];
  year: number;
  weeksInYear: number;
  weeklyCounts: Record<number, number>;
  maxWeekCount: number;
  currentWeek: { year: number; week: number };
  completedCount: number;
  dailyCounts: DailyOpenCount[];
  dailyMax: number;
}

export function computeTaskAnalytics(allTasks: TaskWithMeta[], analyticsYear: number, dailyRange: number): TaskAnalyticsData {
  const completed = allTasks.filter((t) => t.status === 'erledigt' && t.abgeschlossenAm);
  const withDuration = completed
    .filter((t) => t.erstelltAm)
    .map((t) => ({ ...t, duration: (new Date(t.abgeschlossenAm as string).getTime() - new Date(t.erstelltAm).getTime()) / 86400000 }))
    .filter((t) => t.duration >= 0);

  const byProjectMap: Record<string, number[]> = {};
  withDuration.forEach((t) => {
    (byProjectMap[t.projectName] = byProjectMap[t.projectName] || []).push(t.duration);
  });
  const byProject = Object.keys(byProjectMap)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, durations: byProjectMap[name] }));

  const weeklyCounts: Record<string, number> = {};
  const years = new Set<number>([analyticsYear]);
  completed.forEach((t) => {
    const { year, week } = isoWeekInfo(t.abgeschlossenAm as string);
    years.add(year);
    const key = `${year}-${week}`;
    weeklyCounts[key] = (weeklyCounts[key] || 0) + 1;
  });
  const sortedYears = Array.from(years).sort((a, b) => b - a);
  const year = analyticsYear;
  const nowInfo = isoWeekInfo(new Date().toISOString());
  const weeksInYear = isoWeekInfo(new Date(Date.UTC(year, 11, 28)).toISOString()).week;
  const weeklyCountsForYear: Record<number, number> = {};
  let maxWeekCount = 1;
  for (let w = 1; w <= weeksInYear; w++) {
    const c = weeklyCounts[`${year}-${w}`] || 0;
    weeklyCountsForYear[w] = c;
    maxWeekCount = Math.max(maxWeekCount, c);
  }

  const dailyCounts = computeDailyOpenCounts(allTasks, dailyRange);
  const dailyMax = Math.max(1, ...dailyCounts.map((d) => d.count));

  return {
    withDurationCount: withDuration.length,
    avgDuration: avg(withDuration.map((t) => t.duration)),
    medianDuration: median(withDuration.map((t) => t.duration)),
    byProject,
    sortedYears,
    year,
    weeksInYear,
    weeklyCounts: weeklyCountsForYear,
    maxWeekCount,
    currentWeek: nowInfo,
    completedCount: completed.length,
    dailyCounts,
    dailyMax,
  };
}

export function dailyCountKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
