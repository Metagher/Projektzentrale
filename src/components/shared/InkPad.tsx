import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useModalStore } from '../../store/modalStore';

interface Props {
  onInsert: (dataUrl: string, width: number) => void;
  onCancel: () => void;
}

export type PaperStyle = 'blank' | 'lines' | 'dots' | 'grid';
type Tool = 'pen' | 'eraser';

const PAPER_STYLES: { id: PaperStyle; label: string }[] = [
  { id: 'blank', label: 'Blanko' },
  { id: 'lines', label: 'Linien' },
  { id: 'dots', label: 'Punkte' },
  { id: 'grid', label: 'Kariert' },
];

const PAPER_STYLE_KEY = 'pz-ink-paper-style';
const GRID_SPACING = 26;
const PEN_COLOR = '#1c1c1c';
const PEN_WIDTH = 2.4;
const ERASER_WIDTH = 22;
/** Fenster für einen Doppel-Tipp mit dem Stift direkt auf die Fläche (Zeit und Abstand). */
const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_PX = 24;
/** Wie lange nach einer Stift-Berührung Touch-Punkte auf der Fläche ignoriert werden
 * (Handflächen-Schutz während und kurz nach dem Schreiben). */
const PALM_REJECTION_MS = 1200;
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

/** Zeichnet den Papier-Hintergrund (wie in OneNote: Blanko/Linien/Punkte/Kariert) direkt auf die
 * Zeichenfläche, damit er — anders als ein CSS-Hintergrund — auch im exportierten PNG erhalten
 * bleibt. */
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

/** Setzt Strich-/Radierbreite und -farbe passend zum aktiven Werkzeug. Der "Radierer" trägt
 * technisch weiß nach statt die Fläche tatsächlich transparent zu löschen — das bleibt auch bei
 * liniertem/kariertem Papier konsistent weiß statt ein unpassendes Loch zu hinterlassen. */
function applyToolStyle(ctx: CanvasRenderingContext2D, tool: Tool) {
  ctx.strokeStyle = tool === 'eraser' ? '#fff' : PEN_COLOR;
  ctx.lineWidth = tool === 'eraser' ? ERASER_WIDTH : PEN_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/** Freehand drawing surface for Apple-Pencil / Touch / Maus. Anders als ein contentEditable-Feld
 * wird ein <canvas> von iPadOS Scribble nicht angefasst — das Geschriebene bleibt exakt die
 * gezeichnete Linie, statt in Buchstaben erkannt zu werden. Der Papierstil (wie in OneNote) wird
 * geräteweit gemerkt, nicht pro Notiz. Werkzeugleiste und Aktionen liegen bewusst komplett über
 * der Fläche, nicht darunter, damit die beim Schreiben aufliegende Hand sie nicht versehentlich
 * trifft. Ein Doppel-Tipp mit dem Stift direkt auf die Fläche schaltet zwischen Stift und Radierer
 * um — der native "zweimal auf den Apple Pencil tippen"-Shortcut ist Web-Seiten nicht zugänglich
 * (eine iPadOS-Funktion nur für native Apps), das hier ist das nächstmögliche Äquivalent. Die Seite
 * ist nicht auf die sichtbare Höhe begrenzt: beim Schreiben nahe dem unteren Rand wächst sie
 * automatisch nach unten weiter (wie in OneNote) und die Ansicht scrollt mit. */
export default function InkPad({ onInsert, onCancel }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const hasDrawn = useRef(false);
  const strokeMoved = useRef(false);
  const lastPenTap = useRef<{ time: number; x: number; y: number } | null>(null);
  const lastPenActivity = useRef(0);
  const ratioRef = useRef(1);
  const canvasHeightRef = useRef(0);
  const [paperStyle, setPaperStyleState] = useState<PaperStyle>(readStoredPaperStyle);
  const [tool, setTool] = useState<Tool>('pen');

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    ratioRef.current = ratio;
    const width = wrap.clientWidth;
    const height = wrap.clientHeight;
    canvasHeightRef.current = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    paintPaper(ctx, width, height, paperStyle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  /** Hängt bei Bedarf einen weiteren Streifen Papier unten an, ohne die bisherige Zeichnung zu
   * verlieren (ein Resize des <canvas> selbst würde sie sonst löschen — deshalb vorher auf ein
   * Hilfscanvas sichern und danach wieder einzeichnen). */
  function growIfNeeded(pointerYCss: number) {
    if (pointerYCss < canvasHeightRef.current - GROW_MARGIN) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = ratioRef.current;
    const widthCss = canvas.width / ratio;
    const oldHeightCss = canvasHeightRef.current;
    const newHeightCss = oldHeightCss + GROW_STEP;

    const snapshot = document.createElement('canvas');
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    snapshot.getContext('2d')?.drawImage(canvas, 0, 0);

    canvas.width = widthCss * ratio;
    canvas.height = newHeightCss * ratio;
    canvas.style.height = `${newHeightCss}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
      paintPaper(ctx, widthCss, newHeightCss, paperStyle);
      ctx.drawImage(snapshot, 0, 0, widthCss, oldHeightCss);
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

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.pointerType === 'touch' && Date.now() - lastPenActivity.current < PALM_REJECTION_MS) return;

    const point = pointFromEvent(event);

    if (event.pointerType === 'pen' && lastPenTap.current) {
      const elapsed = Date.now() - lastPenTap.current.time;
      const distance = Math.hypot(point.x - lastPenTap.current.x, point.y - lastPenTap.current.y);
      if (elapsed < DOUBLE_TAP_MS && distance < DOUBLE_TAP_PX) {
        setTool((t) => (t === 'pen' ? 'eraser' : 'pen'));
        lastPenTap.current = null;
        return;
      }
    }

    drawing.current = true;
    strokeMoved.current = false;
    lastPoint.current = point;
    if (event.pointerType === 'pen') lastPenActivity.current = Date.now();
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
      applyToolStyle(ctx, tool);
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      hasDrawn.current = true;
      strokeMoved.current = true;
    }
    lastPoint.current = point;
    if (event.pointerType === 'pen') lastPenActivity.current = Date.now();
    followPointer(point.y);
  }

  function stopDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    if (event.pointerType === 'pen') {
      lastPenTap.current = !strokeMoved.current && lastPoint.current ? { time: Date.now(), ...lastPoint.current } : null;
      lastPenActivity.current = Date.now();
    }
    drawing.current = false;
    lastPoint.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* bereits freigegeben */ }
  }

  function redraw(style: PaperStyle) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const ratio = ratioRef.current;
    paintPaper(ctx, canvas.width / ratio, canvas.height / ratio, style);
    hasDrawn.current = false;
  }

  /** Setzt die Fläche auf die ursprüngliche, sichtbare Höhe zurück (statt nur die bisher
   * gewachsene Fläche leer zu zeichnen) und scrollt nach oben — eine frische Seite soll wieder
   * wie zu Beginn aussehen. */
  function clear() {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ratio = ratioRef.current;
    const widthCss = canvas.width / ratio;
    const heightCss = wrap.clientHeight;
    canvas.width = widthCss * ratio;
    canvas.height = heightCss * ratio;
    canvas.style.height = `${heightCss}px`;
    canvasHeightRef.current = heightCss;
    wrap.scrollTop = 0;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
      paintPaper(ctx, widthCss, heightCss, paperStyle);
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

  function insert() {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn.current) { onCancel(); return; }
    onInsert(canvas.toDataURL('image/png'), canvas.clientWidth);
  }

  return (
    <div className="ink-pad">
      <div className="ink-toolbar">
        <div className="ink-tool-group" role="radiogroup" aria-label="Werkzeug">
          <button type="button" role="radio" aria-checked={tool === 'pen'} className={`ink-tool-btn${tool === 'pen' ? ' active' : ''}`} onClick={() => setTool('pen')}>✎ Stift</button>
          <button type="button" role="radio" aria-checked={tool === 'eraser'} className={`ink-tool-btn${tool === 'eraser' ? ' active' : ''}`} onClick={() => setTool('eraser')}>⌫ Radierer</button>
        </div>
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
