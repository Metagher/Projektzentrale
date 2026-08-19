import { fmtDate, todayStr } from '../../lib/format';
import { useDataStore, type TaskWithMeta } from '../../store/dataStore';
import { toExternalHref } from '../../lib/externalLinks';

interface Props {
  task: TaskWithMeta;
  onClick: () => void;
}

export default function TaskListRow({ task, onClick }: Props) {
  const colorLabels = useDataStore((state) => state.taskColorLabels);
  const overdue = !!task.faelligAm && task.faelligAm < todayStr();
  const externalHref = toExternalHref(task.fremdverknuepfung);

  return (
    <div className={`agg-row${task.farbe ? ` task-color-border-${task.farbe}` : ''}`} style={{ cursor: 'pointer' }} onClick={onClick}>
      {task.farbe && <span className={`task-color-swatch task-color-${task.farbe}`} title={colorLabels[task.farbe]} />}
      <span className="agg-project">{task.projectName}</span>
      <span className="agg-title">
        <span className="task-nr">{task.nr || '—'}</span>
        {task.titel}
        {task.doku && <span className="badge doku" style={{ marginLeft: 4 }}>Doku</span>}
        {externalHref && <a className="task-external-link-inline" href={externalHref} target="_blank" rel="noreferrer" title="Fremdverknüpfung öffnen" onClick={(event) => event.stopPropagation()}>↗</a>}
        {task.status === 'wartet' && (
          <span className="badge wartet" style={{ marginLeft: 6 }}>
            wartet auf {task.wartetAuf || 'jemanden'}
          </span>
        )}
      </span>
      <span className="agg-date" style={overdue ? { color: 'var(--rust)', fontWeight: 600 } : undefined}>
        {overdue ? '⚠ ' : ''}
        {fmtDate(task.faelligAm)}
      </span>
    </div>
  );
}
