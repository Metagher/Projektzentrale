import { useState, type DragEvent } from 'react';
import { useDataStore, type TaskWithMeta } from '../../store/dataStore';
import { fmtDate, todayStr } from '../../lib/format';
import { useUiStore } from '../../store/uiStore';
import { useProjectUiStore } from '../../store/projectUiStore';

function addDay(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

export default function DailyPlanner() {
  const data = useDataStore((state) => state.dashboardData);
  const reorder = useDataStore((state) => state.reorderDailyTasks);
  const [day, setDay] = useState<'today' | 'tomorrow'>('today');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const date = day === 'today' ? todayStr() : addDay(todayStr(), 1);
  const allOpen = data ? [...data.tasksWithDate, ...data.waitingTasks] : [];
  const tasks = allOpen
    .filter((task, index, list) => task.faelligAm === date && list.findIndex((item) => item.id === task.id) === index)
    .sort((a, b) => (a.tagesSortierung ?? 999) - (b.tagesSortierung ?? 999) || (a.erstelltAm || '').localeCompare(b.erstelltAm || '') || a.nr - b.nr);

  async function dropOn(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    const next = [...tasks];
    const sourceIndex = next.findIndex((task) => task.id === draggedId);
    const targetIndex = next.findIndex((task) => task.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setDraggedId(null);
    await reorder(date, next);
  }

  function openTask(task: TaskWithMeta) {
    useUiStore.setState({ view: 'project', selectedId: task.projectId, activeTab: 'aufgaben' });
    useProjectUiStore.getState().setEditingTaskId(task.id);
  }

  return (
    <section className="daily-planner">
      <header className="daily-planner-head">
        <div><span className="eyebrow">Tagesplanung</span><h3>{day === 'today' ? 'Heute' : 'Morgen'}</h3><small>{fmtDate(date)} · {tasks.length} Aufgabe{tasks.length === 1 ? '' : 'n'}</small></div>
        <div className="daily-planner-switch"><button className={day === 'today' ? 'active' : ''} onClick={() => setDay('today')}>Heute</button><button className={day === 'tomorrow' ? 'active' : ''} onClick={() => setDay('tomorrow')}>Morgen</button></div>
      </header>
      <div className="daily-planner-list">
        {tasks.length === 0 && <div className="kanban-empty">Keine Aufgaben für diesen Tag.</div>}
        {tasks.map((task, index) => (
          <div className={`daily-planner-task${draggedId === task.id ? ' dragging' : ''}${task.farbe ? ` task-color-border-${task.farbe}` : ''}`} key={task.id} draggable onDragStart={(event) => { setDraggedId(task.id); event.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDraggedId(null)} onDragOver={(event: DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop={(event) => { event.preventDefault(); dropOn(task.id); }}>
            <span className="daily-rank">#{index + 1}</span>
            <button className="daily-task-content" onClick={() => openTask(task)}><strong>{task.titel}</strong><small>{task.projectName}{task.status === 'wartet' ? ` · wartet auf ${task.wartetAuf}` : ''}</small></button>
            <span className="daily-drag" title="Ziehen zum Sortieren">⠿</span>
          </div>
        ))}
      </div>
    </section>
  );
}
