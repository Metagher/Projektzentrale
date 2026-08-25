import { useDataStore } from '../../store/dataStore';
import LinkChipsField from './LinkChipsField';

export default function TaskProjectAssignmentField({ value, onChange }: { value: string[]; onChange: (projectIds: string[]) => void }) {
  const projects = useDataStore((state) => state.projects) || [];

  return (
    <div className="field task-project-assignment">
      <label>Verknüpfte Projekte</label>
      <LinkChipsField
        ids={value}
        items={projects}
        labelFn={(project) => project.kunde && project.kunde !== project.name
          ? `${project.name} · ${project.kunde}`
          : project.name}
        placeholder="— Projekt auswählen —"
        onChange={(projectIds) => {
          if (projectIds.length > 0) onChange(projectIds);
        }}
      />
      <small className="field-help">Die Aufgabe erscheint in jedem ausgewählten Projekt. Änderungen werden überall übernommen.</small>
    </div>
  );
}
