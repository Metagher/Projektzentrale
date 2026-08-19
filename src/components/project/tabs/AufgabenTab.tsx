import { useState, type DragEvent } from 'react';
import { useProjectUiStore } from '../../../store/projectUiStore';
import { useDataStore } from '../../../store/dataStore';
import { useModalStore } from '../../../store/modalStore';
import { applyProjectTaskFilters } from '../../../lib/filters';
import ProjectNewTaskForm from '../ProjectNewTaskForm';
import ProjectTaskFilterBar from '../ProjectTaskFilterBar';
import ProjectTaskRow from '../ProjectTaskRow';
import ProjectTaskEditRow from '../ProjectTaskEditRow';
import AiSummaryCard from '../AiSummaryCard';
import type { Project, ProjectCache, Task, TaskStatus } from '../../../types/entities';
import { compareTaskColors, compareWaitingPerson } from '../../../lib/taskColors';

type BoardColumn = 'offen' | 'wartet' | 'erledigt';

const COLUMNS: { key: BoardColumn; label: string; hint: string }[] = [
  { key: 'offen', label: 'Offen', hint: 'Offen und in Arbeit' },
  { key: 'wartet', label: 'Wartet auf andere', hint: 'Externe Rückmeldung ausstehend' },
  { key: 'erledigt', label: 'Erledigt', hint: 'Abgeschlossene Aufgaben' },
];

function columnForStatus(status: TaskStatus): BoardColumn {
  if (status === 'wartet') return 'wartet';
  if (status === 'erledigt') return 'erledigt';
  return 'offen';
}

export default function AufgabenTab({ project, data }: { project: Project; data: ProjectCache }) {
  const deleteTask = useDataStore((state) => state.deleteTask);
  const saveTask = useDataStore((state) => state.saveTask);
  const taskColorOrder = useDataStore((state) => state.taskColorOrder);
  const waitingOptions = useDataStore((state) => state.waitingOptions);
  const syncCommLinksForTask = useDataStore((state) => state.syncCommLinksForTask);
  const confirm = useModalStore((state) => state.confirm);
  const choice = useModalStore((state) => state.choice);
  const alert = useModalStore((state) => state.alert);
  const { showNewTaskForm, setShowNewTaskForm, showTaskFilters, toggleShowTaskFilters, showCompletedKanban, toggleShowCompletedKanban, projectTaskFilter, editingTaskId } = useProjectUiStore();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<BoardColumn | null>(null);
  const [dragOverPerson, setDragOverPerson] = useState<string | null>(null);

  const filteredTasks = applyProjectTaskFilters(data.tasks, projectTaskFilter);
  const tasksByColumn = COLUMNS.reduce<Record<BoardColumn, Task[]>>((groups, column) => {
    groups[column.key] = filteredTasks
      .filter((task) => columnForStatus(task.status) === column.key)
      .sort((a, b) => (column.key === 'wartet' ? compareWaitingPerson(a, b) : 0) || compareTaskColors(a, b, taskColorOrder) || (a.faelligAm || '9999').localeCompare(b.faelligAm || '9999'));
    return groups;
  }, { offen: [], wartet: [], erledigt: [] });
  const editingTask = editingTaskId ? data.tasks.find((task) => task.id === editingTaskId) : undefined;
  const filterActive = !!(projectTaskFilter.prioritaet || projectTaskFilter.kontaktId || projectTaskFilter.von || projectTaskFilter.bis);
  const visibleColumns = showCompletedKanban ? COLUMNS : COLUMNS.filter((column) => column.key !== 'erledigt');
  const waitingGroups = tasksByColumn.wartet.reduce<{ key: string; label: string; person: string; tasks: Task[] }[]>((groups, task) => {
    const person = (task.wartetAuf || '').trim();
    const label = person || 'Nicht angegeben';
    const key = label.toLocaleLowerCase('de');
    const existing = groups.find((group) => group.key === key);
    if (existing) existing.tasks.push(task);
    else groups.push({ key, label, person, tasks: [task] });
    return groups;
  }, []);

  async function handleDelete(taskId: string) {
    if (!(await confirm('Diese Aufgabe löschen?'))) return;
    const task = data.tasks.find((item) => item.id === taskId);
    await deleteTask(project.id, taskId);
    if (task) await syncCommLinksForTask(project.id, taskId, task.commIds || [], []);
  }

  async function moveTask(targetColumn: BoardColumn, targetPerson?: string) {
    const task = data.tasks.find((item) => item.id === draggedTaskId);
    setDraggedTaskId(null);
    setDragOverColumn(null);
    setDragOverPerson(null);
    if (!task) return;
    const sameColumn = columnForStatus(task.status) === targetColumn;
    if (sameColumn && (targetColumn !== 'wartet' || !targetPerson || task.wartetAuf.trim() === targetPerson.trim())) return;

    const nextStatus: TaskStatus = targetColumn === 'offen' ? 'offen' : targetColumn;
    let wartetAuf = nextStatus === 'wartet' ? task.wartetAuf : '';
    if (nextStatus === 'wartet' && targetPerson) {
      wartetAuf = targetPerson;
    } else if (nextStatus === 'wartet') {
      if (waitingOptions.length === 0) { await alert('Bitte zuerst unter Einstellungen die Grunddaten für „Wartet auf“ anlegen.'); return; }
      const person = await choice({
        title: 'Auf wen wird gewartet?',
        message: `Die Aufgabe „${task.titel}“ wird in „Wartet auf andere“ verschoben.`,
        label: 'Person oder Stelle',
        options: waitingOptions,
        initialValue: task.wartetAuf,
        confirmLabel: 'Aufgabe verschieben',
      });
      if (!person) return;
      wartetAuf = person;
    }
    await saveTask(project.id, {
      ...task,
      status: nextStatus,
      wartetAuf,
      abgeschlossenAm: nextStatus === 'erledigt' ? (task.abgeschlossenAm || new Date().toISOString()) : null,
    });
  }

  function allowDrop(event: DragEvent, column: BoardColumn) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverColumn(column);
  }

  function renderTask(task: Task) {
    return (
      <div
        className={`kanban-task${task.farbe ? ` marked task-color-border-${task.farbe}` : ''}${draggedTaskId === task.id ? ' dragging' : ''}`}
        key={task.id}
        draggable
        onDragStart={(event) => { setDraggedTaskId(task.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', task.id); }}
        onDragEnd={() => { setDraggedTaskId(null); setDragOverColumn(null); setDragOverPerson(null); }}
      >
        <ProjectTaskRow task={task} contact={data.contacts.find((contact) => contact.id === task.kontaktId)} data={data} onDelete={() => handleDelete(task.id)} />
      </div>
    );
  }

  return (
    <>
      <AiSummaryCard project={project} data={data} />
      <div className="task-board-toolbar">
        {showNewTaskForm ? <ProjectNewTaskForm projectId={project.id} data={data} /> : <button className="btn" onClick={() => setShowNewTaskForm(true)}>＋ Neue Aufgabe</button>}
        {!showNewTaskForm && <div className="task-board-toolbar-actions">
          <button className={`btn secondary${showCompletedKanban ? ' active' : ''}`} onClick={toggleShowCompletedKanban}>
            {showCompletedKanban ? 'Erledigte ausblenden' : `Erledigte einblenden (${tasksByColumn.erledigt.length})`}
          </button>
          <button className="btn secondary" onClick={toggleShowTaskFilters}>{showTaskFilters ? 'Filter ausblenden' : 'Filter'}</button>
        </div>}
      </div>
      {showTaskFilters && <ProjectTaskFilterBar contacts={data.contacts} />}
      {editingTask && (
        <div className="kanban-edit-panel">
          <div className="section-title">Aufgabe bearbeiten</div>
          <ProjectTaskEditRow task={editingTask} projectId={project.id} data={data} contacts={data.contacts} />
        </div>
      )}
      <div className={`kanban-board${showCompletedKanban ? '' : ' without-completed'}`}>
        {visibleColumns.map((column) => (
          <section
            className={`kanban-column${dragOverColumn === column.key ? ' drag-over' : ''}`}
            key={column.key}
            onDragOver={(event) => allowDrop(event, column.key)}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOverColumn(null); }}
            onDrop={(event) => { event.preventDefault(); moveTask(column.key); }}
          >
            <header className="kanban-column-head">
              <div><h3>{column.label}</h3><span>{column.hint}</span></div>
              <strong>{tasksByColumn[column.key].length}</strong>
            </header>
            <div className="kanban-column-body">
              {tasksByColumn[column.key].length === 0 && <div className="kanban-empty">{filterActive ? 'Keine Treffer' : 'Keine Aufgaben'}</div>}
              {column.key === 'wartet' && waitingGroups.length > 0 && <div className="waiting-summary" aria-label="Zusammenfassung nach Person">
                {waitingGroups.map((group) => <span key={group.key}><strong>{group.label}</strong><b>{group.tasks.length}</b></span>)}
              </div>}
              {column.key === 'wartet' ? waitingGroups.map((group) => (
                <section
                  className={`waiting-person-group${dragOverPerson === group.key ? ' drag-over' : ''}`}
                  key={group.key}
                  onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move'; setDragOverColumn(null); setDragOverPerson(group.key); }}
                  onDragLeave={(event) => { event.stopPropagation(); if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOverPerson(null); }}
                  onDrop={(event) => { event.preventDefault(); event.stopPropagation(); moveTask('wartet', group.person || undefined); }}
                >
                  <header className="waiting-person-head"><span>Wartet auf</span><strong>{group.label}</strong><span className="waiting-person-count">{group.tasks.length}</span></header>
                  <div className="waiting-person-tasks">{group.tasks.map(renderTask)}</div>
                </section>
              )) : tasksByColumn[column.key].map(renderTask)}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
