import { useState, type DragEvent } from 'react';
import { useDataStore, type TaskWithMeta } from '../../store/dataStore';
import { fmtDate, todayStr } from '../../lib/format';
import { useUiStore } from '../../store/uiStore';
import { getProjectUiStore } from '../../store/projectUiStore';
import { localDateKey, nextWorkday } from '../../lib/workdays';
import { hasTaskDrag, readTaskDrag, writeTaskDrag } from '../../lib/taskDrag';
import TaskColorBadge from '../shared/TaskColorBadge';

export default function DailyPlanner() {
  const data = useDataStore((state) => state.dashboardData);
  const reorder = useDataStore((state) => state.reorderDailyTasks);
  const moveTaskToDailyDate = useDataStore((state) => state.moveTaskToDailyDate);
  const workdayOverrides = useDataStore((state) => state.workdayOverrides);
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<{ targetId: string; edge: 'before' | 'after' } | null>(null);
  const [externalTaskOver, setExternalTaskOver] = useState(false);
  const nextDate = nextWorkday(new Date(`${todayStr()}T12:00:00`), workdayOverrides);
  const date = day === 'today' ? todayStr() : localDateKey(nextDate);
  const nextDayLabel = new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(nextDate);
  const allOpen = data?.tasksWithDate || [];
  const tasks = allOpen
    .filter((task, index, list) => task.faelligAm === date && list.findIndex((item) => item.id === task.id) === index)
    .sort((a, b) => (a.tagesSortierung ?? 999) - (b.tagesSortierung ?? 999) || (a.erstelltAm || '').localeCompare(b.erstelltAm || '') || a.nr - b.nr);
  const rankedTasks = tasks.filter((task) => (task.tagesSortierung ?? 999) < 999);

  async function dropOn(targetId: string, edge: 'before' | 'after') {
    if (!draggedId || draggedId === targetId) return;
    const moved = tasks.find((task) => task.id === draggedId);
    if (!moved) return;
    const next = rankedTasks.filter((task) => task.id !== draggedId);
    const targetIndex = next.findIndex((task) => task.id === targetId);
    const insertionIndex = targetIndex < 0 ? next.length : targetIndex + (edge === 'after' ? 1 : 0);
    next.splice(insertionIndex, 0, moved);
    setDraggedId(null);
    setDropPosition(null);
    await reorder(date, next);
  }

  async function removeRank(taskId: string) {
    await reorder(date, rankedTasks.filter((task) => task.id !== taskId));
  }

  async function assignRank(task: TaskWithMeta) {
    await reorder(date, [...rankedTasks, task]);
  }

  async function dropOnDay(targetDay: 'today' | 'tomorrow', event?: DragEvent) {
    const external = event ? readTaskDrag(event.dataTransfer) : null;
    const targetDate = targetDay === 'today' ? todayStr() : localDateKey(nextDate);
    if (external && !draggedId) {
      setExternalTaskOver(false);
      await moveTaskToDailyDate(external.projectId, external.taskId, targetDate);
      setDay(targetDay);
      return;
    }
    if (!draggedId) return;
    const task = tasks.find((item) => item.id === draggedId);
    setDraggedId(null);
    if (!task || task.faelligAm === targetDate) return;
    await moveTaskToDailyDate(task.projectId, task.id, targetDate);
    setDay(targetDay);
  }

  function allowDayDrop(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (!draggedId && hasTaskDrag(event.dataTransfer)) setExternalTaskOver(true);
  }

  function openTask(task: TaskWithMeta) {
    useUiStore.setState({ view: 'project', selectedId: task.projectId, activeTab: 'aufgaben' });
    getProjectUiStore('primary').getState().setEditingTaskId(task.id);
  }

  return (
    <section className="daily-planner">
      <header className="daily-planner-head">
        <div><span className="eyebrow">Tagesplanung</span><h3>{day === 'today' ? 'Heute' : nextDayLabel}</h3><small>{fmtDate(date)} · {tasks.length} Aufgabe{tasks.length === 1 ? '' : 'n'}</small></div>
        <div className={`daily-planner-switch${draggedId || externalTaskOver ? ' accepting-drop' : ''}`} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setExternalTaskOver(false); }}>
          <button className={day === 'today' ? 'active' : ''} onClick={() => setDay('today')} onDragOver={allowDayDrop} onDrop={(event) => { event.preventDefault(); dropOnDay('today', event); }}>Heute</button>
          <button className={day === 'tomorrow' ? 'active' : ''} onClick={() => setDay('tomorrow')} onDragOver={allowDayDrop} onDrop={(event) => { event.preventDefault(); dropOnDay('tomorrow', event); }} title={`Nächster Arbeitstag: ${nextDayLabel}`}>Nächster Arbeitstag</button>
        </div>
      </header>
      <div className="daily-planner-list">
        {tasks.length === 0 && <div className="kanban-empty">Keine Aufgaben für diesen Tag.</div>}
        {tasks.map((task) => {
          const rank = rankedTasks.findIndex((item) => item.id === task.id) + 1;
          return (
          <div
            className={`daily-planner-task${draggedId === task.id ? ' dragging' : ''}${dropPosition?.targetId === task.id ? ` drop-${dropPosition.edge}` : ''}${task.farbe ? ` task-color-border-${task.farbe}` : ''}`}
            key={task.id}
            draggable
            onDragStart={(event) => { setDraggedId(task.id); setDropPosition(null); event.dataTransfer.effectAllowed = 'move'; writeTaskDrag(event.dataTransfer, { projectId: task.projectId, taskId: task.id }); }}
            onDragEnd={() => { setDraggedId(null); setDropPosition(null); setExternalTaskOver(false); }}
            onDragOver={(event: DragEvent) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              if (!draggedId || draggedId === task.id) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              const edge = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
              setDropPosition((current) => current?.targetId === task.id && current.edge === edge ? current : { targetId: task.id, edge });
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (!draggedId || draggedId === task.id) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              const edge = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
              dropOn(task.id, edge);
            }}
          >
            <button className={`daily-rank${rank ? '' : ' unranked'}`} type="button" onClick={() => { if (rank) removeRank(task.id); else assignRank(task); }} title={rank ? 'Tagesrang entfernen und auf #X setzen' : `Als #${rankedTasks.length + 1} einordnen`}>#{rank || 'X'}</button>
            <button className="daily-task-content" onClick={() => openTask(task)}><strong>{task.titel}</strong>{task.farbe && <TaskColorBadge color={task.farbe} compact />}<small>{task.projectName}{task.status === 'wartet' ? ` · wartet auf ${task.wartetAuf}` : ''}</small></button>
            <span className="daily-drag" title="Ziehen zum Sortieren oder auf einen anderen Arbeitstag">⠿</span>
          </div>
          );
        })}
      </div>
    </section>
  );
}
