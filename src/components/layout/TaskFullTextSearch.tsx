import { useState, type FormEvent } from 'react';
import { useDataStore, type TaskWithMeta } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { getProjectUiStore } from '../../store/projectUiStore';
import { useModalStore } from '../../store/modalStore';
import { htmlToPlainText } from '../../lib/format';
import type { ProjectCache, Task } from '../../types/entities';

function searchableText(task: Task, projectName: string, data: ProjectCache): string {
  const contact = data.contacts.find((item) => item.id === task.kontaktId);
  const history = (task.verlauf || []).flatMap((entry) => [entry.datum, entry.titel, htmlToPlainText(entry.content)]);
  return [
    projectName, task.nr, task.titel, task.status, task.wartetAuf, contact?.name, contact?.rolle,
    task.teilprojekt, task.afns?.join(' '), htmlToPlainText(task.anforderung), htmlToPlainText(task.aktuellerStand),
    ...history,
  ].filter(Boolean).join(' ').toLocaleLowerCase('de');
}

export default function TaskFullTextSearch() {
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
    const words = query.trim().toLocaleLowerCase('de').split(/\s+/).filter(Boolean);
    if (!words.length || searching) return;
    setSearching(true);
    const matches: TaskWithMeta[] = [];
    for (const project of projects) {
      const data = await ensureProjectData(project.id);
      data.tasks.forEach((task) => {
        const haystack = searchableText(task, project.name, data);
        if (words.every((word) => haystack.includes(word))) matches.push({ ...task, projectId: project.id, projectName: project.name });
      });
    }
    setSearching(false);
    if (matches.length === 1) { openTask(matches[0]); return; }
    setResults(matches);
    if (!matches.length) await alert(`Keine Aufgabe für „${query.trim()}“ gefunden.`);
  }

  return <div className="task-fulltext-search">
    <form onSubmit={search}>
      <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setResults([]); }} placeholder="Aufgaben durchsuchen…" aria-label="Aufgaben im Volltext durchsuchen" />
      <button type="submit" disabled={searching} title="Volltextsuche" aria-label="Volltextsuche starten">{searching ? '…' : '⌕'}</button>
    </form>
    {results.length > 1 && <div className="task-search-results" role="listbox" aria-label={`${results.length} Aufgaben gefunden`}>
      <div className="task-search-results-head">{results.length} Aufgaben gefunden</div>
      {results.map((task) => <button key={`${task.projectId}-${task.id}`} type="button" onClick={() => openTask(task)}><strong>#{task.nr || '—'} · {task.titel}</strong><span>{task.projectName}{task.teilprojekt ? ` · ${task.teilprojekt}` : ''}</span></button>)}
    </div>}
  </div>;
}
