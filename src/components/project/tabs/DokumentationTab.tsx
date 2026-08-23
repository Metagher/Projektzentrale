import { useState } from 'react';
import { useDataStore } from '../../../store/dataStore';
import { useProjectUiStore } from '../../../store/projectUiStore';
import { useModalStore } from '../../../store/modalStore';
import { fmtDate, fmtDateTime, isEmptyHtml, todayStr, uid } from '../../../lib/format';
import RtfField from '../../shared/RtfField';
import AfnChipsField from '../../shared/AfnChipsField';
import AfnChipsView from '../../shared/AfnChipsView';
import type { DocEntryValue, Project, ProjectCache, ProjectDocumentationArea, ProjectStatusEntry } from '../../../types/entities';
import { compareTaskColors } from '../../../lib/taskColors';
import { exportCurrentProjectStatus } from '../../../lib/projectStatusExport';
import TaskColorBadge from '../../shared/TaskColorBadge';
import { taskDocumentationTarget } from '../../../lib/taskDocumentation';

const CURRENT_STATE_KEY = '_currentProjectState';

export default function DokumentationTab({ project, data }: { project: Project; data: ProjectCache }) {
  const projectId = project.id;
  const docDefs = useDataStore((state) => state.docDefs) || [];
  const saveStatusEntry = useDataStore((state) => state.saveProjectStatusEntry);
  const deleteStatusEntry = useDataStore((state) => state.deleteProjectStatusEntry);
  const saveDocumentationAreas = useDataStore((state) => state.saveProjectDocumentationAreas);
  const saveTask = useDataStore((state) => state.saveTask);
  const taskColorOrder = useDataStore((state) => state.taskColorOrder);
  const confirm = useModalStore((state) => state.confirm);
  const prompt = useModalStore((state) => state.prompt);
  const { jumpToTask } = useProjectUiStore();
  const [editingCurrent, setEditingCurrent] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ProjectStatusEntry | 'new' | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const legacyCurrent = (data.doc[CURRENT_STATE_KEY] as DocEntryValue | undefined) || { content: '', updatedAt: null, afns: [] };
  const storedAreas = (data.doc._documentationAreas as ProjectDocumentationArea[] | undefined) || [];
  const areas = storedAreas.length ? storedAreas : [{ id: 'general', name: 'Allgemein', current: legacyCurrent }];
  const [selectedAreaId, setSelectedAreaId] = useState(areas[0].id);
  const selectedArea = areas.find((area) => area.id === selectedAreaId) || areas[0];

  const current = selectedArea.current;
  const history = ((data.doc._statusHistory as ProjectStatusEntry[] | undefined) || []).filter((entry) => (entry.bereichId || 'general') === selectedArea.id).slice().sort((a, b) => b.datum.localeCompare(a.datum) || b.updatedAt.localeCompare(a.updatedAt));
  const legacyEntries = docDefs.flatMap((definition) => {
    const entry = data.doc[definition.id];
    return entry && !Array.isArray(entry) && (entry.content || entry.afns?.length) ? [{ definition, entry }] : [];
  });
  const dokuTasks = data.tasks.filter((task) => taskDocumentationTarget(task) === 'project' && !task.dokuErledigt).slice().sort((a, b) => compareTaskColors(a, b, taskColorOrder) || Number(b.status === 'erledigt') - Number(a.status === 'erledigt') || (b.abgeschlossenAm || b.erstelltAm || '').localeCompare(a.abgeschlossenAm || a.erstelltAm || ''));

  async function moveTaskToHistory(taskId: string) {
    const task = data.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const now = new Date().toISOString();
    await saveStatusEntry(projectId, {
      id: uid(),
      datum: task.abgeschlossenAm?.slice(0, 10) || todayStr(),
      titel: task.titel,
      content: task.aktuellerStand || task.anforderung || '',
      afns: task.afns || [],
      createdAt: now,
      updatedAt: now,
      bereichId: selectedArea.id,
    });
    await saveTask(projectId, { ...task, dokuErledigt: true });
  }

  async function removeEntry(entry: ProjectStatusEntry) {
    if (await confirm(`Standseintrag „${entry.titel}“ wirklich löschen?`)) await deleteStatusEntry(projectId, entry.id);
  }

  async function saveCurrent(value: DocEntryValue) {
    await saveDocumentationAreas(projectId, areas.map((area) => area.id === selectedArea.id ? { ...area, current: value } : area));
  }

  async function addArea() {
    const name = await prompt({ title: 'Dokumentationsbereich anlegen', message: 'Bereiche trennen unterschiedliche Themen oder Organisationseinheiten beim Kunden.', label: 'Name des Bereichs', placeholder: 'z. B. Produktion', confirmLabel: 'Bereich anlegen' });
    if (!name?.trim()) return;
    const area: ProjectDocumentationArea = { id: uid(), name: name.trim(), current: { content: '', updatedAt: null, afns: [] } };
    await saveDocumentationAreas(projectId, [...areas, area]);
    setSelectedAreaId(area.id);
    setEditingCurrent(false);
  }

  async function renameArea() {
    const name = await prompt({ title: 'Bereich umbenennen', message: 'Der Inhalt und Verlauf bleiben erhalten.', label: 'Name des Bereichs', initialValue: selectedArea.name, confirmLabel: 'Umbenennen' });
    if (!name?.trim()) return;
    await saveDocumentationAreas(projectId, areas.map((area) => area.id === selectedArea.id ? { ...area, name: name.trim() } : area));
  }

  async function deleteArea() {
    if (areas.length === 1) return;
    const entries = ((data.doc._statusHistory as ProjectStatusEntry[] | undefined) || []).filter((entry) => (entry.bereichId || 'general') === selectedArea.id);
    const sure = await confirm(`Bereich „${selectedArea.name}“ samt aktuellem Stand und ${entries.length} Verlaufseintrag${entries.length === 1 ? '' : 'en'} löschen?`);
    if (!sure) return;
    for (const entry of entries) await deleteStatusEntry(projectId, entry.id);
    const remaining = areas.filter((area) => area.id !== selectedArea.id);
    await saveDocumentationAreas(projectId, remaining);
    setSelectedAreaId(remaining[0].id);
    setEditingCurrent(false);
    setEditingEntry(null);
  }

  return <div className="project-status-doc">
    <nav className="documentation-areas" aria-label="Dokumentationsbereiche">
      <div className="documentation-area-tabs">{areas.map((area) => <button className={area.id === selectedArea.id ? 'active' : ''} key={area.id} onClick={() => { setSelectedAreaId(area.id); setEditingCurrent(false); setEditingEntry(null); }}>{area.name}</button>)}</div>
      <div className="documentation-area-actions"><button className="icon-btn" onClick={() => exportCurrentProjectStatus(project, areas)}>⇩ Aktuellen Stand exportieren</button><button className="icon-btn" onClick={addArea}>+ Bereich</button><button className="icon-btn" onClick={renameArea}>Umbenennen</button>{areas.length > 1 && <button className="icon-btn" onClick={deleteArea}>Löschen</button>}</div>
    </nav>
    <header className="project-status-intro">
      <div><span className="eyebrow">Bereich · {selectedArea.name}</span><h3>Aktueller Projektstand</h3><p>Hier steht nur, was für diesen Bereich gegenwärtig relevant ist. Änderungen und Entscheidungen werden darunter chronologisch festgehalten.</p></div>
      {!editingCurrent && <button className="btn small" onClick={() => setEditingCurrent(true)}>{isEmptyHtml(current.content) ? 'Projektstand erfassen' : 'Projektstand bearbeiten'}</button>}
    </header>

    {editingCurrent ? <div className="task-edit-overlay" role="dialog" aria-modal="true" aria-label="Projektstand bearbeiten"><div className="task-edit-dialog"><div className="task-edit-dialog-head"><div><span>Dokumentation bearbeiten</span><strong>{selectedArea.name} · Aktueller Projektstand</strong></div></div><CurrentStateEditor entry={current} onSave={saveCurrent} onClose={() => setEditingCurrent(false)} /></div></div> :
      <section className="current-state-card" onClick={() => setEditingCurrent(true)}>
        <div className="doc-section-head"><strong>Stand heute</strong><span className="doc-updated">{current.updatedAt ? `aktualisiert ${fmtDateTime(current.updatedAt)}` : 'noch nicht erfasst'}</span></div>
        {!!current.afns?.length && <AfnChipsView afns={current.afns} />}
        {isEmptyHtml(current.content) ? <div className="doc-report-empty">Umgesetztes, Entscheidungen, Risiken und nächste Schritte hier zusammenfassen.</div> : <div className="rtf-content" dangerouslySetInnerHTML={{ __html: current.content }} />}
      </section>}

    {dokuTasks.length > 0 && <section className="doc-inbox">
      <div className="section-title">Für Projektdokumentation vorgemerkt ({dokuTasks.length})</div>
      {dokuTasks.map((task) => <div className={`doku-list-row${task.farbe ? ` task-color-border-${task.farbe}` : ''}`} key={task.id} onClick={() => jumpToTask(task.id)}>
        <div className="doku-inbox-copy"><strong><span className="task-nr">{task.nr || '—'}</span>{task.titel}</strong>{task.farbe && <TaskColorBadge color={task.farbe} compact />}<small>{task.status === 'erledigt' && task.abgeschlossenAm ? `Erledigt: ${fmtDate(task.abgeschlossenAm.slice(0, 10))}` : `Status: ${task.status}`}</small></div>
        <button className="btn secondary small" onClick={(event) => { event.stopPropagation(); moveTaskToHistory(task.id); }}>In Verlauf übernehmen</button>
      </div>)}
    </section>}

    <div className="project-status-history-head"><div><div className="section-title">Verlauf</div><p>Entscheidungen, Änderungen und erreichte Zwischenstände.</p></div><button className="btn small" onClick={() => setEditingEntry('new')}>+ Standseintrag</button></div>
    {editingEntry && <div className="task-edit-overlay" role="dialog" aria-modal="true" aria-label="Standseintrag bearbeiten"><div className="task-edit-dialog"><div className="task-edit-dialog-head"><div><span>Dokumentation</span><strong>{editingEntry === 'new' ? 'Neuer Standseintrag' : editingEntry.titel} · {selectedArea.name}</strong></div></div><StatusEntryEditor projectId={projectId} areaId={selectedArea.id} entry={editingEntry === 'new' ? undefined : editingEntry} onSave={saveStatusEntry} onClose={() => setEditingEntry(null)} /></div></div>}
    {history.length === 0 && !editingEntry && <div className="empty-state"><h3>Noch kein Verlauf</h3><div>Lege den ersten Eintrag an, sobald sich im Projekt etwas Wesentliches ändert.</div></div>}
    <div className="project-status-timeline">{history.map((entry) => <article className="project-status-entry" key={entry.id}>
      <time>{fmtDate(entry.datum)}</time><div className="project-status-entry-body"><div className="doc-section-head"><h3>{entry.titel}</h3><div className="actions"><button className="icon-btn" onClick={() => setEditingEntry(entry)}>Bearbeiten</button><button className="icon-btn" onClick={() => removeEntry(entry)}>Löschen</button></div></div>
      {!!entry.afns.length && <AfnChipsView afns={entry.afns} />}{!isEmptyHtml(entry.content) && <div className="rtf-content" dangerouslySetInnerHTML={{ __html: entry.content }} />}</div>
    </article>)}</div>

    {legacyEntries.length > 0 && <section className="legacy-doc-archive"><button className="btn secondary small" onClick={() => setShowArchive((value) => !value)}>{showArchive ? 'Bisherige Dokumentation ausblenden' : `Bisherige Dokumentation anzeigen (${legacyEntries.length})`}</button>
      {showArchive && legacyEntries.map(({ definition, entry }) => <article className="doc-report-row" key={definition.id}><div className="doc-section-head"><h3>{definition.title}</h3><span className="doc-updated">Archiv</span></div>{!!entry.afns?.length && <AfnChipsView afns={entry.afns} />}<div className="rtf-content" dangerouslySetInnerHTML={{ __html: entry.content }} /></article>)}</section>}
  </div>;
}

function CurrentStateEditor({ entry, onSave, onClose }: { entry: DocEntryValue; onSave: (value: DocEntryValue) => Promise<void>; onClose: () => void }) {
  const [content, setContent] = useState(entry.content || '');
  const [afns, setAfns] = useState(entry.afns || []);
  async function save() { await onSave({ content, afns, updatedAt: new Date().toISOString() }); onClose(); }
  return <section className="doc-section current-state-editor"><RtfField value={content} onChange={setContent} title="Aktueller Projektstand" placeholder="Was ist umgesetzt? Was wurde entschieden? Was ist kritisch? Was sind die nächsten Schritte?" /><AfnChipsField value={afns} onChange={setAfns} /><div className="btn-row"><button className="btn small" onClick={save}>Projektstand speichern</button><button className="btn secondary small" onClick={onClose}>Abbrechen</button></div></section>;
}

function StatusEntryEditor({ projectId, areaId, entry, onSave, onClose }: { projectId: string; areaId: string; entry?: ProjectStatusEntry; onSave: (projectId: string, entry: ProjectStatusEntry) => Promise<void>; onClose: () => void }) {
  const [datum, setDatum] = useState(entry?.datum || todayStr());
  const [titel, setTitel] = useState(entry?.titel || '');
  const [content, setContent] = useState(entry?.content || '');
  const [afns, setAfns] = useState(entry?.afns || []);
  async function save() { if (!titel.trim()) return; const now = new Date().toISOString(); await onSave(projectId, { id: entry?.id || uid(), datum, titel: titel.trim(), content, afns, createdAt: entry?.createdAt || now, updatedAt: now, bereichId: areaId }); onClose(); }
  return <section className="doc-section status-entry-editor"><div className="field-grid"><div className="field"><label>Datum</label><input type="date" value={datum} onChange={(event) => setDatum(event.target.value)} /></div><div className="field"><label>Titel</label><input value={titel} onChange={(event) => setTitel(event.target.value)} placeholder="z. B. Schnittstelle freigegeben" /></div></div><RtfField value={content} onChange={setContent} title="Eintrag" placeholder="Was hat sich geändert und warum ist es relevant?" /><AfnChipsField value={afns} onChange={setAfns} /><div className="btn-row"><button className="btn small" disabled={!titel.trim()} onClick={save}>Eintrag speichern</button><button className="btn secondary small" onClick={onClose}>Abbrechen</button></div></section>;
}
