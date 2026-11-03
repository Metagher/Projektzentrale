import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { normalizeRichTextTypography } from '../../lib/richText';
import InkPad from './InkPad';

interface Props {
  title: string;
  initialHtml: string;
  onCancel: () => void;
  onSave: (html: string) => void;
}

export default function RtfEditorModal({ title, initialHtml, onCancel, onSave }: Props) {
  const editableRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [inkOpen, setInkOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Referenziell stabil halten: der Editor bleibt beim Umschalten in den Zeichenmodus gemountet
  // (nur per CSS ausgeblendet), damit Tipp- und Zeichen-Einfügungen erhalten bleiben. Ein neues
  // { __html } -Objekt bei jedem Render würde React sonst veranlassen, den vom Nutzer bereits
  // bearbeiteten Inhalt des contentEditable-Felds wieder auf initialHtml zurückzusetzen.
  const initialHtmlProp = useMemo(() => ({ __html: initialHtml || '' }), [initialHtml]);

  useEffect(() => {
    editableRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(cmd: string, val?: string) {
    document.execCommand(cmd, false, val);
    editableRef.current?.focus();
  }

  function openInk() {
    const selection = window.getSelection();
    savedRange.current = selection && selection.rangeCount > 0 && editableRef.current?.contains(selection.anchorNode)
      ? selection.getRangeAt(0).cloneRange()
      : null;
    setInkOpen(true);
  }

  function insertInk(dataUrl: string, width: number) {
    const editable = editableRef.current;
    setInkOpen(false);
    if (!editable) return;
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = 'Handschrift';
    img.className = 'ink-insert';
    img.style.width = `${width}px`;
    img.style.height = 'auto';
    img.style.maxWidth = '100%';
    img.style.display = 'block';
    img.style.margin = '6px 0';

    // Direkt per DOM-Range eingefügt statt über execCommand/Fokus, weil das Editor-Feld
    // während der Zeichenansicht unsichtbar (aber weiterhin gemountet) ist und ein verstecktes
    // Element nicht zuverlässig fokussiert werden kann.
    const range = savedRange.current;
    if (range && editable.contains(range.startContainer)) {
      range.deleteContents();
      range.insertNode(img);
      range.setStartAfter(img);
      range.collapse(true);
    } else {
      editable.appendChild(img);
    }
    editable.focus();
  }

  function rangeAtDropPoint(editable: HTMLDivElement, x: number, y: number): Range {
    const doc = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    let range: Range | null = null;
    if (doc.caretRangeFromPoint) {
      range = doc.caretRangeFromPoint(x, y);
    } else if (doc.caretPositionFromPoint) {
      const pos = doc.caretPositionFromPoint(x, y);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }
    if (!range || !editable.contains(range.startContainer)) {
      range = document.createRange();
      range.selectNodeContents(editable);
      range.collapse(false);
    }
    return range;
  }

  function insertImageFile(file: File, range: Range) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const img = document.createElement('img');
      img.src = reader.result;
      img.alt = file.name || 'Bild';
      img.className = 'dropped-image';
      img.style.maxWidth = '100%';
      img.style.display = 'block';
      img.style.margin = '6px 0';
      range.insertNode(img);
      range.setStartAfter(img);
      range.collapse(true);
    };
    reader.readAsDataURL(file);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!Array.from(event.dataTransfer.items).some((item) => item.kind === 'file')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/'));
    setDragOver(false);
    if (files.length === 0) return;
    event.preventDefault();
    const editable = editableRef.current;
    if (!editable) return;
    editable.focus();
    const range = rangeAtDropPoint(editable, event.clientX, event.clientY);
    files.forEach((file) => insertImageFile(file, range));
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
    <div className={`modal-overlay${inkOpen ? ' ink-fullscreen' : ''}`}>
      <div className={`modal-box rtf-modal${inkOpen ? ' ink-fullscreen' : ''}`}>
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
          <span className="rtf-sep" />
          <button
            type="button"
            className={`rtf-btn${inkOpen ? ' active' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              if (inkOpen) setInkOpen(false);
              else openInk();
            }}
          >
            ✎ Handschrift
          </button>
        </div>
        {inkOpen && <InkPad onInsert={insertInk} onCancel={() => setInkOpen(false)} />}
        <div
          className={`rtf-editor rtf-content${dragOver ? ' drag-over' : ''}`}
          style={inkOpen ? { display: 'none' } : undefined}
          contentEditable
          suppressContentEditableWarning
          ref={editableRef}
          onPaste={handlePaste}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          dangerouslySetInnerHTML={initialHtmlProp}
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
