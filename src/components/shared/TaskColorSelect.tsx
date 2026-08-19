import { TASK_COLORS, TASK_COLOR_LABELS } from '../../lib/constants';
import type { TaskColor } from '../../types/entities';

export default function TaskColorSelect({ value, onChange }: { value: TaskColor | ''; onChange: (value: TaskColor | '') => void }) {
  return (
    <label className="task-color-select">
      <span className={`task-color-swatch${value ? ` task-color-${value}` : ' task-color-none'}`} />
      <select value={value} onChange={(event) => onChange(event.target.value as TaskColor | '')} aria-label="Farbmarkierung">
        <option value="">Keine Farbe</option>
        {TASK_COLORS.map((color) => <option key={color} value={color}>{TASK_COLOR_LABELS[color]}</option>)}
      </select>
    </label>
  );
}
