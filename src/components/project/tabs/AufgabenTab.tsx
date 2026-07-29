import { useProjectUiStore, type TaskFilterTab } from '../../../store/projectUiStore';
import { useDataStore } from '../../../store/dataStore';
import { useModalStore } from '../../../store/modalStore';
import { applyProjectTaskFilters } from '../../../lib/filters';
import ProjectNewTaskForm from '../ProjectNewTaskForm';
import ProjectTaskFilterBar from '../ProjectTaskFilterBar';
import ProjectTaskRow from '../ProjectTaskRow';
import ProjectTaskEditRow from '../ProjectTaskEditRow';
import type { Project, ProjectCache, TaskStatus } from '../../../types/entities';

const STATUS_ORDER: Record<TaskStatus, number> = { offen: 0, 'in Arbeit': 1, wartet: 2, erledigt: 3 };

const TABS: { key: TaskFilterTab; label: (n: number) => string }[] = [
  { key: 'offen', label: (n) => `Offen (${n})` },
  { key: 'wartet', label: (n) => `Wartet auf andere (${n})` },
  { key: 'erledigt', label: (n) => `Erledigt (${n})` },
];

const EMPTY_LABELS: Record<TaskFilterTab, string> = {
  erledigt: 'Noch keine erledigten Aufgaben',
  wartet: 'Keine Aufgaben, bei denen du auf jemanden wartest',
  offen: 'Keine offenen Aufgaben',
};

export default function AufgabenTab({ project, data }: { project: Project; data: ProjectCache }) {
  const deleteTask = useDataStore((s) => s.deleteTask);
  const syncCommLinksForTask = useDataStore((s) => s.syncCommLinksForTask);
  const confirm = useModalStore((s) => s.confirm);
  const {
    showNewTaskForm,
    setShowNewTaskForm,
    showTaskFilters,
    toggleShowTaskFilters,
    taskFilterTab,
    setTaskFilterTab,
    projectTaskFilter,
    editingTaskId,
  } = useProjectUiStore();

  const openTasks = data.tasks.filter((t) => t.status === 'offen' || t.status === 'in Arbeit');
  const waitingTasks = data.tasks.filter((t) => t.status === 'wartet');
  const doneTasks = data.tasks.filter((t) => t.status === 'erledigt');
  const counts: Record<TaskFilterTab, number> = { offen: openTasks.length, wartet: waitingTasks.length, erledigt: doneTasks.length };

  const listSource = taskFilterTab === 'erledigt' ? doneTasks : taskFilterTab === 'wartet' ? waitingTasks : openTasks;
  const listForTab = applyProjectTaskFilters(listSource, projectTaskFilter);
  const sorted = listForTab.slice().sort((a, b) => {
    const so = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
    if (so !== 0) return so;
    return (a.faelligAm || '9999').localeCompare(b.faelligAm || '9999');
  });
  const filterActive = !!(projectTaskFilter.prioritaet || projectTaskFilter.kontaktId || projectTaskFilter.von || projectTaskFilter.bis);

  async function handleDelete(taskId: string) {
    const sure = await confirm('Diese Aufgabe löschen?');
    if (!sure) return;
    const task = data.tasks.find((t) => t.id === taskId);
    await deleteTask(project.id, taskId);
    if (task) await syncCommLinksForTask(project.id, taskId, task.commIds || [], []);
  }

  return (
    <>
      {showNewTaskForm ? (
        <ProjectNewTaskForm projectId={project.id} data={data} />
      ) : (
        <button className="btn secondary" style={{ marginBottom: 14 }} onClick={() => setShowNewTaskForm(true)}>
          + Neue Aufgabe
        </button>
      )}
      <div className="tabs" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab-btn${taskFilterTab === t.key ? ' active' : ''}`}
              onClick={() => setTaskFilterTab(t.key)}
            >
              {t.label(counts[t.key])}
            </button>
          ))}
        </div>
        <button className="icon-btn" style={{ alignSelf: 'center' }} onClick={toggleShowTaskFilters}>
          {showTaskFilters ? 'Filter ausblenden' : '🔍 Filter'}
        </button>
      </div>
      {showTaskFilters && <ProjectTaskFilterBar contacts={data.contacts} />}
      {sorted.length === 0 ? (
        <div className="empty-state">
          <h3>
            {EMPTY_LABELS[taskFilterTab]}
            {filterActive ? ' (mit aktuellem Filter)' : ''}
          </h3>
        </div>
      ) : (
        sorted.map((t) =>
          t.id === editingTaskId ? (
            <ProjectTaskEditRow key={t.id} task={t} projectId={project.id} data={data} contacts={data.contacts} />
          ) : (
            <ProjectTaskRow
              key={t.id}
              task={t}
              contact={data.contacts.find((c) => c.id === t.kontaktId)}
              data={data}
              onDelete={() => handleDelete(t.id)}
            />
          ),
        )
      )}
    </>
  );
}
