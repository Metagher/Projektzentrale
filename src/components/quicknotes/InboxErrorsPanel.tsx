import { useState } from 'react';
import { useInboxStore, openInboxResult } from '../../store/inboxStore';
import { peekInboxTyp } from '../../lib/inboxFormat';
import { fmtDateTime } from '../../lib/format';

const TYP_LABELS: Record<string, string> = {
  aufgabe: 'Aufgabe', kommunikation: 'Kommunikation', notiz: 'Notiz', kontakt: 'Kontakt', aenderung: 'Änderung',
};

/** Posteingang-Zeilen, die Aufmerksamkeit brauchen: entweder komplett fehlgeschlagen (nichts
 * angelegt/geändert — korrigierbar, erneut versuchbar, löschbar) oder mit Warnung verarbeitet
 * (der Eintrag wurde trotzdem angelegt/geändert, z.B. weil ein Kontaktname nicht eindeutig war —
 * hier gibt es nur "Öffnen" und "Verwerfen", ein erneuter Versuch würde doppelt anlegen). Sauber
 * verarbeitete Zeilen ohne Warnung tauchen hier nie auf, die werden kurz danach automatisch
 * aufgeräumt (siehe inboxStore). */
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
          <h3>Einträge mit Hinweis</h3>
          <p>Fehlgeschlagene Einträge korrigieren, erneut versuchen oder löschen — bereits angelegte Einträge mit Warnung nur ansehen oder verwerfen.</p>
        </div>
      </header>
      <div className="inbox-error-list">
        {errorItems.map((item) => {
          const isWarning = item.status === 'warnung';
          return (
            <article className={`inbox-error-item${isWarning ? ' is-warning' : ''}`} key={item.id}>
              <header className="inbox-error-head">
                <span className={`badge inbox-badge-typ${isWarning ? ' inbox-badge-warning' : ''}`}>
                  {isWarning ? 'Warnung' : 'Fehler'} · {TYP_LABELS[peekInboxTyp(item.content)] || 'Text'}
                </span>
                {item.source && <span className="badge inbox-badge-source">{item.source}</span>}
                <small>{fmtDateTime(item.created_at)}</small>
              </header>
              <p className="inbox-error-message">{item.error_message}</p>
              {isWarning ? (
                <div className="btn-row">
                  {item.result && (
                    <button type="button" className="btn small" onClick={() => item.result && openInboxResult(item.result)}>Öffnen</button>
                  )}
                  <button type="button" className="icon-btn" onClick={() => void discard(item.id)}>Verwerfen</button>
                </div>
              ) : editingId === item.id ? (
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
          );
        })}
      </div>
    </section>
  );
}
