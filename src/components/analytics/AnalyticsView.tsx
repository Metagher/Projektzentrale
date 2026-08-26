import { useEffect, useState } from 'react';
import { useAnalyticsStore, type AnalyticsSubTab } from '../../store/analyticsStore';
import { useDataStore, type TaskWithMeta } from '../../store/dataStore';
import TaskAnalytics from './TaskAnalytics';
import AfnLesestandTab from './AfnLesestandTab';
import GlobalPortfolioOverview from './GlobalPortfolioOverview';
import TimeAnalyticsOverview, { type BilledTimeRow } from './TimeAnalyticsOverview';

const ANALYTICS_TABS: { id: AnalyticsSubTab; label: string }[] = [
  { id: 'projekte', label: 'Projektauswertung' },
  { id: 'aufgaben', label: 'Aufgabenübersicht' },
  { id: 'zeiten', label: 'Zeiten' },
  { id: 'afn', label: 'AFN-Lesestand' },
];

export default function AnalyticsView() {
  const { analyticsSubTab, setAnalyticsSubTab } = useAnalyticsStore();
  const projects = useDataStore((s) => s.projects);
  const ensureProjectData = useDataStore((s) => s.ensureProjectData);
  const [allTasks, setAllTasks] = useState<TaskWithMeta[] | null>(null);
  const [billedRows, setBilledRows] = useState<BilledTimeRow[]>([]);
  const [timeTaskLabels, setTimeTaskLabels] = useState<Record<string, string>>({});
  const timeEntries = useDataStore((s) => s.timeEntries);
  const saveTimeEntry = useDataStore((s) => s.saveTimeEntry);
  const deleteTimeEntry = useDataStore((s) => s.deleteTimeEntry);
  const workdayOverrides = useDataStore((s) => s.workdayOverrides);
  const projectTimeTypes = useDataStore((s) => s.projectTimeTypes);

  useEffect(() => {
    if ((analyticsSubTab !== 'projekte' && analyticsSubTab !== 'aufgaben') || !projects) return;
    let cancelled = false;
    (async () => {
      const all: TaskWithMeta[] = [];
      for (const p of projects) {
        const data = await ensureProjectData(p.id);
        data.tasks.forEach((t) => all.push({ ...t, projectId: p.id, projectName: p.name }));
      }
      if (!cancelled) setAllTasks(all);
    })();
    return () => {
      cancelled = true;
    };
  }, [analyticsSubTab, projects, ensureProjectData]);

  useEffect(() => {
    if (analyticsSubTab !== 'zeiten' || !projects) return;
    let cancelled = false;
    (async () => {
      const rows: BilledTimeRow[] = [];
      const countedTasks = new Set<string>();
      const labels: Record<string, string> = {};
      for (const project of projects) {
        const data = await ensureProjectData(project.id);
        let taskMinutes = 0;
        const billedDays = new Map<string, { taskMinutes: number; communicationMinutes: number }>();
        const billedItems: NonNullable<BilledTimeRow['items']> = [];
        data.tasks.forEach((task) => {
          labels[task.id] = `${task.nr} · ${task.titel}`;
          if (countedTasks.has(task.id)) return;
          countedTasks.add(task.id);
          const minutes = Number(task.billedMinutes) || 0;
          taskMinutes += minutes;
          if (minutes > 0 && task.billedDate) {
            const day = billedDays.get(task.billedDate) || { taskMinutes: 0, communicationMinutes: 0 };
            day.taskMinutes += minutes;
            billedDays.set(task.billedDate, day);
            billedItems.push({ date: task.billedDate, kind: 'Aufgabe', label: `${task.nr} · ${task.titel}`, minutes });
          }
        });
        const communicationMinutes = data.comms.reduce((sum, comm) => {
          const minutes = Number(comm.billedMinutes) || 0;
          if (minutes > 0 && comm.datum) {
            const day = billedDays.get(comm.datum) || { taskMinutes: 0, communicationMinutes: 0 };
            day.communicationMinutes += minutes;
            billedDays.set(comm.datum, day);
            billedItems.push({ date: comm.datum, kind: 'Kommunikation', label: comm.betreff || comm.kanal, minutes });
          }
          return sum + minutes;
        }, 0);
        rows.push({ projectId: project.id, taskMinutes, communicationMinutes, days: Array.from(billedDays, ([date, values]) => ({ date, ...values })), items: billedItems });
      }
      if (!cancelled) { setBilledRows(rows); setTimeTaskLabels(labels); }
    })();
    return () => { cancelled = true; };
  }, [analyticsSubTab, projects, ensureProjectData]);

  return (
    <div className="main-inner">
      <header className="page-header analytics-page-header"><div className="eyebrow">Gesamtunternehmen</div><h2>Globale Auswertung</h2><p>Projektportfolio, übergreifende Risiken und langfristige Leistungsentwicklung.</p></header>
      <div className="analytics-subtabs" role="tablist" aria-label="Bereich der globalen Auswertung">
        {ANALYTICS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={analyticsSubTab === tab.id}
            className={`analytics-subtab${analyticsSubTab === tab.id ? ' active' : ''}`}
            onClick={() => setAnalyticsSubTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {analyticsSubTab === 'afn' ? (
        <AfnLesestandTab />
      ) : analyticsSubTab === 'zeiten' ? (
        <TimeAnalyticsOverview entries={timeEntries} projects={projects || []} workdayOverrides={workdayOverrides} heading="Projektübergreifende Zeitauswertung" billedRows={billedRows} taskLabels={timeTaskLabels} timeTypeLabels={Object.fromEntries(projectTimeTypes.map((type) => [type.id, type.name]))} onSaveEntry={saveTimeEntry} onDeleteEntry={deleteTimeEntry} />
      ) : !allTasks ? (
        <div className="loading-note">Lade Auswertung…</div>
      ) : analyticsSubTab === 'projekte' ? (
        <GlobalPortfolioOverview projects={projects || []} tasks={allTasks} />
      ) : (
        <>
          <div className="analytics-section-intro"><div className="analytics-scope-label">Langfristige Entwicklung</div><h3>Projektübergreifende Aufgabenleistung</h3><p>Durchlaufzeiten, Abschlüsse pro Kalenderwoche und Entwicklung des offenen Bestands.</p></div>
          <TaskAnalytics allTasks={allTasks} showProjectBreakdown />
        </>
      )}
    </div>
  );
}
