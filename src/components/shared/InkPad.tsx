import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useModalStore } from '../../store/modalStore';

interface Props {
  onInsert: (dataUrl: string, width: number) => void;
  onCancel: () => void;
}

export type PaperStyle = 'blank' | 'lines' | 'dots' | 'grid';
type Tool = 'pen' | 'highlighter' | 'eraser';

const PAPER_STYLES: { id: PaperStyle; label: string }[] = [
  { id: 'blank', label: 'Blanko' },
  { id: 'lines', label: 'Linien' },
  { id: 'dots', label: 'Punkte' },
  { id: 'grid', label: 'Kariert' },
];

const HIGHLIGHTER_COLORS = [
  { id: 'yellow', color: '#ffe066', label: 'Gelb' },
  { id: 'green', color: '#69db7c', label: 'Grün' },
  { id: 'pink', color: '#f783ac', label: 'Pink' },
  { id: 'blue', color: '#66b2ff', label: 'Blau' },
];

const PAPER_STYLE_KEY = 'pz-ink-paper-style';
const HIGHLIGHTER_COLOR_KEY = 'pz-ink-highlighter-color';
const GRID_SPACING = 26;
const PEN_COLOR = '#1c1c1c';
const PEN_WIDTH = 2.4;
const HIGHLIGHTER_WIDTH = 14;
const HIGHLIGHTER_ALPHA = 0.35;
const ERASER_WIDTH = 22;
/** Fenster für einen Doppel-Tipp mit dem Stift direkt auf die Fläche (Zeit und Abstand). */
const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_PX = 24;
/** Seite wächst in diesen Schritten nach unten, sobald beim Schreiben dieser Abstand zum
 * aktuellen unteren Rand unterschritten wird — wie das automatische Mitwachsen einer Seite
 * in OneNote, nur dass hier zusätzlich die sichtbare Fläche mitscrollt. */
const GROW_STEP = 500;
const GROW_MARGIN = 140;

function readStoredPaperStyle(): PaperStyle {
  try {
    const value = localStorage.getItem(PAPER_STYLE_KEY);
    if (value === 'blank' || value === 'lines' || value === 'dots' || value === 'grid') return value;
  } catch { /* localStorage unavailable */ }
  return 'blank';
}

function readStoredHighlighterColor(): string {
  try {
    const value = localStorage.getItem(HIGHLIGHTER_COLOR_KEY);
    if (value && HIGHLIGHTER_COLORS.some((c) => c.color === value)) return value;
  } catch { /* localStorage unavailable */ }
  return HIGHLIGHTER_COLORS[0].color;
}

/** Zeichnet den Papier-Hintergrund (wie in OneNote: Blanko/Linien/Punkte/Kariert) auf die eigene
 * Papier-Ebene (siehe unten), damit er — anders als ein CSS-Hintergrund — auch im exportierten
 * PNG erhalten bleibt. */
function paintPaper(ctx: CanvasRenderingContext2D, width: number, height: number, style: PaperStyle) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  if (style === 'lines' || style === 'grid') {
    ctx.strokeStyle = '#d7d7df';
    ctx.lineWidth = 1;
    for (let y = GRID_SPACING; y < height; y += GRID_SPACING) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
      ctx.stroke();
    }
  }
  if (style === 'grid') {
    ctx.strokeStyle = '#d7d7df';
    ctx.lineWidth = 1;
    for (let x = GRID_SPACING; x < width; x += GRID_SPACING) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
    }
  }
  if (style === 'dots') {
    ctx.fillStyle = '#c6c6d0';
    for (let y = GRID_SPACING; y < height; y += GRID_SPACING) {
      for (let x = GRID_SPACING; x < width; x += GRID_SPACING) {
        ctx.beginPath();
        ctx.arc(x, y, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/** Setzt Strich-/Radierbreite, -farbe und -deckkraft passend zum aktiven Werkzeug. Tinte und
 * Papier liegen auf getrennten Ebenen (siehe Komponente) — der Radierer trägt deshalb nicht mehr
 * weiß über das Papier nach, sondern löscht per "destination-out" wirklich nur die Tinte, Linien/
 * Punkte/Karos bleiben erhalten. */
function applyToolStyle(ctx: CanvasRenderingContext2D, tool: Tool, highlighterColor: string) {
  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.globalAlpha = 1;
    ctx.lineWidth = ERASER_WIDTH;
  } else if (tool === 'highlighter') {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = highlighterColor;
    ctx.globalAlpha = HIGHLIGHTER_ALPHA;
    ctx.lineWidth = HIGHLIGHTER_WIDTH;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = PEN_COLOR;
    ctx.globalAlpha = 1;
    ctx.lineWidth = PEN_WIDTH;
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/** Freehand drawing surface for Apple-Pencil / Maus. Anders als ein contentEditable-Feld wird ein
 * <canvas> von iPadOS Scribble nicht angefasst — das Geschriebene bleibt exakt die gezeichnete
 * Linie, statt in Buchstaben erkannt zu werden. Finger (Touch) zeichnet bewusst nicht mit, sondern
 * scrollt ganz normal die Fläche — wie bei Apple Notizen/OneNote ist Zeichnen dem Stift (und der
 * Maus) vorbehalten, sonst lässt sich mit dem Finger nicht mehr blätterbar scrollen, ohne aus
 * Versehen einen Strich zu hinterlassen. Papier und Tinte liegen auf zwei übereinanderliegenden
 * Ebenen, damit der Radierer wirklich nur Tinte entfernt und Linien/Punkte/Karos erhalten bleiben.
 * Der Papierstil (wie in OneNote) und die Textmarker-Farbe werden geräteweit gemerkt, nicht pro
 * Notiz. Werkzeugleiste und Aktionen liegen bewusst komplett über der Fläche, nicht darunter,
 * damit die beim Schreiben aufliegende Hand sie nicht versehentlich trifft. Ein Doppel-Tipp mit
 * dem Stift direkt auf die Fläche schaltet zum Radierer und zurück — der native "zweimal auf den
 * Apple Pencil tippen"-Shortcut ist Web-Seiten nicht zugänglich (eine iPadOS-Funktion nur für
 * native Apps), das hier ist das nächstmögliche Äquivalent. Die Seite ist nicht auf die sichtbare
 * Höhe begrenzt: beim Schreiben nahe dem unteren Rand wächst sie automatisch nach unten weiter
 * (wie in OneNote) und die Ansicht scrollt mit. */
export default function InkPad({ onInsert, onCancel }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paperCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const hasDrawn = useRef(false);
  const strokeMoved = useRef(false);
  const lastPenTap = useRef<{ time: number; x: number; y: number } | null>(null);
  const lastToolRef = useRef<Tool>('pen');
  const ratioRef = useRef(1);
  const canvasHeightRef = useRef(0);
  const [paperStyle, setPaperStyleState] = useState<PaperStyle>(readStoredPaperStyle);
  const [highlighterColor, setHighlighterColorState] = useState<string>(readStoredHighlighterColor);
  const [tool, setTool] = useState<Tool>('pen');

  useEffect(() => {
    const canvas = canvasRef.current;
    const paper = paperCanvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !paper || !wrap) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    ratioRef.current = ratio;
    const width = wrap.clientWidth;
    const height = wrap.clientHeight;
    canvasHeightRef.current = height;
    for (const el of [canvas, paper]) {
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      el.width = width * ratio;
      el.height = height * ratio;
    }
    const paperCtx = paper.getContext('2d');
    if (!paperCtx) return;
    paperCtx.scale(ratio, ratio);
    paintPaper(paperCtx, width, height, paperStyle);
    // Tinten-Ebene startet transparent — nichts zu zeichnen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  /** Hängt bei Bedarf einen weiteren Streifen Papier unten an, ohne die bisherige Zeichnung zu
   * verlieren (ein Resize des <canvas> selbst würde sie sonst löschen — deshalb die Tinte vorher
   * auf ein Hilfscanvas sichern und danach wieder einzeichnen; die Papier-Ebene lässt sich dagegen
   * einfach komplett neu zeichnen). */
  function growIfNeeded(pointerYCss: number) {
    if (pointerYCss < canvasHeightRef.current - GROW_MARGIN) return;
    const canvas = canvasRef.current;
    const paper = paperCanvasRef.current;
    if (!canvas || !paper) return;
    const ratio = ratioRef.current;
    const widthCss = canvas.width / ratio;
    const oldHeightCss = canvasHeightRef.current;
    const newHeightCss = oldHeightCss + GROW_STEP;

    const snapshot = document.createElement('canvas');
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    snapshot.getContext('2d')?.drawImage(canvas, 0, 0);

    for (const el of [canvas, paper]) {
      el.width = widthCss * ratio;
      el.height = newHeightCss * ratio;
      el.style.height = `${newHeightCss}px`;
    }

    const paperCtx = paper.getContext('2d');
    if (paperCtx) {
      paperCtx.scale(ratio, ratio);
      paintPaper(paperCtx, widthCss, newHeightCss, paperStyle);
    }
    const inkCtx = canvas.getContext('2d');
    if (inkCtx) {
      inkCtx.scale(ratio, ratio);
      inkCtx.drawImage(snapshot, 0, 0, widthCss, oldHeightCss);
    }
    canvasHeightRef.current = newHeightCss;
  }

  /** Lässt die Ansicht der Stiftspitze folgen, sobald sie sich dem unteren Rand des sichtbaren
   * Ausschnitts nähert — ohne das muss man zum Weiterschreiben jedes Mal den Stift absetzen und
   * manuell scrollen. */
  function followPointer(pointerYCss: number) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const viewportBottom = wrap.scrollTop + wrap.clientHeight;
    if (pointerYCss > viewportBottom - GROW_MARGIN) wrap.scrollTop = pointerYCss - wrap.clientHeight + GROW_MARGIN;
  }

  function selectTool(next: Tool) {
    setTool(next);
    lastToolRef.current = next;
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    // Finger soll die Fläche nur scrollen (touch-action: pan-y auf dem Canvas erlaubt das nativ),
    // nie zeichnen — sonst lässt sich nicht mehr blätternd scrollen, ohne versehentlich einen
    // Strich zu hinterlassen.
    if (event.pointerType === 'touch') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const point = pointFromEvent(event);

    if (event.pointerType === 'pen' && lastPenTap.current) {
      const elapsed = Date.now() - lastPenTap.current.time;
      const distance = Math.hypot(point.x - lastPenTap.current.x, point.y - lastPenTap.current.y);
      if (elapsed < DOUBLE_TAP_MS && distance < DOUBLE_TAP_PX) {
        setTool((t) => (t === 'eraser' ? lastToolRef.current : 'eraser'));
        lastPenTap.current = null;
        return;
      }
    }

    drawing.current = true;
    strokeMoved.current = false;
    lastPoint.current = point;
    // Scheitert z.B. bei synthetischen Events ohne aktiven Pointer — das Zeichnen selbst
    // braucht die Capture nicht zwingend, nur ein zuverlässigeres Tracking außerhalb der Fläche.
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* kein aktiver Pointer */ }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !lastPoint.current) return;
    const point = pointFromEvent(event);
    growIfNeeded(point.y);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      applyToolStyle(ctx, tool, highlighterColor);
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      hasDrawn.current = true;
      strokeMoved.current = true;
    }
    lastPoint.current = point;
    followPointer(point.y);
  }

  function stopDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    if (event.pointerType === 'pen') {
      lastPenTap.current = !strokeMoved.current && lastPoint.current ? { time: Date.now(), ...lastPoint.current } : null;
    }
    drawing.current = false;
    lastPoint.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* bereits freigegeben */ }
  }

  function redraw(style: PaperStyle) {
    const paper = paperCanvasRef.current;
    const canvas = canvasRef.current;
    if (!paper || !canvas) return;
    const ratio = ratioRef.current;
    const paperCtx = paper.getContext('2d');
    if (paperCtx) paintPaper(paperCtx, paper.width / ratio, paper.height / ratio, style);
    const inkCtx = canvas.getContext('2d');
    if (inkCtx) inkCtx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    hasDrawn.current = false;
  }

  /** Setzt die Fläche auf die ursprüngliche, sichtbare Höhe zurück (statt nur die bisher
   * gewachsene Fläche leer zu zeichnen) und scrollt nach oben — eine frische Seite soll wieder
   * wie zu Beginn aussehen. */
  function clear() {
    const canvas = canvasRef.current;
    const paper = paperCanvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !paper || !wrap) return;
    const ratio = ratioRef.current;
    const widthCss = canvas.width / ratio;
    const heightCss = wrap.clientHeight;
    for (const el of [canvas, paper]) {
      el.width = widthCss * ratio;
      el.height = heightCss * ratio;
      el.style.height = `${heightCss}px`;
    }
    canvasHeightRef.current = heightCss;
    wrap.scrollTop = 0;
    const paperCtx = paper.getContext('2d');
    if (paperCtx) {
      paperCtx.scale(ratio, ratio);
      paintPaper(paperCtx, widthCss, heightCss, paperStyle);
    }
    hasDrawn.current = false;
  }

  async function choosePaperStyle(style: PaperStyle) {
    if (style === paperStyle) return;
    if (hasDrawn.current) {
      const confirmed = await useModalStore.getState().confirm('Papierstil wechseln? Die begonnene Zeichnung wird dabei verworfen.', { confirmLabel: 'Wechseln', danger: false });
      if (!confirmed) return;
    }
    setPaperStyleState(style);
    try { localStorage.setItem(PAPER_STYLE_KEY, style); } catch { /* localStorage unavailable */ }
    redraw(style);
  }

  function chooseHighlighterColor(color: string) {
    setHighlighterColorState(color);
    try { localStorage.setItem(HIGHLIGHTER_COLOR_KEY, color); } catch { /* localStorage unavailable */ }
  }

  function insert() {
    const canvas = canvasRef.current;
    const paper = paperCanvasRef.current;
    if (!canvas || !paper || !hasDrawn.current) { onCancel(); return; }
    const composite = document.createElement('canvas');
    composite.width = canvas.width;
    composite.height = canvas.height;
    const ctx = composite.getContext('2d');
    if (!ctx) { onCancel(); return; }
    ctx.drawImage(paper, 0, 0);
    ctx.drawImage(canvas, 0, 0);
    onInsert(composite.toDataURL('image/png'), canvas.clientWidth);
  }

  return (
    <div className="ink-pad">
      <div className="ink-toolbar">
        <div className="ink-tool-group" role="radiogroup" aria-label="Werkzeug">
          <button type="button" role="radio" aria-checked={tool === 'pen'} className={`ink-tool-btn${tool === 'pen' ? ' active' : ''}`} onClick={() => selectTool('pen')}>✎ Stift</button>
          <button type="button" role="radio" aria-checked={tool === 'highlighter'} className={`ink-tool-btn${tool === 'highlighter' ? ' active' : ''}`} onClick={() => selectTool('highlighter')}>🖍 Textmarker</button>
          <button type="button" role="radio" aria-checked={tool === 'eraser'} className={`ink-tool-btn${tool === 'eraser' ? ' active' : ''}`} onClick={() => setTool('eraser')}>⌫ Radierer</button>
        </div>
        {tool === 'highlighter' && (
          <div className="ink-highlighter-picker" role="radiogroup" aria-label="Textmarker-Farbe">
            {HIGHLIGHTER_COLORS.map((option) => (
              <button
                type="button"
                key={option.id}
                role="radio"
                aria-checked={highlighterColor === option.color}
                aria-label={option.label}
                title={option.label}
                className={`ink-highlighter-swatch${highlighterColor === option.color ? ' active' : ''}`}
                style={{ backgroundColor: option.color }}
                onClick={() => chooseHighlighterColor(option.color)}
              />
            ))}
          </div>
        )}
        <div className="ink-paper-picker" role="radiogroup" aria-label="Papierstil">
          {PAPER_STYLES.map((option) => (
            <button
              type="button"
              key={option.id}
              role="radio"
              aria-checked={paperStyle === option.id}
              className={`ink-paper-option${paperStyle === option.id ? ' active' : ''}`}
              onClick={() => void choosePaperStyle(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="ink-pad-actions">
        <button type="button" className="btn secondary small" onClick={clear}>Alles löschen</button>
        <div className="ink-pad-actions-end">
          <button type="button" className="btn secondary small" onClick={onCancel}>Abbrechen</button>
          <button type="button" className="btn small" onClick={insert}>Übernehmen</button>
        </div>
      </div>
      <div ref={wrapRef} className="ink-canvas-wrap">
        <canvas ref={paperCanvasRef} className="ink-canvas-paper" />
        <canvas
          ref={canvasRef}
          className={`ink-canvas${tool === 'eraser' ? ' eraser' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerLeave={stopDrawing}
        />
      </div>
    </div>
  );
}
