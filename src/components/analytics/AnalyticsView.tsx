import { useEffect, useState } from 'react';
import { useAnalyticsStore, type AnalyticsSubTab } from '../../store/analyticsStore';
import { useDataStore, type TaskWithMeta } from '../../store/dataStore';
import TaskAnalytics from './TaskAnalytics';
import AfnLesestandTab from './AfnLesestandTab';
import GlobalPortfolioOverview from './GlobalPortfolioOverview';
import TimeAnalyticsOverview from './TimeAnalyticsOverview';

export default function AnalyticsView() {
  const { analyticsSubTab, setAnalyticsSubTab } = useAnalyticsStore();
  const projects = useDataStore((s) => s.projects);
  const ensureProjectData = useDataStore((s) => s.ensureProjectData);
  const [allTasks, setAllTasks] = useState<TaskWithMeta[] | null>(null);
  const timeEntries = useDataStore((s) => s.timeEntries);
  const workdayOverrides = useDataStore((s) => s.workdayOverrides);

  useEffect(() => {
    if (analyticsSubTab !== 'aufgaben' || !projects) return;
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

  return (
    <div className="main-inner">
      <header className="page-header analytics-page-header"><div className="eyebrow">Gesamtunternehmen</div><h2>Globale Auswertung</h2><p>Projektportfolio, übergreifende Risiken und langfristige Leistungsentwicklung.</p></header>
      <div className="tabs">
        {(['aufgaben', 'afn'] as AnalyticsSubTab[]).map((t) => (
          <button
            key={t}
            className={`tab-btn${analyticsSubTab === t ? ' active' : ''}`}
            onClick={() => setAnalyticsSubTab(t)}
          >
            {t === 'aufgaben' ? 'Projektportfolio' : 'AFN-Lesestand'}
          </button>
        ))}
      </div>
      {analyticsSubTab === 'afn' ? (
        <AfnLesestandTab />
      ) : !allTasks ? (
        <div className="loading-note">Lade Auswertung…</div>
      ) : (
        <>
          <GlobalPortfolioOverview projects={projects || []} tasks={allTasks} />
          <div className="analytics-section-intro"><div className="analytics-scope-label">Langfristige Entwicklung</div><h3>Projektübergreifende Aufgabenleistung</h3><p>Durchlaufzeiten, Abschlüsse pro Kalenderwoche und Entwicklung des offenen Bestands.</p></div>
          <TaskAnalytics allTasks={allTasks} showProjectBreakdown />
          <TimeAnalyticsOverview entries={timeEntries} projects={projects || []} workdayOverrides={workdayOverrides} heading="Projektübergreifende Zeitauswertung" />
        </>
      )}
    </div>
  );
}
