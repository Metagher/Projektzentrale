import TaskAnalytics from '../../analytics/TaskAnalytics';
import type { Project, ProjectCache } from '../../../types/entities';

export default function AuswertungTab({ project, data }: { project: Project; data: ProjectCache }) {
  const allTasks = data.tasks.map((t) => ({ ...t, projectId: project.id, projectName: project.name }));

  return (
    <>
      <div className="sub" style={{ color: 'var(--ink-soft)', margin: '0 0 6px' }}>
        Durchlaufzeit und Wochenübersicht ausschließlich für dieses Projekt.
      </div>
      <div className="an-note">
        Basiert nur auf Aufgaben dieses Projekts, die seit Einführung dieser Auswertung angelegt bzw. abgeschlossen
        wurden.
      </div>
      <TaskAnalytics allTasks={allTasks} showProjectBreakdown={false} />
    </>
  );
}
