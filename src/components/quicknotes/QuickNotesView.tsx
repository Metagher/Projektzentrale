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
  const { notes, selectedId, ensureLoaded, select, create } = useQuickNoteStore();

  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  const sorted = (notes || []).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const selected = sorted.find((note) => note.id === selectedId) || null;

  return (
    <div className="main-inner quick-notes-wrap">
      <div className={`quick-notes-page${selected ? ' has-selection' : ''}`}>
        <aside className="quick-notes-list-pane">
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
              <button
                type="button"
                key={note.id}
                className={`quick-note-list-item${note.id === selectedId ? ' active' : ''}`}
                onClick={() => select(note.id)}
              >
                <span className="quick-note-list-preview">{preview(note)}</span>
                <small>{fmtDateTime(note.updatedAt)}</small>
              </button>
            ))}
          </div>
        </aside>
        <section className="quick-notes-editor-pane">
          {selected ? (
            <>
              <button type="button" className="quick-notes-back" onClick={() => select(null)}>← Notizen</button>
              <QuickNoteEditor key={selected.id} note={selected} />
            </>
          ) : (
            <div className="empty-state"><h3>Keine Notiz ausgewählt</h3><div>Wähle links eine Notiz oder lege eine neue an.</div></div>
          )}
        </section>
      </div>
    </div>
  );
}
