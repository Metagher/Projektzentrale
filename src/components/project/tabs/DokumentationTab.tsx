import { useState } from 'react';
import { useDataStore } from '../../../store/dataStore';
import { useProjectUiStore } from '../../../store/projectUiStore';
import { useModalStore } from '../../../store/modalStore';
import { fmtDate, fmtDateTime, isEmptyHtml, todayStr, uid } from '../../../lib/format';
import RtfField from '../../shared/RtfField';
import AfnChipsField from '../../shared/AfnChipsField';
import AfnChipsView from '../../shared/AfnChipsView';
import type { DocEntryValue, ProjectCache, ProjectStatusEntry } from '../../../types/entities';
import { compareTaskColors } from '../../../lib/taskColors';

const CURRENT_STATE_KEY = '_currentProjectState';

export default function DokumentationTab({ projectId, data }: { projectId: string; data: ProjectCache }) {
  const docDefs = useDataStore((state) => state.docDefs) || [];
  const saveDocEntry = useDataStore((state) => state.saveDocEntry);
  const saveStatusEntry = useDataStore((state) => state.saveProjectStatusEntry);
  const deleteStatusEntry = useDataStore((state) => state.deleteProjectStatusEntry);
  const saveTask = useDataStore((state) => state.saveTask);
  const taskColorOrder = useDataStore((state) => state.taskColorOrder);
  const confirm = useModalStore((state) => state.confirm);
  const { jumpToTask } = useProjectUiStore();
  const [editingCurrent, setEditingCurrent] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ProjectStatusEntry | 'new' | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  const current = (data.doc[CURRENT_STATE_KEY] as DocEntryValue | undefined) || { content: '', updatedAt: null, afns: [] };
  const history = ((data.doc._statusHistory as ProjectStatusEntry[] | undefined) || []).slice().sort((a, b) => b.datum.localeCompare(a.datum) || b.updatedAt.localeCompare(a.updatedAt));
  const legacyEntries = docDefs.flatMap((definition) => {
    const entry = data.doc[definition.id];
    return entry && !Array.isArray(entry) && (entry.content || entry.afns?.length) ? [{ definition, entry }] : [];
  });
  const dokuTasks = data.tasks.filter((task) => task.status === 'erledigt' && task.doku && !task.dokuErledigt).slice().sort((a, b) => compareTaskColors(a, b, taskColorOrder) || (b.abgeschlossenAm || '').localeCompare(a.abgeschlossenAm || ''));

  async function moveTaskToHistory(taskId: string) {
    const task = data.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const now = new Date().toISOString();
    await saveStatusEntry(projectId, {
      id: uid(),
      datum: task.abgeschlossenAm?.slice(0, 10) || todayStr(),
      titel: task.titel,
      content: task.beschreibung || '',
      afns: task.afns || [],
      createdAt: now,
      updatedAt: now,
    });
    await saveTask(projectId, { ...task, dokuErledigt: true });
  }

  async function removeEntry(entry: ProjectStatusEntry) {
    if (await confirm(`Standseintrag „${entry.titel}“ wirklich löschen?`)) await deleteStatusEntry(projectId, entry.id);
  }

  return <div className="project-status-doc">
    <header className="project-status-intro">
      <div><span className="eyebrow">Lebende Projektdokumentation</span><h3>Aktueller Projektstand</h3><p>Hier steht nur, was für den gegenwärtigen Stand relevant ist. Änderungen und Entscheidungen werden darunter chronologisch festgehalten.</p></div>
      {!editingCurrent && <button className="btn small" onClick={() => setEditingCurrent(true)}>{isEmptyHtml(current.content) ? 'Projektstand erfassen' : 'Projektstand bearbeiten'}</button>}
    </header>

    {editingCurrent ? <CurrentStateEditor projectId={projectId} entry={current} onSave={saveDocEntry} onClose={() => setEditingCurrent(false)} /> :
      <section className="current-state-card" onClick={() => setEditingCurrent(true)}>
        <div className="doc-section-head"><strong>Stand heute</strong><span className="doc-updated">{current.updatedAt ? `aktualisiert ${fmtDateTime(current.updatedAt)}` : 'noch nicht erfasst'}</span></div>
        {!!current.afns?.length && <AfnChipsView afns={current.afns} />}
        {isEmptyHtml(current.content) ? <div className="doc-report-empty">Umgesetztes, Entscheidungen, Risiken und nächste Schritte hier zusammenfassen.</div> : <div className="rtf-content" dangerouslySetInnerHTML={{ __html: current.content }} />}
      </section>}

    {dokuTasks.length > 0 && <section className="doc-inbox">
      <div className="section-title">Zur Dokumentation vorgemerkt ({dokuTasks.length})</div>
      {dokuTasks.map((task) => <div className={`doku-list-row${task.farbe ? ` task-color-border-${task.farbe}` : ''}`} key={task.id} onClick={() => jumpToTask(task.id)}>
        <div className="doku-inbox-copy"><strong><span className="task-nr">{task.nr || '—'}</span>{task.titel}</strong><small>{task.abgeschlossenAm ? `Erledigt: ${fmtDate(task.abgeschlossenAm.slice(0, 10))}` : ''}</small></div>
        <button className="btn secondary small" onClick={(event) => { event.stopPropagation(); moveTaskToHistory(task.id); }}>In Verlauf übernehmen</button>
      </div>)}
    </section>}

    <div className="project-status-history-head"><div><div className="section-title">Verlauf</div><p>Entscheidungen, Änderungen und erreichte Zwischenstände.</p></div><button className="btn small" onClick={() => setEditingEntry('new')}>+ Standseintrag</button></div>
    {editingEntry && <StatusEntryEditor projectId={projectId} entry={editingEntry === 'new' ? undefined : editingEntry} onSave={saveStatusEntry} onClose={() => setEditingEntry(null)} />}
    {history.length === 0 && !editingEntry && <div className="empty-state"><h3>Noch kein Verlauf</h3><div>Lege den ersten Eintrag an, sobald sich im Projekt etwas Wesentliches ändert.</div></div>}
    <div className="project-status-timeline">{history.map((entry) => <article className="project-status-entry" key={entry.id}>
      <time>{fmtDate(entry.datum)}</time><div className="project-status-entry-body"><div className="doc-section-head"><h3>{entry.titel}</h3><div className="actions"><button className="icon-btn" onClick={() => setEditingEntry(entry)}>Bearbeiten</button><button className="icon-btn" onClick={() => removeEntry(entry)}>Löschen</button></div></div>
      {!!entry.afns.length && <AfnChipsView afns={entry.afns} />}{!isEmptyHtml(entry.content) && <div className="rtf-content" dangerouslySetInnerHTML={{ __html: entry.content }} />}</div>
    </article>)}</div>

    {legacyEntries.length > 0 && <section className="legacy-doc-archive"><button className="btn secondary small" onClick={() => setShowArchive((value) => !value)}>{showArchive ? 'Bisherige Dokumentation ausblenden' : `Bisherige Dokumentation anzeigen (${legacyEntries.length})`}</button>
      {showArchive && legacyEntries.map(({ definition, entry }) => <article className="doc-report-row" key={definition.id}><div className="doc-section-head"><h3>{definition.title}</h3><span className="doc-updated">Archiv</span></div>{!!entry.afns?.length && <AfnChipsView afns={entry.afns} />}<div className="rtf-content" dangerouslySetInnerHTML={{ __html: entry.content }} /></article>)}</section>}
  </div>;
}

function CurrentStateEditor({ projectId, entry, onSave, onClose }: { projectId: string; entry: DocEntryValue; onSave: (projectId: string, key: string, value: DocEntryValue) => Promise<void>; onClose: () => void }) {
  const [content, setContent] = useState(entry.content || '');
  const [afns, setAfns] = useState(entry.afns || []);
  async function save() { await onSave(projectId, CURRENT_STATE_KEY, { content, afns, updatedAt: new Date().toISOString() }); onClose(); }
  return <section className="doc-section current-state-editor"><RtfField value={content} onChange={setContent} title="Aktueller Projektstand" placeholder="Was ist umgesetzt? Was wurde entschieden? Was ist kritisch? Was sind die nächsten Schritte?" /><AfnChipsField value={afns} onChange={setAfns} /><div className="btn-row"><button className="btn small" onClick={save}>Projektstand speichern</button><button className="btn secondary small" onClick={onClose}>Abbrechen</button></div></section>;
}

function StatusEntryEditor({ projectId, entry, onSave, onClose }: { projectId: string; entry?: ProjectStatusEntry; onSave: (projectId: string, entry: ProjectStatusEntry) => Promise<void>; onClose: () => void }) {
  const [datum, setDatum] = useState(entry?.datum || todayStr());
  const [titel, setTitel] = useState(entry?.titel || '');
  const [content, setContent] = useState(entry?.content || '');
  const [afns, setAfns] = useState(entry?.afns || []);
  async function save() { if (!titel.trim()) return; const now = new Date().toISOString(); await onSave(projectId, { id: entry?.id || uid(), datum, titel: titel.trim(), content, afns, createdAt: entry?.createdAt || now, updatedAt: now }); onClose(); }
  return <section className="doc-section status-entry-editor"><div className="field-grid"><div className="field"><label>Datum</label><input type="date" value={datum} onChange={(event) => setDatum(event.target.value)} /></div><div className="field"><label>Titel</label><input value={titel} onChange={(event) => setTitel(event.target.value)} placeholder="z. B. Schnittstelle freigegeben" /></div></div><RtfField value={content} onChange={setContent} title="Eintrag" placeholder="Was hat sich geändert und warum ist es relevant?" /><AfnChipsField value={afns} onChange={setAfns} /><div className="btn-row"><button className="btn small" disabled={!titel.trim()} onClick={save}>Eintrag speichern</button><button className="btn secondary small" onClick={onClose}>Abbrechen</button></div></section>;
}
