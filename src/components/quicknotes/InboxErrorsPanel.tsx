import { useState } from 'react';
import { useInboxStore } from '../../store/inboxStore';
import { peekInboxTyp } from '../../lib/inboxFormat';
import { fmtDateTime } from '../../lib/format';

const TYP_LABELS: Record<string, string> = { aufgabe: 'Aufgabe', kommunikation: 'Kommunikation', notiz: 'Notiz' };

/** Posteingang-Zeilen, die automatisch nicht angelegt werden konnten — z.B. weil das Projekt
 * nicht eindeutig war. Erfolgreich verarbeitete Zeilen tauchen hier nie auf, die werden sofort
 * gelöscht (siehe inboxStore). */
export default function InboxErrorsPanel() {
  const { errorItems, retry, retryWithContent, discard } = useInboxStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  if (errorItems.length === 0) return null;

  function startEdit(id: string, content: string) {
    setEditingId(id);
    setDraft(content);
  }

  return (
    <section className="inbox-errors-panel">
      <header className="module-section-head">
        <div>
          <span className="eyebrow">Posteingang</span>
          <h3>Fehlgeschlagene Einträge</h3>
          <p>Diese extern eingereichten Einträge konnten nicht automatisch angelegt werden — korrigieren, erneut versuchen oder löschen.</p>
        </div>
      </header>
      <div className="inbox-error-list">
        {errorItems.map((item) => (
          <article className="inbox-error-item" key={item.id}>
            <header className="inbox-error-head">
              <span className="badge inbox-badge-typ">{TYP_LABELS[peekInboxTyp(item.content)] || 'Text'}</span>
              {item.source && <span className="badge inbox-badge-source">{item.source}</span>}
              <small>{fmtDateTime(item.created_at)}</small>
            </header>
            <p className="inbox-error-message">{item.error_message}</p>
            {editingId === item.id ? (
              <>
                <textarea className="inbox-error-editor" value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} />
                <div className="btn-row">
                  <button type="button" className="btn small" onClick={() => { void retryWithContent(item.id, draft); setEditingId(null); }}>Speichern & erneut versuchen</button>
                  <button type="button" className="btn secondary small" onClick={() => setEditingId(null)}>Abbrechen</button>
                </div>
              </>
            ) : (
              <>
                <pre className="inbox-error-content">{item.content}</pre>
                <div className="btn-row">
                  <button type="button" className="btn small" onClick={() => void retry(item.id)}>Erneut versuchen</button>
                  <button type="button" className="btn secondary small" onClick={() => startEdit(item.id, item.content)}>Bearbeiten</button>
                  <button type="button" className="icon-btn" onClick={() => void discard(item.id)}>Löschen</button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
