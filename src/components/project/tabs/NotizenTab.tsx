import { useState } from 'react';
import { fmtDateTime, uid } from '../../../lib/format';
import { useDataStore } from '../../../store/dataStore';
import { useModalStore } from '../../../store/modalStore';
import type { Project, ProjectNote } from '../../../types/entities';

export default function NotizenTab({ project }: { project: Project }) {
  const notes = useDataStore((state) => state.cache[project.id]?.notes) || [];
  const saveProjectNote = useDataStore((state) => state.saveProjectNote);
  const deleteProjectNote = useDataStore((state) => state.deleteProjectNote);
  const confirm = useModalStore((state) => state.confirm);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const sorted = notes.slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));

  async function remove(note: ProjectNote) {
    if (await confirm(`Notiz „${note.titel}“ löschen?`)) await deleteProjectNote(project.id, note.id);
  }

  async function toggle(note: ProjectNote, field: 'global' | 'pinned') {
    await saveProjectNote(project.id, { ...note, [field]: !note[field], updatedAt: new Date().toISOString() });
  }

  return (
    <section className="project-notes-page">
      <div className="module-section-head">
        <div><span className="eyebrow">Projektgedanken</span><h3>Notizen</h3><p>Freie Notizen zum Projekt. Globale Notizen erscheinen im Dashboard, angeheftete Notizen zusätzlich bei der Projektinfo.</p></div>
        {!creating && <button type="button" className="btn small" onClick={() => setCreating(true)}>+ Neue Notiz</button>}
      </div>
      {creating && <ProjectNoteEditor projectId={project.id} onClose={() => setCreating(false)} />}
      {sorted.length === 0 && !creating ? <div className="empty-state"><h3>Noch keine Notizen</h3><div>Lege eine freie Notiz für dieses Projekt an.</div></div> : <div className="project-note-grid">
        {sorted.map((note) => editingId === note.id
          ? <ProjectNoteEditor key={note.id} projectId={project.id} note={note} onClose={() => setEditingId(null)} />
          : <article className={`project-note-card${note.pinned ? ' pinned' : ''}`} key={note.id}>
              <header><div><div className="project-note-flags">{note.global && <span>Global</span>}{note.pinned && <span>Angeheftet</span>}</div><h4>{note.titel}</h4></div><small>{fmtDateTime(note.updatedAt)}</small></header>
              {note.inhalt && <p>{note.inhalt}</p>}
              <div className="project-note-actions">
                <button type="button" className={`note-toggle${note.global ? ' active' : ''}`} aria-pressed={note.global} onClick={() => toggle(note, 'global')}>Global</button>
                <button type="button" className={`note-toggle${note.pinned ? ' active' : ''}`} aria-pressed={note.pinned} onClick={() => toggle(note, 'pinned')}>Anheften</button>
                <button type="button" className="icon-btn edit" onClick={() => setEditingId(note.id)}>Bearbeiten</button>
                <button type="button" className="icon-btn" onClick={() => remove(note)}>Löschen</button>
              </div>
            </article>)}
      </div>}
    </section>
  );
}

function ProjectNoteEditor({ projectId, note, onClose }: { projectId: string; note?: ProjectNote; onClose: () => void }) {
  const saveProjectNote = useDataStore((state) => state.saveProjectNote);
  const [titel, setTitel] = useState(note?.titel || '');
  const [inhalt, setInhalt] = useState(note?.inhalt || '');
  const [global, setGlobal] = useState(note?.global || false);
  const [pinned, setPinned] = useState(note?.pinned || false);
  const valid = !!titel.trim() && !!inhalt.trim();

  async function save() {
    if (!valid) return;
    const now = new Date().toISOString();
    await saveProjectNote(projectId, { id: note?.id || uid(), titel: titel.trim(), inhalt: inhalt.trim(), global, pinned, createdAt: note?.createdAt || now, updatedAt: now });
    onClose();
  }

  return <article className="project-note-editor">
    <div className="field"><label>Titel</label><input value={titel} onChange={(event) => setTitel(event.target.value)} placeholder="Kurzer Titel der Notiz" autoFocus /></div>
    <div className="field"><label>Notiz</label><textarea value={inhalt} onChange={(event) => setInhalt(event.target.value)} placeholder="Gedanken, Hinweise oder Merkpunkte frei eingeben…" rows={6} /></div>
    <div className="project-note-options"><label><input type="checkbox" checked={global} onChange={(event) => setGlobal(event.target.checked)} /> Global im Dashboard anzeigen</label><label><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} /> Bei der Projektinfo anheften</label></div>
    <div className="btn-row"><button type="button" className="btn small" disabled={!valid} onClick={save}>{note ? 'Änderungen speichern' : 'Notiz speichern'}</button><button type="button" className="btn secondary small" onClick={onClose}>Verwerfen</button></div>
  </article>;
}
