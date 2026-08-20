import { TASK_STATUS } from '../../lib/constants';
import { slug } from '../../lib/format';
import type { TaskStatus } from '../../types/entities';

export default function TaskStatusButtons({ value, onChange }: { value: TaskStatus; onChange: (value: TaskStatus) => void }) {
  return <div className="task-status-buttons" role="group" aria-label="Aufgabenstatus">{TASK_STATUS.map((status) => <button type="button" key={status} className={`${slug(status)}${value === status ? ' active' : ''}`} onClick={() => onChange(status)}>{status}</button>)}</div>;
}
