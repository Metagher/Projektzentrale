import { useEffect, useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import { useQuickNoteStore } from '../../store/quickNoteStore';
import { commLinkLabel, fmtDate, htmlToPlainText, isEmptyHtml, taskLinkLabel, todayStr, uid } from '../../lib/format';
import { CHANNELS } from '../../lib/constants';
import { contactLinkLabel } from '../../lib/contacts';
import type { Contact, Kanal, ProjectCache, QuickNote, Task } from '../../types/entities';

type MoveTarget = 'task' | 'comm' | 'note';
type MoveMode = 'new' | 'existing';

function defaultTitle(note: QuickNote): string {
  const firstLine = htmlToPlainText(note.inhalt).split('\n')[0]?.trim();
  return firstLine ? firstLine.slice(0, 120) : `Schnellnotiz vom ${fmtDate(todayStr())}`;
}

/** Hängt eine Schnellnotiz als neuen Verlaufseintrag an eine vorhandene Aufgabe an — statt
 * jeder Verlaufslogik hier eine Kopie des Musters aus TaskProgressHistoryField. */
function appendToVerlauf(task: Task, inhalt: string): Task {
  const now = new Date().toISOString();
  return { ...task, verlauf: [...(task.verlauf || []), { id: uid(), datum: todayStr(), titel: 'Schnellnotiz', content: inhalt, createdAt: now, updatedAt: now }] };
}

/** Hängt HTML-Inhalt lesbar an ein bestehendes Rich-Text-Feld an (Kommunikations-Notiz). */
function appendHtml(existing: string, addition: string): string {
  return isEmptyHtml(existing) ? addition : `${existing}<hr />${addition}`;
}

/** Übernimmt den Inhalt einer Schnellnotiz entweder in eine neue oder eine bereits vorhandene
 * Aufgabe/Kommunikation/Projektnotiz des gewählten Projekts und entfernt die Schnellnotiz danach
 * (Verschieben, kein Kopieren). Bei einer bestehenden Aufgabe wird die Notiz als neuer
 * Verlaufseintrag angehängt, bei Kommunikation/Projektnotiz an die bestehende Notiz/den
 * bestehenden Inhalt. Projektnotizen sind reiner Text, daher geht Handschrift dabei verloren
 * — die Nutzerin wird in diesem Fall darauf hingewiesen. */
export default function QuickNoteMoveForm({ note, onClose, onMoved }: { note: QuickNote; onClose: () => void; onMoved: () => void }) {
  const projects = useDataStore((s) => s.projects) || [];
  const ensureProjectData = useDataStore((s) => s.ensureProjectData);
  const createTask = useDataStore((s) => s.createTask);
  const saveTask = useDataStore((s) => s.saveTask);
  const saveComm = useDataStore((s) => s.saveComm);
  const saveProjectNote = useDataStore((s) => s.saveProjectNote);
  const removeQuickNote = useQuickNoteStore((s) => s.remove);
  const alert = useModalStore((s) => s.alert);

  const [target, setTarget] = useState<MoveTarget>('task');
  const [mode, setMode] = useState<MoveMode>('new');
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [projectData, setProjectData] = useState<ProjectCache | null>(null);
  const [existingId, setExistingId] = useState('');
  const [kanal, setKanal] = useState<Kanal>(CHANNELS[0]);
  const [kontaktId, setKontaktId] = useState('');
  const [titel, setTitel] = useState(() => defaultTitle(note));
  const [saving, setSaving] = useState(false);
  const containsInk = /<img[\s>]/i.test(note.inhalt);

  useEffect(() => {
    if (!projectId) { setProjectData(null); return; }
    let cancelled = false;
    ensureProjectData(projectId).then((data) => { if (!cancelled) setProjectData(data); });
    return () => { cancelled = true; };
  }, [projectId, ensureProjectData]);

  const contacts: Contact[] = projectData?.contacts || [];
  const existingTasks = (projectData?.tasks || []).slice().sort((a, b) => b.nr - a.nr);
  const existingComms = (projectData?.comms || []).slice().sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));
  const existingNotes = (projectData?.notes || []).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const existingList: { id: string; label: string }[] =
    target === 'task' ? existingTasks.map((t) => ({ id: t.id, label: taskLinkLabel(t) }))
      : target === 'comm' ? existingComms.map((c) => ({ id: c.id, label: commLinkLabel(c) }))
      : existingNotes.map((n) => ({ id: n.id, label: n.titel }));

  // Ziel/Projekt/Modus wechseln ⇒ Auswahl für "bestehenden Eintrag" zurücksetzen, da die Liste
  // sich jedes Mal ändert; im Existierend-Modus direkt den ersten Treffer vorauswählen.
  useEffect(() => {
    setExistingId(mode === 'existing' ? existingList[0]?.id || '' : '');
    setKontaktId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, projectId, mode]);

  async function handleMove() {
    if (!projectId) { await alert('Bitte ein Projekt auswählen.'); return; }
    if (mode === 'existing' && !existingId) { await alert('Bitte einen vorhandenen Eintrag auswählen.'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (target === 'task') {
        if (mode === 'existing') {
          const existing = existingTasks.find((t) => t.id === existingId);
          if (!existing) throw new Error('Aufgabe nicht gefunden.');
          await saveTask(projectId, appendToVerlauf(existing, note.inhalt));
        } else {
          await createTask(projectId, {
            titel: titel.trim() || defaultTitle(note),
            faelligAm: '',
            status: 'offen',
            wartetAuf: '',
            kontaktId: '',
            verlauf: [{ id: uid(), datum: todayStr(), titel: 'Schnellnotiz', content: note.inhalt, createdAt: now, updatedAt: now }],
            afns: [],
            commIds: [],
            doku: false,
            dokuErledigt: false,
            dokuZiel: '',
          });
        }
      } else if (target === 'comm') {
        if (mode === 'existing') {
          const existing = existingComms.find((c) => c.id === existingId);
          if (!existing) throw new Error('Kommunikationseintrag nicht gefunden.');
          await saveComm(projectId, { ...existing, notiz: appendHtml(existing.notiz, note.inhalt) });
        } else {
          await saveComm(projectId, {
            id: uid(),
            datum: todayStr(),
            kanal,
            kontaktId,
            betreff: titel.trim() || defaultTitle(note),
            notiz: note.inhalt,
            afns: [],
            taskIds: [],
          });
        }
      } else {
        if (mode === 'existing') {
          const existing = existingNotes.find((n) => n.id === existingId);
          if (!existing) throw new Error('Projektnotiz nicht gefunden.');
          const addition = htmlToPlainText(note.inhalt);
          await saveProjectNote(projectId, { ...existing, inhalt: existing.inhalt ? `${existing.inhalt}\n\n${addition}` : addition, updatedAt: now });
        } else {
          await saveProjectNote(projectId, {
            id: uid(),
            titel: titel.trim() || defaultTitle(note),
            inhalt: htmlToPlainText(note.inhalt),
            folderId: null,
            sortIndex: 999,
            global: false,
            pinned: false,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
      await removeQuickNote(note.id);
      onMoved();
    } catch (err) {
      await alert(`Verschieben fehlgeschlagen. (${(err as Error).message})`);
    }
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-box quick-note-move-box" onMouseDown={(e) => e.stopPropagation()}>
        <h3>Notiz verschieben</h3>
        <div className="field">
          <label>Ziel</label>
          <div className="quick-note-move-target">
            <button type="button" className={target === 'task' ? 'active' : ''} onClick={() => setTarget('task')}>Aufgabe</button>
            <button type="button" className={target === 'comm' ? 'active' : ''} onClick={() => setTarget('comm')}>Kommunikation</button>
            <button type="button" className={target === 'note' ? 'active' : ''} onClick={() => setTarget('note')}>Projektnotiz</button>
          </div>
        </div>
        <div className="field">
          <label>Projekt</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.kunde && project.kunde !== project.name ? `${project.name} · ${project.kunde}` : project.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Vorgehen</label>
          <div className="quick-note-move-target">
            <button type="button" className={mode === 'new' ? 'active' : ''} onClick={() => setMode('new')}>Neu anlegen</button>
            <button type="button" className={mode === 'existing' ? 'active' : ''} onClick={() => setMode('existing')}>An bestehenden Eintrag anhängen</button>
          </div>
        </div>
        {mode === 'existing' ? (
          <div className="field">
            <label>{target === 'task' ? 'Aufgabe' : target === 'comm' ? 'Kommunikationseintrag' : 'Projektnotiz'}</label>
            {existingList.length === 0 ? (
              <div className="quick-note-move-hint">Keine {target === 'task' ? 'Aufgaben' : target === 'comm' ? 'Kommunikationseinträge' : 'Projektnotizen'} in diesem Projekt vorhanden.</div>
            ) : (
              <select value={existingId} onChange={(e) => setExistingId(e.target.value)}>
                {existingList.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            )}
          </div>
        ) : (
          <>
            {target === 'comm' && (
              <>
                <div className="field">
                  <label>Kanal</label>
                  <select value={kanal} onChange={(e) => setKanal(e.target.value as Kanal)}>
                    {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Ansprechpartner (optional)</label>
                  <select value={kontaktId} onChange={(e) => setKontaktId(e.target.value)}>
                    <option value="">— ohne —</option>
                    {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contactLinkLabel(contact)}</option>)}
                  </select>
                </div>
              </>
            )}
            <div className="field">
              <label>{target === 'comm' ? 'Betreff' : 'Titel'}</label>
              <input value={titel} onChange={(e) => setTitel(e.target.value)} autoFocus />
            </div>
          </>
        )}
        {target === 'note' && containsInk && (
          <p className="quick-note-move-hint">Projektnotizen sind reiner Text — Handschrift/Bilder aus dieser Notiz werden dabei nicht übernommen, nur der Text.</p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>Abbrechen</button>
          <button type="button" className="btn" disabled={saving || !projectId || (mode === 'existing' && !existingId)} onClick={() => void handleMove()}>Verschieben</button>
        </div>
      </div>
    </div>
  );
}
