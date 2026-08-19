import { useEffect, useRef, type ClipboardEvent } from 'react';
import { normalizeRichTextTypography } from '../../lib/richText';

interface Props {
  title: string;
  initialHtml: string;
  onCancel: () => void;
  onSave: (html: string) => void;
}

export default function RtfEditorModal({ title, initialHtml, onCancel, onSave }: Props) {
  const editableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    editableRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(cmd: string, val?: string) {
    document.execCommand(cmd, false, val);
    editableRef.current?.focus();
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const clipboard = event.clipboardData;
    const pastedHtml = clipboard.getData('text/html');
    if (pastedHtml) {
      exec('insertHTML', normalizeRichTextTypography(pastedHtml));
      return;
    }
    exec('insertText', clipboard.getData('text/plain'));
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box rtf-modal">
        <h3>{title}</h3>
        <div className="rtf-toolbar">
          <button
            type="button"
            className="rtf-btn rtf-heading"
            onMouseDown={(e) => {
              e.preventDefault();
              exec('formatBlock', 'H4');
            }}
          >
            Überschrift
          </button>
          <button
            type="button"
            className="rtf-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              exec('formatBlock', 'P');
            }}
          >
            Text
          </button>
          <span className="rtf-sep" />
          <button
            type="button"
            className="rtf-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              exec('bold');
            }}
          >
            <b>F</b>
          </button>
          <button
            type="button"
            className="rtf-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              exec('italic');
            }}
          >
            <i>K</i>
          </button>
          <button
            type="button"
            className="rtf-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              exec('insertUnorderedList');
            }}
          >
            • Liste
          </button>
        </div>
        <div
          className="rtf-editor rtf-content"
          contentEditable
          suppressContentEditableWarning
          ref={editableRef}
          onPaste={handlePaste}
          dangerouslySetInnerHTML={{ __html: initialHtml || '' }}
        />
        <div className="modal-actions">
          <button className="btn secondary" onClick={onCancel}>
            Abbrechen
          </button>
          <button className="btn" onClick={() => onSave(normalizeRichTextTypography((editableRef.current?.innerHTML || '').trim()))}>
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  );
}
