import { fmtDate, htmlToPlainText, todayStr, truncateText } from './format';
import { prioLabel } from './constants';
import type { DashboardData } from '../store/dataStore';

export function buildDailyBriefingContext(dashboardData: DashboardData | null): string {
  const lines: string[] = [];
  lines.push(`Heutiges Datum: ${fmtDate(todayStr())} (${todayStr()})`);
  const tasks = dashboardData?.openTasks || [];
  if (tasks.length) {
    lines.push('Offene Aufgaben (alle Projekte, aktiv zu bearbeiten):');
    tasks.forEach((t) => {
      const overdue = t.faelligAm && t.faelligAm < todayStr();
      const desc = htmlToPlainText(t.beschreibung);
      lines.push(
        `- [${t.projectName}] ${t.titel} | Priorität: ${prioLabel(t.prioritaet || 'should')} | Fällig: ${t.faelligAm ? fmtDate(t.faelligAm) : 'kein Datum'}${overdue ? ' (ÜBERFÄLLIG)' : ''}${desc ? ' — ' + desc : ''}`,
      );
    });
  } else {
    lines.push('Keine offenen Aufgaben.');
  }
  const waiting = dashboardData?.waitingTasks || [];
  if (waiting.length) {
    lines.push('Aufgaben, die BLOCKIERT sind (der Nutzer wartet auf jemand anderen, kann selbst gerade nichts tun):');
    waiting.forEach((t) => {
      lines.push(
        `- [${t.projectName}] ${t.titel} | wartet auf: ${t.wartetAuf || 'unbekannt'}${t.faelligAm ? ' | Fällig: ' + fmtDate(t.faelligAm) : ''}`,
      );
    });
  }
  const milestones = dashboardData?.upcomingMilestones || [];
  if (milestones.length) {
    lines.push('Anstehende Echtlauf-Meilensteine:');
    milestones.forEach((m) => {
      lines.push(`- [${m.projectName}] ${m.titel} | Status: ${m.status} | Termin: ${fmtDate(m.datum)}`);
    });
  }
  return truncateText(lines.join('\n'), 60000);
}
