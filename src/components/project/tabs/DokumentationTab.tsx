import { useState } from 'react';
import { useDataStore } from '../../../store/dataStore';
import { useProjectUiStore } from '../../../store/projectUiStore';
import { computeDocLabels, getSubtreeIds } from '../../../lib/docOutline';
import { defLevel, fmtDate, fmtDateTime, isEmptyHtml } from '../../../lib/format';
import RtfField from '../../shared/RtfField';
import AfnChipsField from '../../shared/AfnChipsField';
import AfnChipsView from '../../shared/AfnChipsView';
import type { DocEntryValue, ProjectCache } from '../../../types/entities';
import { compareTaskColors } from '../../../lib/taskColors';

export default function DokumentationTab({ projectId, data }: { projectId: string; data: ProjectCache }) {
  const docDefs = useDataStore((s) => s.docDefs) || [];
  const saveDocEntry = useDataStore((s) => s.saveDocEntry);
  const setDocHidden = useDataStore((s) => s.setDocHidden);
  const saveTask = useDataStore((s) => s.saveTask);
  const taskColorOrder = useDataStore((s) => s.taskColorOrder);
  const { editingDocSectionId, setEditingDocSectionId, jumpToTask } = useProjectUiStore();

  const labels = computeDocLabels(docDefs);
  const hidden = (data.doc._hidden as string[] | undefined) || [];
  const visibleDefs = docDefs.filter((d) => !hidden.includes(d.id));
  const hiddenDefs = docDefs.filter((d) => hidden.includes(d.id));
  const dokuTasks = data.tasks
    .filter((t) => t.status === 'erledigt' && t.doku && !t.dokuErledigt)
    .slice()
    .sort((a, b) => compareTaskColors(a, b, taskColorOrder) || (b.abgeschlossenAm || '').localeCompare(a.abgeschlossenAm || ''));

  async function hideSubtree(defId: string) {
    const ids = getSubtreeIds(docDefs, defId);
    const next = Array.from(new Set([...hidden, ...ids]));
    if (editingDocSectionId && ids.includes(editingDocSectionId)) setEditingDocSectionId(null);
    await setDocHidden(projectId, next);
  }

  async function showSubtree(defId: string) {
    const ids = getSubtreeIds(docDefs, defId);
    await setDocHidden(projectId, hidden.filter((id) => !ids.includes(id)));
  }

  async function markDokuDone(taskId: string) {
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task) return;
    await saveTask(projectId, { ...task, dokuErledigt: true });
  }

  function openTaskFromDoku(taskId: string) {
    jumpToTask(taskId);
  }

  return (
    <>
      {dokuTasks.length > 0 && (
        <>
          <div className="section-title">Erledigte Aufgaben zur Dokumentation ({dokuTasks.length})</div>
          {dokuTasks.map((t) => (
            <div className={`doku-list-row${t.farbe ? ` task-color-border-${t.farbe}` : ''}`} key={t.id} onClick={() => openTaskFromDoku(t.id)}>
              <div style={{ flex: 1 }}>
                <div className="doku-list-title">
                  {t.farbe && <span className={`task-color-swatch task-color-${t.farbe}`} />}
                  <span className="task-nr">{t.nr || '—'}</span>
                  <strong>{t.titel}</strong>
                </div>
                <div className="doku-list-meta">{t.abgeschlossenAm ? 'Erledigt: ' + fmtDate(t.abgeschlossenAm.slice(0, 10)) : ''}</div>
                {!isEmptyHtml(t.beschreibung) ? (
                  <div className="rtf-content rtf-field-preview-compact" style={{ marginTop: 6 }} dangerouslySetInnerHTML={{ __html: t.beschreibung }} />
                ) : (
                  <div className="doc-report-empty" style={{ marginTop: 6 }}>
                    Keine Beschreibung erfasst.
                  </div>
                )}
              </div>
              <button
                className="btn secondary small"
                style={{ flexShrink: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  markDokuDone(t.id);
                }}
              >
                Doku abgeschlossen
              </button>
            </div>
          ))}
        </>
      )}

      {docDefs.length === 0 && (
        <div className="empty-state">
          <h3>Noch keine Oberpunkte definiert</h3>
          <div>Lege sie unter „⚙ Oberpunkte verwalten" in der Seitenleiste an — sie gelten dann für alle Projekte.</div>
        </div>
      )}

      {visibleDefs.map((s) => {
        const entry: DocEntryValue = (data.doc[s.id] as DocEntryValue) || { content: '', updatedAt: null, afns: [] };
        if (s.id === editingDocSectionId) {
          return (
            <DocSectionEditor
              key={s.id}
              projectId={projectId}
              defId={s.id}
              title={s.title}
              level={defLevel(s.level)}
              label={labels[s.id]}
              entry={entry}
              onHide={() => hideSubtree(s.id)}
              onSave={saveDocEntry}
              onCancel={() => setEditingDocSectionId(null)}
              onSaved={() => setEditingDocSectionId(null)}
            />
          );
        }
        return (
          <div
            className={`doc-report-row lvl-${defLevel(s.level)}`}
            key={s.id}
            onClick={() => setEditingDocSectionId(s.id)}
          >
            <div className="doc-section-head">
              <h3>
                {labels[s.id]} {s.title}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="doc-updated">{entry.updatedAt ? 'zuletzt aktualisiert: ' + fmtDateTime(entry.updatedAt) : 'noch nicht bearbeitet'}</span>
                <button
                  className="icon-btn"
                  title="Für dieses Projekt ausblenden (inkl. Unterpunkte)"
                  onClick={(e) => {
                    e.stopPropagation();
                    hideSubtree(s.id);
                  }}
                >
                  Ausblenden
                </button>
              </div>
            </div>
            {entry.afns && entry.afns.length > 0 && (
              <div className="doc-report-afns">
                <AfnChipsView afns={entry.afns} />
              </div>
            )}
            {!isEmptyHtml(entry.content) ? (
              <div className="rtf-content" dangerouslySetInnerHTML={{ __html: entry.content }} />
            ) : (
              <div className="doc-report-empty">Noch kein Text erfasst — klicken zum Bearbeiten.</div>
            )}
          </div>
        );
      })}

      {hiddenDefs.length > 0 && (
        <>
          <div className="section-title">Ausgeblendete Punkte für dieses Projekt ({hiddenDefs.length})</div>
          {hiddenDefs.map((s) => (
            <div
              className={`list-item def-row lvl-${defLevel(s.level)}`}
              key={s.id}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span className="meta">
                {labels[s.id]} {s.title}
              </span>
              <button className="icon-btn edit" onClick={() => showSubtree(s.id)}>
                Einblenden
              </button>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function DocSectionEditor({
  projectId,
  defId,
  title,
  level,
  label,
  entry,
  onHide,
  onSave,
  onCancel,
  onSaved,
}: {
  projectId: string;
  defId: string;
  title: string;
  level: number;
  label: string;
  entry: DocEntryValue;
  onHide: () => void;
  onSave: (projectId: string, defId: string, value: DocEntryValue) => Promise<void>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [content, setContent] = useState(entry.content || '');
  const [afns, setAfns] = useState(entry.afns || []);

  async function handleSave() {
    const contentChanged = content !== (entry.content || '');
    await onSave(projectId, defId, {
      content,
      updatedAt: contentChanged ? new Date().toISOString() : entry.updatedAt || null,
      afns,
    });
    onSaved();
  }

  return (
    <div className={`doc-section lvl-${level}`}>
      <div className="doc-section-head">
        <h3>
          {label} {title}
        </h3>
        <span className="doc-updated">{entry.updatedAt ? 'zuletzt aktualisiert: ' + fmtDateTime(entry.updatedAt) : 'noch nicht bearbeitet'}</span>
      </div>
      <RtfField value={content} onChange={setContent} title={title} placeholder="Klicken, um Text einzugeben…" />
      <AfnChipsField value={afns} onChange={setAfns} />
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn small" onClick={handleSave}>
          Speichern
        </button>
        <button className="btn secondary small" onClick={onCancel}>
          Abbrechen
        </button>
        <button className="icon-btn" style={{ marginLeft: 'auto' }} title="Für dieses Projekt ausblenden (inkl. Unterpunkte)" onClick={onHide}>
          Ausblenden
        </button>
      </div>
    </div>
  );
}
