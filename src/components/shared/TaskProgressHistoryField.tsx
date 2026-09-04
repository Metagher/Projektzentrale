import { useState } from 'react';
import { fmtDate, isEmptyHtml, todayStr, uid } from '../../lib/format';
import RtfField from './RtfField';
import type { TaskProgressEntry } from '../../types/entities';

export default function TaskProgressHistoryField({ value, onChange }: { value: TaskProgressEntry[]; onChange: (entries: TaskProgressEntry[]) => void }) {
  const [editing, setEditing] = useState<TaskProgressEntry | 'new' | null>(null);
  const sorted = value.slice().sort((a, b) => b.datum.localeCompare(a.datum) || b.updatedAt.localeCompare(a.updatedAt));

  function remove(id: string) { onChange(value.filter((entry) => entry.id !== id)); }

  return <section className="task-progress-history">
    <div className="task-progress-history-head"><div><strong>Verlauf</strong><small>Änderungen und Zwischenstände chronologisch festhalten.</small></div><button type="button" className="btn secondary small" onClick={() => setEditing('new')}>+ Verlaufseintrag</button></div>
    {editing && <TaskProgressEntryEditor entry={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onSave={(entry) => { onChange(editing === 'new' ? [...value, entry] : value.map((item) => item.id === entry.id ? entry : item)); setEditing(null); }} />}
    {sorted.length === 0 && !editing && <div className="meta">Noch keine Verlaufseinträge.</div>}
    {sorted.map((entry, index) => <article className={`task-progress-entry${index === 0 ? ' current' : ''}`} key={entry.id}><div className="doc-section-head"><div>{index === 0 && <span className="badge aktuell">Aktuell</span>}<time>{fmtDate(entry.datum)}</time><strong>{entry.titel}</strong></div><div className="actions"><button type="button" className="icon-btn" onClick={() => setEditing(entry)}>Bearbeiten</button><button type="button" className="icon-btn" onClick={() => remove(entry.id)}>Löschen</button></div></div>{!isEmptyHtml(entry.content) && <div className="rtf-content" dangerouslySetInnerHTML={{ __html: entry.content }} />}</article>)}
  </section>;
}

function TaskProgressEntryEditor({ entry, onSave, onCancel }: { entry?: TaskProgressEntry; onSave: (entry: TaskProgressEntry) => void; onCancel: () => void }) {
  const [datum, setDatum] = useState(entry?.datum || todayStr());
  const [titel, setTitel] = useState(entry?.titel || '');
  const [content, setContent] = useState(entry?.content || '');
  function save() { const now = new Date().toISOString(); onSave({ id: entry?.id || uid(), datum, titel: titel.trim(), content, createdAt: entry?.createdAt || now, updatedAt: now }); }
  return <div className="task-progress-editor"><div className="field-grid"><div className="field"><label>Datum</label><input type="date" value={datum} onChange={(event) => setDatum(event.target.value)} /></div><div className="field"><label>Titel</label><input value={titel} onChange={(event) => setTitel(event.target.value)} placeholder="Was hat sich geändert?" /></div></div><RtfField value={content} onChange={setContent} title="Verlaufseintrag" placeholder="Änderung oder Zwischenstand beschreiben…" /><div className="btn-row"><button type="button" className="btn small" disabled={!titel.trim()} onClick={save}>Eintrag übernehmen</button><button type="button" className="btn secondary small" onClick={onCancel}>Abbrechen</button></div></div>;
}
