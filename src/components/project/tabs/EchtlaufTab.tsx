import { useState } from 'react';
import { useDataStore } from '../../../store/dataStore';
import { useProjectUiStore } from '../../../store/projectUiStore';
import { useModalStore } from '../../../store/modalStore';
import { MILESTONE_STATUS } from '../../../lib/constants';
import { fmtDate, isEmptyHtml, slug, uid } from '../../../lib/format';
import RtfField from '../../shared/RtfField';
import LinkChipsField from '../../shared/LinkChipsField';
import type { Milestone, MilestoneStatus, ProjectCache } from '../../../types/entities';

export default function EchtlaufTab({ projectId, data }: { projectId: string; data: ProjectCache }) {
  const saveMilestone = useDataStore((s) => s.saveMilestone);
  const deleteMilestone = useDataStore((s) => s.deleteMilestone);
  const { editingMilestone, setEditingMilestone } = useProjectUiStore();
  const confirm = useModalStore((s) => s.confirm);
  const alert = useModalStore((s) => s.alert);
  const projects = useDataStore((s) => s.projects) || [];
  const project = projects.find((item) => item.id === projectId);
  const customerProjects = projects.filter((item) => item.kunde === project?.kunde && (item.id === projectId || item.typ === 'Bestandskunde mit Echtläufen'));

  const editObj = editingMilestone ? data.timeline.find((m) => m.id === editingMilestone) : null;

  const [titel, setTitel] = useState(editObj?.titel || '');
  const [datum, setDatum] = useState(editObj?.datum || '');
  const [status, setStatus] = useState<MilestoneStatus>(editObj?.status || 'geplant');
  const [notiz, setNotiz] = useState(editObj?.notiz || '');
  const [projectIds, setProjectIds] = useState<string[]>(editObj?.projectIds?.length ? editObj.projectIds : [projectId]);
  const [showForm, setShowForm] = useState(false);

  function resetForm() {
    setTitel('');
    setDatum('');
    setStatus('geplant');
    setNotiz('');
    setProjectIds([projectId]);
  }

  function startEdit(m: Milestone) {
    setShowForm(true);
    setEditingMilestone(m.id);
    setTitel(m.titel);
    setDatum(m.datum || '');
    setStatus(m.status);
    setNotiz(m.notiz);
    setProjectIds(m.projectIds?.length ? m.projectIds : [projectId]);
  }

  async function handleSave() {
    const trimmed = titel.trim();
    if (!trimmed) {
      await alert('Bitte einen Titel angeben.');
      return;
    }
    await saveMilestone(projectId, { id: editObj ? editObj.id : uid(), titel: trimmed, datum, status, notiz, projectIds });
    setEditingMilestone(null);
    setShowForm(false);
    resetForm();
  }

  async function handleDelete(id: string) {
    const sure = await confirm('Diesen Meilenstein löschen?');
    if (!sure) return;
    await deleteMilestone(projectId, id);
  }

  const sorted = data.timeline.slice().sort((a, b) => (a.datum || '9999').localeCompare(b.datum || '9999'));

  return (
    <>
      <button className="btn" style={{ marginBottom: 14 }} onClick={() => { resetForm(); setEditingMilestone(null); setShowForm(true); }}>+ Neuer Meilenstein</button>
      {(showForm || editObj) && <div className="task-edit-overlay" role="dialog" aria-modal="true" aria-label={editObj ? 'Meilenstein bearbeiten' : 'Meilenstein anlegen'}><div className="task-edit-dialog"><div className="task-edit-dialog-head"><div><span>Zeitplan</span><strong>{editObj ? editObj.titel : 'Neuer Meilenstein'}</strong></div></div><div className="card">
        <h3 style={{ marginBottom: 10, fontSize: 15 }}>{editObj ? 'Meilenstein bearbeiten' : 'Neuer Meilenstein'}</h3>
        <div className="field-grid">
          <div className="field">
            <label>Titel</label>
            <input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z.B. Echtlauf-Start" />
          </div>
          <div className="field">
            <label>Datum</label>
            <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
          </div>
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as MilestoneStatus)}>
              {MILESTONE_STATUS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field"><label>Verknüpfte Projekte dieses Kunden</label><LinkChipsField ids={projectIds} items={customerProjects} labelFn={(item) => item.name} placeholder="— Weiteres Projekt auswählen —" onChange={(ids) => { if (ids.length) setProjectIds(ids); }} /></div>
        <div className="field">
          <label>Notiz</label>
          <RtfField value={notiz} onChange={setNotiz} title="Notiz" placeholder="Klicken, um eine Notiz zu erfassen…" />
        </div>
        <div className="btn-row">
          <button className="btn" onClick={handleSave}>
            {editObj ? 'Speichern' : 'Hinzufügen'}
          </button>
          <button className="btn secondary" onClick={() => { setEditingMilestone(null); setShowForm(false); resetForm(); }}>Abbrechen</button>
        </div>
      </div></div></div>}
      <div className="section-title">Zeitplan</div>
      {sorted.length === 0 ? (
        <div className="empty-state">
          <h3>Noch kein Zeitplan</h3>
          <div>Lege Meilensteine für den Echtlauf an, z.B. Testphase, Schulung, Echtlauf-Start.</div>
        </div>
      ) : (
        <div className="timeline">
          {sorted.map((m) => (
            <div className={`timeline-item ${slug(m.status)}`} key={m.id}>
              <div className="t-date">{fmtDate(m.datum)}</div>
              <div className="t-title">
                {m.titel} <span className={`badge ${slug(m.status)}`}>{m.status}</span>
              </div>
              {(m.projectIds?.length || 0) > 1 && <div className="meta">Synchron in: {m.projectIds?.map((id) => projects.find((item) => item.id === id)?.name).filter(Boolean).join(', ')}</div>}
              {!isEmptyHtml(m.notiz) && (
                <div className="rtf-content rtf-field-preview-compact" dangerouslySetInnerHTML={{ __html: m.notiz }} />
              )}
              <div className="btn-row" style={{ marginTop: 6 }}>
                <button className="icon-btn edit" onClick={() => startEdit(m)}>
                  Bearbeiten
                </button>
                <button className="icon-btn" onClick={() => handleDelete(m.id)}>
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
