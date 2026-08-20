import { useState } from 'react';
import { useDataStore } from '../../../store/dataStore';
import { useProjectUiStore } from '../../../store/projectUiStore';
import { useModalStore } from '../../../store/modalStore';
import { fmtDate, isEmptyHtml, todayStr, uid } from '../../../lib/format';
import RtfField from '../../shared/RtfField';
import AfnChipsField from '../../shared/AfnChipsField';
import AfnChipsView from '../../shared/AfnChipsView';
import type { Project, ProjectCache, UpdateEntry } from '../../../types/entities';

type DeliveryState = 'delivered' | 'current' | 'upcoming' | 'unassigned';

const DELIVERY_LABELS: Record<DeliveryState, string> = {
  delivered: 'Bereits ausgeliefert',
  current: 'Aktuelle Version',
  upcoming: 'Noch ausstehend',
  unassigned: 'Nicht zugeordnet',
};

function compareRevision(revision: string, currentVersion: string): number | null {
  const revisionParts = revision.match(/\d+/g)?.map(Number);
  const currentParts = currentVersion.match(/\d+/g)?.map(Number);
  if (!revisionParts?.length || !currentParts?.length) return null;
  const length = Math.max(revisionParts.length, currentParts.length);
  for (let index = 0; index < length; index += 1) {
    const left = revisionParts[index] || 0;
    const right = currentParts[index] || 0;
    if (left !== right) return left < right ? -1 : 1;
  }
  return 0;
}

function deliveryState(revision: string, currentVersion: string): DeliveryState {
  const comparison = compareRevision(revision, currentVersion);
  if (comparison === null) return 'unassigned';
  if (comparison < 0) return 'delivered';
  if (comparison > 0) return 'upcoming';
  return 'current';
}

export default function UpdateTab({ project, data }: { project: Project; data: ProjectCache }) {
  const saveUpdateEntry = useDataStore((s) => s.saveUpdateEntry);
  const deleteUpdateEntry = useDataStore((s) => s.deleteUpdateEntry);
  const { showNewUpdateForm, setShowNewUpdateForm, editingUpdateId, setEditingUpdateId } = useProjectUiStore();
  const confirm = useModalStore((s) => s.confirm);
  const alert = useModalStore((s) => s.alert);

  const [titel, setTitel] = useState('');
  const [datum, setDatum] = useState(todayStr());
  const [revision, setRevision] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [afns, setAfns] = useState<string[]>([]);

  const editObj = editingUpdateId ? data.updates.find((u) => u.id === editingUpdateId) : null;
  const [editTitel, setEditTitel] = useState('');
  const [editDatum, setEditDatum] = useState('');
  const [editRevision, setEditRevision] = useState('');
  const [editBeschreibung, setEditBeschreibung] = useState('');
  const [editAfns, setEditAfns] = useState<string[]>([]);

  function startEdit(u: UpdateEntry) {
    setEditingUpdateId(u.id);
    setEditTitel(u.titel);
    setEditDatum(u.datum || '');
    setEditRevision(u.revision || '');
    setEditBeschreibung(u.beschreibung || '');
    setEditAfns(u.afns || []);
  }

  async function handleAddNew() {
    const trimmed = titel.trim();
    if (!trimmed) {
      await alert('Bitte einen Titel angeben.');
      return;
    }
    await saveUpdateEntry(project.id, {
      id: uid(),
      titel: trimmed,
      datum: datum || todayStr(),
      revision: revision.trim(),
      beschreibung,
      afns,
    });
    setShowNewUpdateForm(false);
    setTitel('');
    setDatum(todayStr());
    setRevision('');
    setBeschreibung('');
    setAfns([]);
  }

  async function handleSaveEdit() {
    if (!editObj) return;
    const trimmed = editTitel.trim();
    if (!trimmed) {
      await alert('Bitte einen Titel angeben.');
      return;
    }
    await saveUpdateEntry(project.id, {
      ...editObj,
      titel: trimmed,
      datum: editDatum || editObj.datum,
      revision: editRevision.trim(),
      beschreibung: editBeschreibung,
      afns: editAfns,
    });
    setEditingUpdateId(null);
  }

  async function handleDelete(id: string) {
    const sure = await confirm('Diesen Punkt löschen?');
    if (!sure) return;
    await deleteUpdateEntry(project.id, id);
    if (editingUpdateId === id) setEditingUpdateId(null);
  }

  const sortedDesc = data.updates
    .slice()
    .sort((a, b) => (b.datum || '').localeCompare(a.datum || '') || (b.id || '').localeCompare(a.id || ''));
  const deliveryCounts = sortedDesc.reduce<Record<DeliveryState, number>>((counts, entry) => {
    counts[deliveryState(entry.revision, project.aktuelleVersion)] += 1;
    return counts;
  }, { delivered: 0, current: 0, upcoming: 0, unassigned: 0 });

  return (
    <>
      <section className="current-version-card">
        <div><div className="cv-label">Aktuelle RK-Version</div><div className="cv-value">{project.aktuelleVersion || 'Nicht hinterlegt'}</div></div>
        <div className="update-delivery-summary" aria-label="Verteilung der Update-Punkte">
          <span className="delivered"><strong>{deliveryCounts.delivered}</strong> ausgeliefert</span>
          <span className="current"><strong>{deliveryCounts.current}</strong> aktuell</span>
          <span className="upcoming"><strong>{deliveryCounts.upcoming}</strong> ausstehend</span>
          {deliveryCounts.unassigned > 0 && <span className="unassigned"><strong>{deliveryCounts.unassigned}</strong> ohne Zuordnung</span>}
        </div>
      </section>
      {showNewUpdateForm ? (
        <div className="card">
          <div className="top-row" style={{ marginBottom: 10 }}>
            <h3 style={{ fontSize: 15 }}>Neuer Punkt fürs nächste Update</h3>
            <button className="icon-btn" onClick={() => setShowNewUpdateForm(false)}>
              Einklappen
            </button>
          </div>
          <div className="field-grid">
            <div className="field">
              <label>Titel</label>
              <input
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
                placeholder="z.B. Neues Feld Ballaststoffe in PAZ-Übergabe"
              />
            </div>
            <div className="field">
              <label>Datum</label>
              <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
            </div>
            <div className="field">
              <label>Revision</label>
              <input value={revision} onChange={(e) => setRevision(e.target.value)} placeholder="z.B. Rev. 3" />
            </div>
          </div>
          <div className="field">
            <label>Beschreibung</label>
            <RtfField
              value={beschreibung}
              onChange={setBeschreibung}
              title="Beschreibung"
              placeholder="Klicken, um zu beschreiben, worum es geht…"
            />
          </div>
          <div className="field">
            <label>AFN-Nummer(n)</label>
            <AfnChipsField value={afns} onChange={setAfns} />
          </div>
          <div className="btn-row">
            <button className="btn" onClick={handleAddNew}>
              Hinzufügen
            </button>
          </div>
        </div>
      ) : (
        <button className="btn secondary" style={{ marginBottom: 14 }} onClick={() => setShowNewUpdateForm(true)}>
          + Neuer Punkt
        </button>
      )}

      <div className="section-title">Punkte für das nächste Update ({data.updates.length})</div>
      <div className="an-note">
        Sammlung aller Punkte, für die ein Update notwendig wird — so siehst du auf einen Blick, was mit dem nächsten
        Update an Funktionen/Änderungen dazukommt.
      </div>

      {sortedDesc.length === 0 ? (
        <div className="empty-state">
          <h3>Noch keine Punkte erfasst</h3>
          <div>Trage hier Punkte ein, für die ein Update notwendig wird — z.B. neue Felder, Anpassungen oder Fixes.</div>
        </div>
      ) : (
        sortedDesc.map((u) => {
          const state = deliveryState(u.revision, project.aktuelleVersion);
          return (
          u.id === editingUpdateId ? (
            <div className={`update-entry delivery-${state}`} key={u.id}>
              <div className="field-grid">
                <div className="field">
                  <label>Titel</label>
                  <input value={editTitel} onChange={(e) => setEditTitel(e.target.value)} />
                </div>
                <div className="field">
                  <label>Datum</label>
                  <input type="date" value={editDatum} onChange={(e) => setEditDatum(e.target.value)} />
                </div>
                <div className="field">
                  <label>Revision</label>
                  <input value={editRevision} onChange={(e) => setEditRevision(e.target.value)} />
                </div>
              </div>
              <RtfField
                value={editBeschreibung}
                onChange={setEditBeschreibung}
                title="Beschreibung"
                placeholder="Klicken, um zu beschreiben, worum es geht…"
              />
              <AfnChipsField value={editAfns} onChange={setEditAfns} />
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button className="btn small" onClick={handleSaveEdit}>
                  Speichern
                </button>
                <button className="btn secondary small" onClick={() => setEditingUpdateId(null)}>
                  Abbrechen
                </button>
                <button className="btn danger small" style={{ marginLeft: 'auto' }} onClick={() => handleDelete(u.id)}>
                  Löschen
                </button>
              </div>
            </div>
          ) : (
            <div className={`update-entry delivery-${state}`} key={u.id} style={{ cursor: 'pointer' }} onClick={() => startEdit(u)}>
              <div className="update-entry-head">
                <div className="update-step-label">
                  <span className="uv-new">{u.titel}</span>
                  {u.revision && <span className="update-revision-tag">{u.revision}</span>}
                  <span className={`update-delivery-badge ${state}`}>{DELIVERY_LABELS[state]}</span>
                </div>
                <span className="meta mono">{fmtDate(u.datum)}</span>
              </div>
              {u.afns && u.afns.length > 0 && (
                <>
                  <AfnChipsView afns={u.afns} />
                  <br />
                </>
              )}
              {!isEmptyHtml(u.beschreibung) && (
                <div className="rtf-content" style={{ marginTop: 6 }} dangerouslySetInnerHTML={{ __html: u.beschreibung }} />
              )}
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button
                  className="icon-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(u.id);
                  }}
                >
                  Löschen
                </button>
              </div>
            </div>
          ));
        })
      )}
    </>
  );
}
