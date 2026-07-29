import { useEffect, useState } from 'react';
import { useAnalyticsStore, type AnalyticsSubTab } from '../../store/analyticsStore';
import { useDataStore, type TaskWithMeta } from '../../store/dataStore';
import TaskAnalytics from './TaskAnalytics';
import AfnLesestandTab from './AfnLesestandTab';

export default function AnalyticsView() {
  const { analyticsSubTab, setAnalyticsSubTab } = useAnalyticsStore();
  const projects = useDataStore((s) => s.projects);
  const ensureProjectData = useDataStore((s) => s.ensureProjectData);
  const [allTasks, setAllTasks] = useState<TaskWithMeta[] | null>(null);

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
      <h2>📊 Auswertung</h2>
      <div className="tabs">
        {(['aufgaben', 'afn'] as AnalyticsSubTab[]).map((t) => (
          <button
            key={t}
            className={`tab-btn${analyticsSubTab === t ? ' active' : ''}`}
            onClick={() => setAnalyticsSubTab(t)}
          >
            {t === 'aufgaben' ? 'Aufgaben' : 'AFN-Lesestand'}
          </button>
        ))}
      </div>
      {analyticsSubTab === 'afn' ? (
        <AfnLesestandTab />
      ) : !allTasks ? (
        <div className="loading-note">Lade Auswertung…</div>
      ) : (
        <>
          <div className="sub" style={{ color: 'var(--ink-soft)', margin: '4px 0 6px' }}>
            Durchlaufzeit von Erstellung bis Abschluss, projektübergreifend, nach Projekt und Priorität — sowie deine
            Produktivität pro Kalenderwoche.
          </div>
          <div className="an-note">
            Basiert nur auf Aufgaben, die seit Einführung dieser Auswertung angelegt bzw. abgeschlossen wurden —
            ältere Aufgaben ohne Erstelldatum fließen in die Durchlaufzeit nicht ein, zählen aber bei der
            Wochenübersicht mit, sobald sie ein Abschlussdatum haben.
          </div>
          <TaskAnalytics allTasks={allTasks} showProjectBreakdown />
        </>
      )}
    </div>
  );
}
