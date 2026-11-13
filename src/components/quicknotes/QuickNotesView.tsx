import { useEffect } from 'react';
import { useQuickNoteStore } from '../../store/quickNoteStore';
import { fmtDateTime, htmlToPlainText, truncateText } from '../../lib/format';
import QuickNoteEditor from './QuickNoteEditor';
import type { QuickNote } from '../../types/entities';

function preview(note: QuickNote): string {
  const text = htmlToPlainText(note.inhalt);
  if (text) return truncateText(text, 90);
  return /<img[\s>]/i.test(note.inhalt) ? '(Handschrift)' : '(Leer)';
}

export default function QuickNotesView() {
  const { notes, selectedId, justCreatedId, ensureLoaded, importFromInbox, select, create, clearJustCreated } = useQuickNoteStore();

  useEffect(() => {
    // Reihenfolge wichtig: erst laden, dann den Posteingang einsortieren — sonst würde der
    // Import auf einer noch leeren (nicht geladenen) Liste aufsetzen und bestehende Notizen
    // beim Speichern überschreiben.
    (async () => {
      await ensureLoaded();
      await importFromInbox();
    })();
  }, [ensureLoaded, importFromInbox]);

  // Nur frisch über "+ Neue Notiz" angelegte Notizen starten automatisch im Handschrift-Modus
  // (justCreatedId). Einmal an den Editor weitergegeben (per autoInk unten), wird die Markierung
  // wieder gelöscht, damit ein späteres erneutes Öffnen derselben Notiz nicht wieder Handschrift
  // erzwingt.
  useEffect(() => {
    if (justCreatedId !== null) clearJustCreated();
  }, [justCreatedId, clearJustCreated]);

  const sorted = (notes || []).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const selected = sorted.find((note) => note.id === selectedId) || null;

  return (
    <div className="main-inner quick-notes-wrap">
      <header className="module-section-head">
        <div>
          <span className="eyebrow">Schnell erfassen</span>
          <h3>Schnellnotizen</h3>
          <p>Flüchtige Notizen und Handschrift — später per „Verschieben“ einer Aufgabe, Kommunikation oder Projektnotiz zuordnen.</p>
        </div>
        <button type="button" className="btn small" onClick={() => void create()}>+ Neue Notiz</button>
      </header>
      {notes === undefined && <div className="loading-note">Notizen werden geladen…</div>}
      {notes !== undefined && sorted.length === 0 && (
        <div className="empty-state"><h3>Noch keine Schnellnotizen</h3><div>Lege oben eine neue Notiz an und schreib direkt mit Tastatur oder Stift los.</div></div>
      )}
      <div className="quick-notes-list">
        {sorted.map((note) => (
          <button type="button" key={note.id} className="quick-note-list-item" onClick={() => select(note.id)}>
            <span className="quick-note-list-preview">{preview(note)}</span>
            <small>{fmtDateTime(note.updatedAt)}</small>
          </button>
        ))}
      </div>
      {selected && (
        <QuickNoteEditor
          key={selected.id}
          note={selected}
          autoInk={selected.id === justCreatedId}
          onClose={() => select(null)}
        />
      )}
    </div>
  );
}
