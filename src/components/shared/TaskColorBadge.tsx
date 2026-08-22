import { useDataStore } from '../../store/dataStore';
import type { TaskColor } from '../../types/entities';

export default function TaskColorBadge({ color, compact = false }: { color?: TaskColor | ''; compact?: boolean }) {
  const labels = useDataStore((state) => state.taskColorLabels);
  if (!color) return null;
  return <span className={`task-color-name${compact ? ' compact' : ''}`} title={`Farbmarkierung: ${labels[color]}`}><i className={`task-color-${color}`} />{labels[color]}</span>;
}
