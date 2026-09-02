import { useEffect, useMemo, useState } from 'react';
import { useAnalyticsStore, type AnalyticsSubTab } from '../../store/analyticsStore';
import { useDataStore, type TaskWithMeta } from '../../store/dataStore';
import TaskAnalytics from './TaskAnalytics';
import AfnLesestandTab from './AfnLesestandTab';
import GlobalPortfolioOverview from './GlobalPortfolioOverview';
import TimeAnalyticsOverview, { type BilledTimeRow } from './TimeAnalyticsOverview';
import AbrechnungOverview from './AbrechnungOverview';

const ANALYTICS_TABS: { id: AnalyticsSubTab; label: string }[] = [
  { id: 'projekte', label: 'Projektauswertung' },
  { id: 'aufgaben', label: 'Aufgabenübersicht' },
  { id: 'zeiten', label: 'Zeiten' },
  { id: 'abrechnung', label: 'Abrechnung' },
  { id: 'afn', label: 'AFN-Lesestand' },
];

export default function AnalyticsView() {
  const { analyticsSubTab, setAnalyticsSubTab } = useAnalyticsStore();
  const projects = useDataStore((s) => s.projects);
  const ensureProjectData = useDataStore((s) => s.ensureProjectData);
  const [allTasks, setAllTasks] = useState<TaskWithMeta[] | null>(null);
  const abrechnungen = useDataStore((s) => s.abrechnungen);
  const timeEntries = useDataStore((s) => s.timeEntries);
  const saveTimeEntry = useDataStore((s) => s.saveTimeEntry);
  const deleteTimeEntry = useDataStore((s) => s.deleteTimeEntry);
  const workdayOverrides = useDataStore((s) => s.workdayOverrides);
  const projectTimeTypes = useDataStore((s) => s.projectTimeTypes);

  useEffect(() => {
    if ((analyticsSubTab !== 'projekte' && analyticsSubTab !== 'aufgaben' && analyticsSubTab !== 'zeiten') || !projects) return;
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

  const billedRows = useMemo(() => {
    const byProject = new Map<string, BilledTimeRow>();
    abrechnungen.forEach((item) => {
      if (!item.projectId || !(item.minutes > 0) || !item.datum) return;
      const row = byProject.get(item.projectId) || { projectId: item.projectId, minutes: 0, days: [], items: [] };
      row.minutes += item.minutes;
      const day = row.days!.find((entry) => entry.date === item.datum);
      if (day) day.minutes += item.minutes;
      else row.days!.push({ date: item.datum, minutes: item.minutes });
      row.items!.push({ date: item.datum, art: item.art, label: item.bemerkung || item.kunde, minutes: item.minutes });
      byProject.set(item.projectId, row);
    });
    return Array.from(byProject.values());
  }, [abrechnungen]);
  const timeTaskLabels = useMemo(
    () => Object.fromEntries((allTasks || []).map((task) => [task.id, `${task.nr} · ${task.titel}`])),
    [allTasks],
  );

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
      ) : analyticsSubTab === 'abrechnung' ? (
        <AbrechnungOverview />
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
