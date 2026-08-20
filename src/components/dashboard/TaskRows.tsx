import { useUiStore } from '../../store/uiStore';
import TaskListRow from './TaskListRow';
import InlineEditTaskRow from './InlineEditTaskRow';
import type { TaskWithMeta } from '../../store/dataStore';

interface Props {
  tasks: TaskWithMeta[];
  isCalendar?: boolean;
  suppressEditor?: boolean;
}

export default function TaskRows({ tasks, isCalendar, suppressEditor }: Props) {
  const dashboardEditingTaskId = useUiStore((s) => s.dashboardEditingTaskId);
  const setDashboardEditingTaskId = useUiStore((s) => s.setDashboardEditingTaskId);
  const setDashboardTab = useUiStore((s) => s.setDashboardTab);
  const editingTask = tasks.find((task) => task.id === dashboardEditingTaskId);

  if (tasks.length === 0) {
    return (
      <div className="empty-state" style={{ padding: 24 }}>
        <h3>Keine Aufgaben in dieser Ansicht</h3>
      </div>
    );
  }

  return (
    <>
      {tasks.map((t) => <TaskListRow key={t.id} task={t} onClick={() => { setDashboardEditingTaskId(t.id); if (isCalendar) setDashboardTab('liste'); }} />)}
      {!suppressEditor && editingTask && <div className="task-edit-overlay" role="dialog" aria-modal="true" aria-label="Aufgabe bearbeiten"><div className="task-edit-dialog"><div className="task-edit-dialog-head"><div><span>Aufgabe bearbeiten</span><strong>ID {editingTask.nr} · {editingTask.projectName}</strong></div></div><InlineEditTaskRow task={editingTask} onSave={() => setDashboardEditingTaskId(null)} onCancel={() => setDashboardEditingTaskId(null)} onDelete={() => setDashboardEditingTaskId(null)} /></div></div>}
    </>
  );
}
