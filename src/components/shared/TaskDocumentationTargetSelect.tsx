import type { TaskDocumentationTarget } from '../../types/entities';

interface Props {
  value: TaskDocumentationTarget;
  onChange: (value: TaskDocumentationTarget) => void;
}

export default function TaskDocumentationTargetSelect({ value, onChange }: Props) {
  return (
    <div className="task-documentation-field">
      <label>Für Dokumentation vormerken</label>
      <div className="task-documentation-options" role="radiogroup" aria-label="Ziel der Dokumentationsvormerkung">
        <button type="button" className={value === '' ? 'active' : ''} role="radio" aria-checked={value === ''} onClick={() => onChange('')}>Keine</button>
        <button type="button" className={value === 'project' ? 'active' : ''} role="radio" aria-checked={value === 'project'} onClick={() => onChange('project')}>Projektdoku</button>
        <button type="button" className={value === 'global' ? 'active' : ''} role="radio" aria-checked={value === 'global'} onClick={() => onChange('global')}>Globale Doku</button>
      </div>
    </div>
  );
}
