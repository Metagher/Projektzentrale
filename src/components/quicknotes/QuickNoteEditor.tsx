import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { normalizeRichTextTypography } from '../../lib/richText';
import { isEmptyHtml } from '../../lib/format';
import { useQuickNoteStore } from '../../store/quickNoteStore';
import InkPad from '../shared/InkPad';
import QuickNoteMoveForm from './QuickNoteMoveForm';
import type { QuickNote } from '../../types/entities';

/** Die eigentliche Schreibfläche einer Schnellnotiz: Text + Handschrift wie im RTF-Editor,
 * aber als eigene Seite statt als Modal und mit Autosave statt Speichern-Knopf — damit sich
 * das Mitschreiben auf dem iPad so nah wie möglich wie in OneNote anfühlt. Pro Notiz neu
 * gemountet (key={note.id} im Elternteil), damit kein Sync-Aufwand zwischen Notizwechseln nötig ist. */
export default function QuickNoteEditor({ note }: { note: QuickNote }) {
  const save = useQuickNoteStore((s) => s.save);
  const remove = useQuickNoteStore((s) => s.remove);
  const select = useQuickNoteStore((s) => s.select);

  const editableRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const latestHtml = useRef(note.inhalt);
  const saveTimer = useRef<number | null>(null);
  const skipCleanup = useRef(false);
  const [inkOpen, setInkOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [moving, setMoving] = useState(false);
  // Referenziell stabil halten: sonst würde jeder Re-Render (z.B. beim Umschalten in den
  // Zeichenmodus) React veranlassen, den contentEditable-Inhalt wieder auf note.inhalt
  // zurückzusetzen und frisch eingefügte Handschrift/Text zu verwerfen (siehe RtfEditorModal).
  const initialHtmlProp = useMemo(() => ({ __html: note.inhalt }), [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    editableRef.current?.focus();
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      if (skipCleanup.current) return;
      if (isEmptyHtml(latestHtml.current)) void remove(note.id);
      else void save(note.id, latestHtml.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scheduleSave() {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void save(note.id, latestHtml.current), 700);
  }

  function handleInput() {
    latestHtml.current = editableRef.current?.innerHTML || '';
    scheduleSave();
  }

  function exec(cmd: string, val?: string) {
    document.execCommand(cmd, false, val);
    editableRef.current?.focus();
    handleInput();
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
    handleInput();
  }

  function insertImageFile(file: File, range: Range) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const img = document.createElement('img');
      img.src = reader.result;
      img.alt = file.name || 'Bild';
      img.style.maxWidth = '100%';
      img.style.display = 'block';
      img.style.margin = '6px 0';
      range.insertNode(img);
      range.setStartAfter(img);
      range.collapse(true);
      handleInput();
    };
    reader.readAsDataURL(file);
  }

  function rangeAtDropPoint(editable: HTMLDivElement, x: number, y: number): Range {
    const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
    let range: Range | null = doc.caretRangeFromPoint ? doc.caretRangeFromPoint(x, y) : null;
    if (!range || !editable.contains(range.startContainer)) {
      range = document.createRange();
      range.selectNodeContents(editable);
      range.collapse(false);
    }
    return range;
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
    if (pastedHtml) exec('insertHTML', normalizeRichTextTypography(pastedHtml));
    else exec('insertText', clipboard.getData('text/plain'));
  }

  async function handleDelete() {
    skipCleanup.current = true;
    select(null);
    await remove(note.id);
  }

  function handleMoved() {
    skipCleanup.current = true;
    select(null);
  }

  return (
    <div className={`quick-note-editor${inkOpen ? ' ink-fullscreen' : ''}`}>
      <div className="rtf-toolbar quick-note-toolbar">
        <button type="button" className="rtf-btn rtf-heading" onMouseDown={(e) => { e.preventDefault(); exec('formatBlock', 'H4'); }}>Überschrift</button>
        <button type="button" className="rtf-btn" onMouseDown={(e) => { e.preventDefault(); exec('formatBlock', 'P'); }}>Text</button>
        <span className="rtf-sep" />
        <button type="button" className="rtf-btn" onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}><b>F</b></button>
        <button type="button" className="rtf-btn" onMouseDown={(e) => { e.preventDefault(); exec('italic'); }}><i>K</i></button>
        <button type="button" className="rtf-btn" onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }}>• Liste</button>
        <span className="rtf-sep" />
        <button type="button" className={`rtf-btn${inkOpen ? ' active' : ''}`} onMouseDown={(e) => { e.preventDefault(); if (inkOpen) setInkOpen(false); else openInk(); }}>✎ Handschrift</button>
        <span className="quick-note-toolbar-spacer" />
        <button type="button" className="btn secondary small" onClick={() => setMoving(true)}>→ Verschieben</button>
        <button type="button" className="icon-btn" onClick={() => void handleDelete()}>Löschen</button>
      </div>
      {inkOpen && <InkPad onInsert={insertInk} onCancel={() => setInkOpen(false)} />}
      <div
        className={`rtf-editor rtf-content quick-note-canvas${dragOver ? ' drag-over' : ''}`}
        style={inkOpen ? { display: 'none' } : undefined}
        contentEditable
        suppressContentEditableWarning
        ref={editableRef}
        onInput={handleInput}
        onPaste={handlePaste}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        dangerouslySetInnerHTML={initialHtmlProp}
      />
      {moving && <QuickNoteMoveForm note={{ ...note, inhalt: latestHtml.current }} onClose={() => setMoving(false)} onMoved={handleMoved} />}
    </div>
  );
}
