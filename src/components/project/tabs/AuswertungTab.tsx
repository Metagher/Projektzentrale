import TaskAnalytics from '../../analytics/TaskAnalytics';
import type { Project, ProjectCache } from '../../../types/entities';
import ProjectOperationalOverview from '../../analytics/ProjectOperationalOverview';

export default function AuswertungTab({ project, data }: { project: Project; data: ProjectCache }) {
  const allTasks = data.tasks.map((t) => ({ ...t, projectId: project.id, projectName: project.name }));

  return (
    <>
      <header className="project-analysis-header"><div className="eyebrow">Einzelprojekt</div><h3>Projektauswertung · {project.name}</h3><p>Aktueller Arbeitsbestand, Risiken, Datenqualität und Entwicklung dieses Projekts.</p></header>
      <ProjectOperationalOverview data={data} />
      <div className="analytics-section-intro"><div className="analytics-scope-label">Projektentwicklung</div><h3>Durchlaufzeit und Leistung</h3><p>Historische Entwicklung ausschließlich für dieses Projekt.</p></div>
      <TaskAnalytics allTasks={allTasks} showProjectBreakdown={false} />
    </>
  );
}
