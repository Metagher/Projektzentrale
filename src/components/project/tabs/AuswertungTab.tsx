import { useState } from 'react';
import TaskAnalytics from '../../analytics/TaskAnalytics';
import type { Project, ProjectCache } from '../../../types/entities';
import ProjectOperationalOverview from '../../analytics/ProjectOperationalOverview';
import ZeitenTab from './ZeitenTab';

type ProjectAnalyticsTab = 'projekt' | 'aufgaben' | 'zeiten';

const PROJECT_ANALYTICS_TABS: { id: ProjectAnalyticsTab; label: string }[] = [
  { id: 'projekt', label: 'Projektauswertung' },
  { id: 'aufgaben', label: 'Aufgabenübersicht' },
  { id: 'zeiten', label: 'Zeiten' },
];

export default function AuswertungTab({ project, data }: { project: Project; data: ProjectCache }) {
  const [activeSection, setActiveSection] = useState<ProjectAnalyticsTab>('projekt');
  const allTasks = data.tasks.map((t) => ({ ...t, projectId: project.id, projectName: project.name }));

  return (
    <>
      <header className="project-analysis-header"><div className="eyebrow">Einzelprojekt</div><h3>Projektauswertung · {project.name}</h3><p>Aktueller Arbeitsbestand, Risiken, Datenqualität und Entwicklung dieses Projekts.</p></header>
      <div className="analytics-subtabs" role="tablist" aria-label="Bereich der Projektauswertung">
        {PROJECT_ANALYTICS_TABS.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeSection === tab.id} className={`analytics-subtab${activeSection === tab.id ? ' active' : ''}`} onClick={() => setActiveSection(tab.id)}>{tab.label}</button>)}
      </div>
      {activeSection === 'projekt' ? (
        <ProjectOperationalOverview data={data} />
      ) : activeSection === 'aufgaben' ? (
        <>
          <div className="analytics-section-intro"><div className="analytics-scope-label">Projektentwicklung</div><h3>Durchlaufzeit und Leistung</h3><p>Historische Entwicklung ausschließlich für dieses Projekt.</p></div>
          <TaskAnalytics allTasks={allTasks} showProjectBreakdown={false} />
        </>
      ) : (
        <ZeitenTab project={project} data={data} />
      )}
    </>
  );
}
