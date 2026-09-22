import { useMemo } from 'react';
import { useDataStore, type TaskWithMeta } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { getProjectUiStore } from '../../store/projectUiStore';
import { normalizeAfn } from '../../lib/afn';

interface AfnGroup {
  afn: string;
  tasks: TaskWithMeta[];
}

export default function AfnOverviewTab({ allTasks }: { allTasks: TaskWithMeta[] }) {
  const markedAfns = useDataStore((s) => s.markedAfns);
  const toggleMarkedAfn = useDataStore((s) => s.toggleMarkedAfn);

  const groups = useMemo(() => {
    const map = new Map<string, TaskWithMeta[]>();
    allTasks.forEach((task) => {
      (task.afns || []).forEach((raw) => {
        const afn = normalizeAfn(raw);
        if (!afn) return;
        const list = map.get(afn);
        if (list) list.push(task);
        else map.set(afn, [task]);
      });
    });
    return Array.from(map.entries())
      .map(([afn, tasks]): AfnGroup => ({ afn, tasks }))
      .sort((a, b) => a.afn.localeCompare(b.afn, 'de', { numeric: true }));
  }, [allTasks]);

  function openTask(task: TaskWithMeta) {
    useUiStore.setState({ view: 'project', selectedId: task.projectId, activeTab: 'aufgaben', sidebarOpen: false });
    getProjectUiStore('primary').getState().setEditingTaskId(task.id);
  }

  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <h3>Keine verknüpften AFNs</h3>
        <div>Sobald einer Aufgabe eine AFN-Nummer zugeordnet wird, erscheint sie hier.</div>
      </div>
    );
  }

  return (
    <>
      <div className="sub" style={{ color: 'var(--ink-soft)', margin: '4px 0 6px' }}>
        Alle über Aufgaben verknüpften AFN-Nummern. Markierte AFNs erscheinen mit ihrer Aufgabe als ToDo auf dem Dashboard.
      </div>
      <table className="an-table">
        <tbody>
          <tr>
            <th>AFN</th>
            <th>Projekt</th>
            <th>Aufgabe</th>
            <th>Markiert</th>
          </tr>
          {groups.map((group) =>
            group.tasks.map((task, index) => (
              <tr key={`${group.afn}-${task.id}`}>
                {index === 0 && <td rowSpan={group.tasks.length}>AFN {group.afn}</td>}
                <td>{task.projectName}</td>
                <td><button type="button" className="link-btn" onClick={() => openTask(task)}>#{task.nr || '—'} · {task.titel}</button></td>
                {index === 0 && (
                  <td rowSpan={group.tasks.length}>
                    <label className="doku-check-inline">
                      <input type="checkbox" checked={markedAfns.includes(group.afn)} onChange={() => toggleMarkedAfn(group.afn)} /> Markieren
                    </label>
                  </td>
                )}
              </tr>
            )),
          )}
        </tbody>
      </table>
    </>
  );
}
