import { TASK_KATEGORIEN } from '../../lib/constants';
import type { TaskKategorie } from '../../types/entities';

interface Props {
  value: TaskKategorie;
  onChange: (value: TaskKategorie) => void;
}

export default function TaskCategorySelect({ value, onChange }: Props) {
  return (
    <div className="task-documentation-field">
      <label>Kategorie</label>
      <div className="task-documentation-options" role="radiogroup" aria-label="Kategorie der Aufgabe">
        {TASK_KATEGORIEN.map((kategorie) => (
          <button
            key={kategorie}
            type="button"
            className={value === kategorie ? 'active' : ''}
            role="radio"
            aria-checked={value === kategorie}
            onClick={() => onChange(kategorie)}
          >
            {kategorie}
          </button>
        ))}
      </div>
    </div>
  );
}
