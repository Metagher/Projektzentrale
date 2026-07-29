import { prioAbbr, prioLabel } from '../../lib/constants';
import { fmtDate, slug, todayStr } from '../../lib/format';
import type { TaskWithMeta } from '../../store/dataStore';

interface Props {
  task: TaskWithMeta;
  onClick: () => void;
}

export default function TaskListRow({ task, onClick }: Props) {
  const overdue = !!task.faelligAm && task.faelligAm < todayStr();
  const prio = task.prioritaet || 'should';

  return (
    <div className="agg-row" style={{ cursor: 'pointer' }} onClick={onClick}>
      <span className={`prio-badge prio-${slug(prio)}`} title={prioLabel(prio)}>
        {prioAbbr(prio)}
      </span>
      <span className="agg-project">{task.projectName}</span>
      <span className="agg-title">
        <span className="task-nr">{task.nr || '—'}</span>
        {task.titel}
        {task.doku && <span className="badge doku" style={{ marginLeft: 4 }}>Doku</span>}
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
