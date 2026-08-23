import { useState } from 'react';
import { useDataStore } from '../../../store/dataStore';
import { useProjectUiStore } from '../../../store/projectUiStore';
import { useModalStore } from '../../../store/modalStore';
import { useAiStore } from '../../../store/aiStore';
import { CHANNELS } from '../../../lib/constants';
import { escapeHtml, fmtDate, htmlToPlainText, isEmptyHtml, taskLinkLabel, todayStr, uid } from '../../../lib/format';
import { extractTasksFromComm } from '../../../lib/ai';
import RtfField from '../../shared/RtfField';
import AfnChipsField from '../../shared/AfnChipsField';
import AfnChipsView from '../../shared/AfnChipsView';
import LinkChipsField from '../../shared/LinkChipsField';
import LinkChipsView from '../../shared/LinkChipsView';
import type { Comm, Kanal, ProjectCache } from '../../../types/entities';

export default function KommunikationTab({ projectId, data }: { projectId: string; data: ProjectCache }) {
  const saveComm = useDataStore((s) => s.saveComm);
  const deleteComm = useDataStore((s) => s.deleteComm);
  const syncTaskLinksForComm = useDataStore((s) => s.syncTaskLinksForComm);
  const createTask = useDataStore((s) => s.createTask);
  const saveTask = useDataStore((s) => s.saveTask);
  const keyPresent = useAiStore((s) => s.keyPresent);
  const { editingComm, setEditingComm, showNewCommForm, setShowNewCommForm, jumpToTask } = useProjectUiStore();
  const confirm = useModalStore((s) => s.confirm);
  const alert = useModalStore((s) => s.alert);
  const taskExtractionReview = useModalStore((s) => s.taskExtractionReview);
  const [extractingId, setExtractingId] = useState<string | null>(null);

  const editObj = editingComm ? data.comms.find((c) => c.id === editingComm) : null;
  const showForm = !!editObj || showNewCommForm;
  const meetingTasks = data.tasks.filter((task) => task.naechsteBesprechung)
    .sort((a, b) => Number(a.status === 'erledigt') - Number(b.status === 'erledigt') || a.nr - b.nr);

  const [datum, setDatum] = useState(editObj?.datum || todayStr());
  const [kanal, setKanal] = useState<Kanal>(editObj?.kanal || CHANNELS[0]);
  const [kontaktId, setKontaktId] = useState(editObj?.kontaktId || '');
  const [betreff, setBetreff] = useState(editObj?.betreff || '');
  const [notiz, setNotiz] = useState(editObj?.notiz || '');
  const [afns, setAfns] = useState<string[]>(editObj?.afns || []);
  const [taskIds, setTaskIds] = useState<string[]>(editObj?.taskIds || []);
  const [teilprojekt, setTeilprojekt] = useState(editObj?.teilprojekt || '');
  const teilprojekte = Array.from(new Set([
    ...data.tasks.map((task) => task.teilprojekt?.trim()),
    ...data.comms.map((comm) => comm.teilprojekt?.trim()),
  ].filter((value): value is string => !!value))).sort((a, b) => a.localeCompare(b, 'de'));

  function resetForm() {
    setDatum(todayStr());
    setKanal(CHANNELS[0]);
    setKontaktId('');
    setBetreff('');
    setNotiz('');
    setAfns([]);
    setTaskIds([]);
    setTeilprojekt('');
  }

  function startEdit(c: Comm) {
    setEditingComm(c.id);
    setDatum(c.datum);
    setKanal(c.kanal);
    setKontaktId(c.kontaktId);
    setBetreff(c.betreff);
    setNotiz(c.notiz);
    setAfns(c.afns || []);
    setTaskIds(c.taskIds || []);
    setTeilprojekt(c.teilprojekt || '');
  }

  async function handleSave() {
    const comm: Comm = {
      id: editObj ? editObj.id : uid(),
      datum: datum || todayStr(),
      kanal,
      kontaktId,
      betreff: betreff.trim(),
      notiz,
      afns,
      taskIds,
      teilprojekt: teilprojekt.trim(),
    };
    const prevTaskIds = editObj?.taskIds || [];
    await saveComm(projectId, comm);
    await syncTaskLinksForComm(projectId, comm.id, prevTaskIds, taskIds);
    setEditingComm(null);
    setShowNewCommForm(false);
    resetForm();
  }

  async function handleDelete(c: Comm) {
    const sure = await confirm('Diesen Eintrag löschen?');
    if (!sure) return;
    await deleteComm(projectId, c.id);
    await syncTaskLinksForComm(projectId, c.id, c.taskIds || [], []);
  }

  async function handleExtractTasks(c: Comm) {
    setExtractingId(c.id);
    try {
      const contact = data.contacts.find((x) => x.id === c.kontaktId);
      const extracted = await extractTasksFromComm(c, contact?.name, todayStr(), htmlToPlainText);
      const selected = await taskExtractionReview(extracted);
      if (selected && selected.length) {
        const newTaskIds: string[] = [];
        for (const t of selected) {
          const newId = await createTask(projectId, {
            titel: t.titel,
            faelligAm: t.faelligAm,
            status: 'offen',
            wartetAuf: '',
            wartetSeit: '',
            kontaktId: c.kontaktId || '',
            anforderung: t.beschreibung ? `<p>${escapeHtml(t.beschreibung)}</p>` : '',
            aktuellerStand: '',
            verlauf: [],
            afns: (c.afns || []).slice(),
            commIds: [c.id],
            doku: false,
            dokuErledigt: false,
            naechsteBesprechung: false,
            teilprojekt: c.teilprojekt || '',
          });
          newTaskIds.push(newId);
        }
        await saveComm(projectId, { ...c, taskIds: Array.from(new Set([...(c.taskIds || []), ...newTaskIds])) });
      }
    } catch (err) {
      await alert(`Aufgaben konnten nicht erkannt werden. (${(err as Error).message})`);
    }
    setExtractingId(null);
  }

  const sorted = data.comms.slice().sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));

  return (
    <>
      <section className="meeting-agenda">
        <header><div><span className="eyebrow">Nächste Besprechung</span><h3>Vorgemerkte Aufgaben</h3><p>Gesprächspunkte, die direkt an den Aufgaben markiert wurden.</p></div><strong>{meetingTasks.length}</strong></header>
        {meetingTasks.length === 0 ? <div className="meeting-agenda-empty">Noch keine Aufgaben für die nächste Besprechung vorgemerkt.</div> : <div>{meetingTasks.map((task) => <article key={task.id}>
          <button type="button" className="meeting-agenda-task" onClick={() => jumpToTask(task.id)}><span className="task-nr">{task.nr || '—'}</span><strong>{task.titel}</strong><small>{task.status}{task.teilprojekt?.trim() ? ` · ${task.teilprojekt.trim()}` : ''}{task.faelligAm ? ` · fällig ${fmtDate(task.faelligAm)}` : ''}</small></button>
          <button type="button" className="icon-btn" onClick={() => void saveTask(projectId, { ...task, naechsteBesprechung: false })}>Vormerkung entfernen</button>
        </article>)}</div>}
      </section>
      {showForm ? (
        <div className="task-edit-overlay" role="dialog" aria-modal="true" aria-label={editObj ? 'Kommunikation bearbeiten' : 'Kommunikation anlegen'}><div className="task-edit-dialog"><div className="task-edit-dialog-head"><div><span>Kommunikation</span><strong>{editObj ? editObj.betreff || 'Eintrag bearbeiten' : 'Neuer Kommunikationseintrag'}</strong></div></div><div className="card">
          <div className="top-row" style={{ marginBottom: 10 }}>
            <h3 style={{ fontSize: 15 }}>{editObj ? 'Eintrag bearbeiten' : 'Neuer Kommunikationseintrag'}</h3>
            {!editObj && (
              <button className="icon-btn" onClick={() => setShowNewCommForm(false)}>
                Einklappen
              </button>
            )}
          </div>
          <div className="field-grid">
            <div className="field">
              <label>Datum</label>
              <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
            </div>
            <div className="field">
              <label>Kanal</label>
              <select value={kanal} onChange={(e) => setKanal(e.target.value as Kanal)}>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Ansprechpartner</label>
              <select className="contact-select" value={kontaktId} onChange={(e) => setKontaktId(e.target.value)}>
                <option value="">— kein Ansprechpartner —</option>
                {data.contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.rolle ? ` (${c.rolle})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Betreff</label>
              <input value={betreff} onChange={(e) => setBetreff(e.target.value)} />
            </div>
            <div className="field">
              <label>Teilprojekt</label>
              <input
                value={teilprojekt}
                onChange={(e) => setTeilprojekt(e.target.value)}
                list={`kommunikation-teilprojekte-${projectId}`}
                placeholder="Teilprojekt neu eingeben oder auswählen"
              />
              <datalist id={`kommunikation-teilprojekte-${projectId}`}>
                {teilprojekte.map((name) => <option key={name} value={name} />)}
              </datalist>
            </div>
          </div>
          <div className="field">
            <label>Notiz / Zusammenfassung</label>
            <RtfField value={notiz} onChange={setNotiz} title="Notiz / Zusammenfassung" placeholder="Klicken, um eine Notiz zu erfassen…" />
          </div>
          <div className="field">
            <label>AFN-Nummer(n)</label>
            <AfnChipsField value={afns} onChange={setAfns} />
          </div>
          <div className="field">
            <label>Verknüpfte Aufgaben</label>
            <LinkChipsField
              ids={taskIds}
              items={data.tasks}
              labelFn={taskLinkLabel}
              placeholder="— Aufgabe auswählen —"
              onChange={setTaskIds}
            />
          </div>
          {data.contacts.length === 0 && (
            <div className="contact-empty-note">Tipp: Lege zuerst Ansprechpartner an, um sie hier auszuwählen.</div>
          )}
          <div className="btn-row">
            <button className="btn" onClick={handleSave}>
              {editObj ? 'Speichern' : 'Hinzufügen'}
            </button>
            {editObj && (
              <button
                className="btn secondary"
                onClick={() => {
                  setEditingComm(null);
                  resetForm();
                }}
              >
                Abbrechen
              </button>
            )}
          </div>
        </div></div></div>
      ) : (
        <button className="btn secondary" style={{ marginBottom: 14 }} onClick={() => setShowNewCommForm(true)}>
          + Neuer Kommunikationseintrag
        </button>
      )}
      <div className="section-title">Verlauf ({data.comms.length})</div>
      {sorted.length === 0 ? (
        <div className="empty-state">
          <h3>Noch keine Einträge</h3>
          <div>Dokumentiere hier Teams-Chats, Anrufe, Mails und mehr.</div>
        </div>
      ) : (
        sorted.map((c) => {
          const contact = data.contacts.find((x) => x.id === c.kontaktId);
          return (
            <div className="list-item" key={c.id}>
              <div className="top-row">
                <div>
                  <span className="channel-tag">{c.kanal}</span> <span className="meta mono">{fmtDate(c.datum)}</span>
                  {contact && <span className="meta">· {contact.name}</span>}
                  {c.teilprojekt?.trim() && <span className="badge teilprojekt" style={{ marginLeft: 6 }}>{c.teilprojekt.trim()}</span>}
                  {c.afns && c.afns.length > 0 && <AfnChipsView afns={c.afns} />}
                  <div style={{ marginTop: 5 }}>
                    <strong>{c.betreff || '(kein Betreff)'}</strong>
                  </div>
                  {!isEmptyHtml(c.notiz) && (
                    <div
                      className="rtf-content rtf-field-preview-compact"
                      style={{ marginTop: 3 }}
                      dangerouslySetInnerHTML={{ __html: c.notiz }}
                    />
                  )}
                  <LinkChipsView ids={c.taskIds} items={data.tasks} labelFn={taskLinkLabel} onJump={jumpToTask} />
                </div>
                <div className="actions">
                  {keyPresent && (
                    <button
                      className="icon-btn edit"
                      title="KI: Aufgaben für Fabian aus diesem Eintrag erkennen"
                      disabled={extractingId === c.id}
                      style={extractingId === c.id ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
                      onClick={() => handleExtractTasks(c)}
                    >
                      {extractingId === c.id ? 'Analysiere…' : '🤖 Aufgaben erkennen'}
                    </button>
                  )}
                  <button className="icon-btn edit" onClick={() => startEdit(c)}>
                    Bearbeiten
                  </button>
                  <button className="icon-btn" onClick={() => handleDelete(c)}>
                    Löschen
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
