import { TASK_COLORS } from '../../lib/constants';
import { useDataStore } from '../../store/dataStore';
import type { TaskColor } from '../../types/entities';

export default function TaskColorSelect({ value, onChange }: { value: TaskColor | ''; onChange: (value: TaskColor | '') => void }) {
  const labels = useDataStore((state) => state.taskColorLabels);
  return <div className="task-color-select" role="group" aria-label="Farbmarkierung">
    <button type="button" className={`task-color-choice none${value === '' ? ' active' : ''}`} onClick={() => onChange('')} title="Keine Farbe" aria-label="Keine Farbe">×</button>
    {TASK_COLORS.map((color) => <button type="button" key={color} className={`task-color-choice task-color-${color}${value === color ? ' active' : ''}`} onClick={() => onChange(color)} title={labels[color]} aria-label={labels[color]} />)}
  </div>;
}
