import { fmtDateTime } from '../../lib/format';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import type { Project } from '../../types/entities';

export default function GlobalProjectNotes({ projects }: { projects: Project[] }) {
  const cache = useDataStore((state) => state.cache);
  const notes = projects.flatMap((project) => (cache[project.id]?.notes || [])
    .filter((note) => note.global)
    .map((note) => ({ ...note, projectId: project.id, projectName: project.name })))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  if (!notes.length) return null;

  return <section className="global-project-notes">
    <header><div><span className="eyebrow">Global angeheftet</span><h3>Projektnotizen</h3></div><strong>{notes.length}</strong></header>
    <div>{notes.map((note) => <button type="button" key={`${note.projectId}-${note.id}`} onClick={() => useUiStore.setState({ view: 'project', selectedId: note.projectId, activeTab: 'notizen' })}>
      <span>{note.projectName}</span><strong>{note.titel}</strong><p>{note.inhalt}</p><small>{fmtDateTime(note.updatedAt)}</small>
    </button>)}</div>
  </section>;
}
