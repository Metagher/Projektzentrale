import { useState, type FormEvent } from 'react';
import { useDataStore, type TaskWithMeta } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { getProjectUiStore } from '../../store/projectUiStore';
import { useModalStore } from '../../store/modalStore';

function normalizeAfn(value: string): string {
  return value.trim().replace(/^AFN[\s:#-]*/i, '').trim().toLocaleUpperCase('de');
}

export default function AfnQuickSearch() {
  const projects = useDataStore((state) => state.projects) || [];
  const ensureProjectData = useDataStore((state) => state.ensureProjectData);
  const alert = useModalStore((state) => state.alert);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TaskWithMeta[]>([]);
  const [searching, setSearching] = useState(false);

  function openTask(task: TaskWithMeta) {
    setResults([]);
    useUiStore.setState({ view: 'project', selectedId: task.projectId, activeTab: 'aufgaben', sidebarOpen: false });
    getProjectUiStore('primary').getState().setEditingTaskId(task.id);
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    const needle = normalizeAfn(query);
    if (!needle || searching) return;
    setSearching(true);
    const matches: TaskWithMeta[] = [];
    for (const project of projects) {
      const data = await ensureProjectData(project.id);
      data.tasks.forEach((task) => {
        if ((task.afns || []).some((afn) => normalizeAfn(afn) === needle)) {
          matches.push({ ...task, projectId: project.id, projectName: project.name });
        }
      });
    }
    setSearching(false);
    if (matches.length === 1) {
      openTask(matches[0]);
      return;
    }
    setResults(matches);
    if (matches.length === 0) await alert(`Keine Aufgabe mit AFN ${query.trim()} gefunden.`);
  }

  return (
    <div className="afn-quick-search">
      <form onSubmit={search}>
        <input
          type="search"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setResults([]); }}
          placeholder="AFN suchen…"
          aria-label="Aufgabe über AFN-Nummer suchen"
        />
        <button type="submit" disabled={searching} title="AFN suchen" aria-label="AFN suchen">{searching ? '…' : '⌕'}</button>
      </form>
      {results.length > 1 && (
        <div className="afn-search-results" role="listbox" aria-label={`${results.length} Aufgaben gefunden`}>
          <div className="afn-search-results-head">{results.length} Aufgaben gefunden</div>
          {results.map((task) => (
            <button key={`${task.projectId}-${task.id}`} type="button" onClick={() => openTask(task)}>
              <strong>#{task.nr || '—'} · {task.titel}</strong>
              <span>{task.projectName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
