import { useUiStore } from '../../store/uiStore';
import TaskListRow from './TaskListRow';
import InlineEditTaskRow from './InlineEditTaskRow';
import type { TaskWithMeta } from '../../store/dataStore';

interface Props {
  tasks: TaskWithMeta[];
  isCalendar?: boolean;
}

export default function TaskRows({ tasks, isCalendar }: Props) {
  const dashboardEditingTaskId = useUiStore((s) => s.dashboardEditingTaskId);
  const setDashboardEditingTaskId = useUiStore((s) => s.setDashboardEditingTaskId);
  const setDashboardTab = useUiStore((s) => s.setDashboardTab);

  if (tasks.length === 0) {
    return (
      <div className="empty-state" style={{ padding: 24 }}>
        <h3>Keine Aufgaben in dieser Ansicht</h3>
      </div>
    );
  }

  return (
    <>
      {tasks.map((t) =>
        t.id === dashboardEditingTaskId ? (
          <InlineEditTaskRow
            key={t.id}
            task={t}
            onSave={() => setDashboardEditingTaskId(null)}
            onCancel={() => setDashboardEditingTaskId(null)}
            onDelete={() => setDashboardEditingTaskId(null)}
          />
        ) : (
          <TaskListRow
            key={t.id}
            task={t}
            onClick={() => {
              setDashboardEditingTaskId(t.id);
              if (isCalendar) setDashboardTab('liste');
            }}
          />
        ),
      )}
    </>
  );
}
