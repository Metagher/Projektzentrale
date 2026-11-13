import { useEffect, useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { useModalStore } from '../../store/modalStore';
import { useQuickNoteStore } from '../../store/quickNoteStore';
import { fmtDate, htmlToPlainText, todayStr, uid } from '../../lib/format';
import { CHANNELS } from '../../lib/constants';
import { contactLinkLabel } from '../../lib/contacts';
import type { Contact, Kanal, QuickNote } from '../../types/entities';

type MoveTarget = 'task' | 'comm' | 'note';

function defaultTitle(note: QuickNote): string {
  const firstLine = htmlToPlainText(note.inhalt).split('\n')[0]?.trim();
  return firstLine ? firstLine.slice(0, 120) : `Schnellnotiz vom ${fmtDate(todayStr())}`;
}

/** Übernimmt den Inhalt einer Schnellnotiz in eine neue Aufgabe, Kommunikation oder
 * Projektnotiz des gewählten Projekts und entfernt die Schnellnotiz danach (Verschieben,
 * kein Kopieren). Projektnotizen sind reiner Text, daher geht Handschrift dabei verloren
 * — die Nutzerin wird in diesem Fall darauf hingewiesen. */
export default function QuickNoteMoveForm({ note, onClose, onMoved }: { note: QuickNote; onClose: () => void; onMoved: () => void }) {
  const projects = useDataStore((s) => s.projects) || [];
  const ensureProjectData = useDataStore((s) => s.ensureProjectData);
  const createTask = useDataStore((s) => s.createTask);
  const saveComm = useDataStore((s) => s.saveComm);
  const saveProjectNote = useDataStore((s) => s.saveProjectNote);
  const removeQuickNote = useQuickNoteStore((s) => s.remove);
  const alert = useModalStore((s) => s.alert);

  const [target, setTarget] = useState<MoveTarget>('task');
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [kanal, setKanal] = useState<Kanal>(CHANNELS[0]);
  const [kontaktId, setKontaktId] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [titel, setTitel] = useState(() => defaultTitle(note));
  const [saving, setSaving] = useState(false);
  const containsInk = /<img[\s>]/i.test(note.inhalt);

  useEffect(() => {
    if (target !== 'comm' || !projectId) { setContacts([]); return; }
    let cancelled = false;
    setKontaktId('');
    ensureProjectData(projectId).then((data) => { if (!cancelled) setContacts(data.contacts); });
    return () => { cancelled = true; };
  }, [target, projectId, ensureProjectData]);

  async function handleMove() {
    if (!projectId) { await alert('Bitte ein Projekt auswählen.'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (target === 'task') {
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
      } else if (target === 'comm') {
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
        {target === 'note' && containsInk && (
          <p className="quick-note-move-hint">Projektnotizen sind reiner Text — Handschrift/Bilder aus dieser Notiz werden dabei nicht übernommen, nur der Text.</p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>Abbrechen</button>
          <button type="button" className="btn" disabled={saving || !projectId} onClick={() => void handleMove()}>Verschieben</button>
        </div>
      </div>
    </div>
  );
}
