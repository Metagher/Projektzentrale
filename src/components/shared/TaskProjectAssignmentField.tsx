import { useDataStore } from '../../store/dataStore';

export default function TaskProjectAssignmentField({ value, onChange }: { value: string[]; onChange: (projectIds: string[]) => void }) {
  const projects = useDataStore((state) => state.projects) || [];
  const selected = new Set(value);

  function toggle(projectId: string) {
    const next = new Set(selected);
    if (next.has(projectId)) next.delete(projectId);
    else next.add(projectId);
    if (next.size > 0) onChange(projects.filter((project) => next.has(project.id)).map((project) => project.id));
  }

  return (
    <div className="field task-project-assignment">
      <label>Verknüpfte Projekte</label>
      <div className="task-project-options">
        {projects.map((project) => (
          <label key={project.id} className={selected.has(project.id) ? 'selected' : ''}>
            <input type="checkbox" checked={selected.has(project.id)} onChange={() => toggle(project.id)} />
            <span>{project.name}</span>
            {project.kunde && <small>{project.kunde}</small>}
          </label>
        ))}
      </div>
      <small className="field-help">Die Aufgabe erscheint in jedem ausgewählten Projekt. Änderungen werden überall übernommen.</small>
    </div>
  );
}
