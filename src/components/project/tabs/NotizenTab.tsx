import { useState } from 'react';
import { fmtDateTime, uid } from '../../../lib/format';
import { useDataStore } from '../../../store/dataStore';
import { useModalStore } from '../../../store/modalStore';
import type { Project, ProjectNote, ProjectNoteFolder } from '../../../types/entities';

type FolderSelection = 'all' | 'root' | string;

function folderOptions(folders: ProjectNoteFolder[], parentId: string | null = null, depth = 0): { folder: ProjectNoteFolder; depth: number }[] {
  return folders.filter((folder) => folder.parentId === parentId).sort((a, b) => a.sortIndex - b.sortIndex || a.name.localeCompare(b.name, 'de')).flatMap((folder) => [{ folder, depth }, ...folderOptions(folders, folder.id, depth + 1)]);
}

function folderAndDescendantIds(folders: ProjectNoteFolder[], folderId?: string) {
  const ids = new Set<string>(folderId ? [folderId] : []);
  let changed = true;
  while (changed) { changed = false; folders.forEach((folder) => { if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) { ids.add(folder.id); changed = true; } }); }
  return ids;
}

export default function NotizenTab({ project }: { project: Project }) {
  const data = useDataStore((state) => state.cache[project.id]);
  const notes = data?.notes || [];
  const folders = data?.noteFolders || [];
  const saveProjectNote = useDataStore((state) => state.saveProjectNote);
  const deleteProjectNote = useDataStore((state) => state.deleteProjectNote);
  const saveFolders = useDataStore((state) => state.saveProjectNoteFolders);
  const confirm = useModalStore((state) => state.confirm);
  const [selectedFolder, setSelectedFolder] = useState<FolderSelection>('all');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [folderEditor, setFolderEditor] = useState<{ id?: string; name: string; parentId: string | null } | null>(null);

  const visibleNotes = notes.filter((note) => selectedFolder === 'all' || (selectedFolder === 'root' ? !note.folderId : note.folderId === selectedFolder))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.sortIndex ?? 999) - (b.sortIndex ?? 999) || b.updatedAt.localeCompare(a.updatedAt));
  const selectedFolderName = selectedFolder === 'all' ? 'Alle Notizen' : selectedFolder === 'root' ? 'Ohne Ordner' : folders.find((folder) => folder.id === selectedFolder)?.name || 'Notizen';

  async function remove(note: ProjectNote) {
    if (await confirm(`Notiz „${note.titel}“ löschen?`)) await deleteProjectNote(project.id, note.id);
  }

  async function toggle(note: ProjectNote, field: 'global' | 'pinned') {
    await saveProjectNote(project.id, { ...note, [field]: !note[field], updatedAt: new Date().toISOString() });
  }

  async function saveFolder() {
    if (!folderEditor?.name.trim()) return;
    const existing = folderEditor.id ? folders.find((folder) => folder.id === folderEditor.id) : undefined;
    const folder: ProjectNoteFolder = { id: existing?.id || uid(), name: folderEditor.name.trim(), parentId: folderEditor.parentId, sortIndex: existing?.sortIndex ?? folders.filter((item) => item.parentId === folderEditor.parentId).length, createdAt: existing?.createdAt || new Date().toISOString() };
    await saveFolders(project.id, existing ? folders.map((item) => item.id === folder.id ? folder : item) : [...folders, folder]);
    setFolderEditor(null);
    setSelectedFolder(folder.id);
  }

  async function removeFolder(folder: ProjectNoteFolder) {
    const descendantIds = new Set<string>([folder.id]);
    let changed = true;
    while (changed) { changed = false; folders.forEach((item) => { if (item.parentId && descendantIds.has(item.parentId) && !descendantIds.has(item.id)) { descendantIds.add(item.id); changed = true; } }); }
    const affectedNotes = notes.filter((note) => note.folderId && descendantIds.has(note.folderId));
    if (!await confirm(`Ordner „${folder.name}“ mit ${descendantIds.size - 1} Unterordner(n) löschen? ${affectedNotes.length} Notiz(en) werden eine Ebene nach oben verschoben.`)) return;
    for (const note of affectedNotes) await saveProjectNote(project.id, { ...note, folderId: folder.parentId, updatedAt: new Date().toISOString() });
    await saveFolders(project.id, folders.filter((item) => !descendantIds.has(item.id)));
    setSelectedFolder(folder.parentId || 'root');
  }

  function renderFolders(parentId: string | null, depth = 0) {
    return folders.filter((folder) => folder.parentId === parentId).sort((a, b) => a.sortIndex - b.sortIndex || a.name.localeCompare(b.name, 'de')).map((folder) => <div key={folder.id} className="note-folder-branch">
      <div className={`note-folder-row${selectedFolder === folder.id ? ' active' : ''}`} style={{ paddingLeft: 10 + depth * 15 }}>
        <button type="button" onClick={() => setSelectedFolder(folder.id)}><span>▾</span><strong>{folder.name}</strong><small>{notes.filter((note) => note.folderId === folder.id).length}</small></button>
        <button type="button" className="note-folder-edit" title="Ordner bearbeiten" onClick={() => setFolderEditor({ id: folder.id, name: folder.name, parentId: folder.parentId })}>•••</button>
      </div>
      {renderFolders(folder.id, depth + 1)}
    </div>);
  }

  return <section className="project-notes-page">
    <div className="module-section-head"><div><span className="eyebrow">Projektgedanken</span><h3>Notizbuch</h3><p>Ordner, Unterordner und freie Notizen für dieses Projekt.</p></div></div>
    <div className="project-notebook">
      <aside className="note-folder-pane">
        <header><strong>Struktur</strong><button type="button" title="Ordner anlegen" onClick={() => setFolderEditor({ name: '', parentId: selectedFolder !== 'all' && selectedFolder !== 'root' ? selectedFolder : null })}>＋</button></header>
        <button type="button" className={`note-system-folder${selectedFolder === 'all' ? ' active' : ''}`} onClick={() => setSelectedFolder('all')}><span>▤</span><strong>Alle Notizen</strong><small>{notes.length}</small></button>
        <button type="button" className={`note-system-folder${selectedFolder === 'root' ? ' active' : ''}`} onClick={() => setSelectedFolder('root')}><span>⌑</span><strong>Ohne Ordner</strong><small>{notes.filter((note) => !note.folderId).length}</small></button>
        <div className="note-folder-tree">{renderFolders(null)}</div>
        {folderEditor && <div className="note-folder-form"><input autoFocus value={folderEditor.name} onChange={(event) => setFolderEditor({ ...folderEditor, name: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') void saveFolder(); }} placeholder="Ordnername" /><select value={folderEditor.parentId || ''} onChange={(event) => setFolderEditor({ ...folderEditor, parentId: event.target.value || null })}><option value="">Oberste Ebene</option>{folderOptions(folders).filter(({ folder }) => !folderAndDescendantIds(folders, folderEditor.id).has(folder.id)).map(({ folder, depth }) => <option key={folder.id} value={folder.id}>{'— '.repeat(depth)}{folder.name}</option>)}</select><div><button className="btn small" disabled={!folderEditor.name.trim()} onClick={() => void saveFolder()}>Speichern</button><button className="icon-btn" onClick={() => setFolderEditor(null)}>×</button>{folderEditor.id && <button className="icon-btn" onClick={() => { const folder = folders.find((item) => item.id === folderEditor.id); if (folder) void removeFolder(folder); }}>Löschen</button>}</div></div>}
      </aside>
      <div className="note-content-pane">
        <header><div><span>Bereich</span><h4>{selectedFolderName}</h4></div><button type="button" className="btn small" onClick={() => setCreating(true)}>+ Neue Notiz</button></header>
        {creating && <ProjectNoteEditor projectId={project.id} folders={folders} initialFolderId={selectedFolder !== 'all' && selectedFolder !== 'root' ? selectedFolder : null} onClose={() => setCreating(false)} />}
        {visibleNotes.length === 0 && !creating ? <div className="empty-state"><h3>Keine Notizen in diesem Bereich</h3><div>Lege eine Notiz an oder wähle links einen anderen Ordner.</div></div> : <div className="project-note-grid">{visibleNotes.map((note) => editingId === note.id
          ? <ProjectNoteEditor key={note.id} projectId={project.id} folders={folders} note={note} onClose={() => setEditingId(null)} />
          : <article className={`project-note-card${note.pinned ? ' pinned' : ''}`} key={note.id}><header><div><div className="project-note-flags">{note.global && <span>Global</span>}{note.pinned && <span>Angeheftet</span>}</div><h4>{note.titel}</h4></div><small>{fmtDateTime(note.updatedAt)}</small></header>{note.inhalt && <p>{note.inhalt}</p>}<div className="project-note-actions"><button type="button" className={`note-toggle${note.global ? ' active' : ''}`} aria-pressed={note.global} onClick={() => void toggle(note, 'global')}>Global</button><button type="button" className={`note-toggle${note.pinned ? ' active' : ''}`} aria-pressed={note.pinned} onClick={() => void toggle(note, 'pinned')}>Anheften</button><button type="button" className="icon-btn edit" onClick={() => setEditingId(note.id)}>Bearbeiten</button><button type="button" className="icon-btn" onClick={() => void remove(note)}>Löschen</button></div></article>)}</div>}
      </div>
    </div>
  </section>;
}

function ProjectNoteEditor({ projectId, folders, note, initialFolderId = null, onClose }: { projectId: string; folders: ProjectNoteFolder[]; note?: ProjectNote; initialFolderId?: string | null; onClose: () => void }) {
  const saveProjectNote = useDataStore((state) => state.saveProjectNote);
  const [titel, setTitel] = useState(note?.titel || '');
  const [inhalt, setInhalt] = useState(note?.inhalt || '');
  const [folderId, setFolderId] = useState(note?.folderId || initialFolderId || '');
  const [global, setGlobal] = useState(note?.global || false);
  const [pinned, setPinned] = useState(note?.pinned || false);
  const valid = !!titel.trim() && !!inhalt.trim();

  async function save() {
    if (!valid) return;
    const now = new Date().toISOString();
    await saveProjectNote(projectId, { id: note?.id || uid(), titel: titel.trim(), inhalt: inhalt.trim(), folderId: folderId || null, sortIndex: note?.sortIndex ?? 999, global, pinned, createdAt: note?.createdAt || now, updatedAt: now });
    onClose();
  }

  return <article className="project-note-editor"><div className="field-grid"><div className="field"><label>Titel</label><input value={titel} onChange={(event) => setTitel(event.target.value)} placeholder="Kurzer Titel der Notiz" autoFocus /></div><div className="field"><label>Ordner</label><select value={folderId} onChange={(event) => setFolderId(event.target.value)}><option value="">Ohne Ordner</option>{folderOptions(folders).map(({ folder, depth }) => <option key={folder.id} value={folder.id}>{'— '.repeat(depth)}{folder.name}</option>)}</select></div></div><div className="field"><label>Notiz</label><textarea value={inhalt} onChange={(event) => setInhalt(event.target.value)} placeholder="Gedanken, Hinweise oder Merkpunkte frei eingeben…" rows={8} /></div><div className="project-note-options"><label><input type="checkbox" checked={global} onChange={(event) => setGlobal(event.target.checked)} /> Global im Dashboard anzeigen</label><label><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} /> Bei der Projektinfo anheften</label></div><div className="btn-row"><button type="button" className="btn small" disabled={!valid} onClick={() => void save()}>{note ? 'Änderungen speichern' : 'Notiz speichern'}</button><button type="button" className="btn secondary small" onClick={onClose}>Verwerfen</button></div></article>;
}
