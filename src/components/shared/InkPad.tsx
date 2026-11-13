import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useModalStore } from '../../store/modalStore';

interface Props {
  onInsert: (dataUrl: string, width: number) => void;
  onCancel: () => void;
}

export type PaperStyle = 'blank' | 'lines' | 'dots' | 'grid';

const PAPER_STYLES: { id: PaperStyle; label: string }[] = [
  { id: 'blank', label: 'Blanko' },
  { id: 'lines', label: 'Linien' },
  { id: 'dots', label: 'Punkte' },
  { id: 'grid', label: 'Kariert' },
];

const PAPER_STYLE_KEY = 'pz-ink-paper-style';
const GRID_SPACING = 26;

function readStoredPaperStyle(): PaperStyle {
  try {
    const value = localStorage.getItem(PAPER_STYLE_KEY);
    if (value === 'blank' || value === 'lines' || value === 'dots' || value === 'grid') return value;
  } catch { /* localStorage unavailable */ }
  return 'blank';
}

/** Zeichnet den Papier-Hintergrund (wie in OneNote: Blanko/Linien/Punkte/Kariert) direkt auf die
 * Zeichenfläche, damit er — anders als ein CSS-Hintergrund — auch im exportierten PNG erhalten
 * bleibt. Setzt anschließend den Zeichenstift für die Handschrift selbst zurück. */
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
  ctx.strokeStyle = '#1c1c1c';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/** Freehand drawing surface for Apple-Pencil / Touch / Maus. Anders als ein contentEditable-Feld
 * wird ein <canvas> von iPadOS Scribble nicht angefasst — das Geschriebene bleibt exakt die
 * gezeichnete Linie, statt in Buchstaben erkannt zu werden. Der Papierstil (wie in OneNote) wird
 * geräteweit gemerkt, nicht pro Notiz. */
export default function InkPad({ onInsert, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const hasDrawn = useRef(false);
  const [paperStyle, setPaperStyleState] = useState<PaperStyle>(readStoredPaperStyle);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    paintPaper(ctx, rect.width, rect.height, paperStyle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    lastPoint.current = pointFromEvent(event);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !lastPoint.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    const point = pointFromEvent(event);
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      hasDrawn.current = true;
    }
    lastPoint.current = point;
  }

  function stopDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    drawing.current = false;
    lastPoint.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* bereits freigegeben */ }
  }

  function redraw(style: PaperStyle) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    paintPaper(ctx, canvas.clientWidth, canvas.clientHeight, style);
    hasDrawn.current = false;
  }

  function clear() {
    redraw(paperStyle);
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
      <canvas
        ref={canvasRef}
        className="ink-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onPointerLeave={stopDrawing}
      />
      <div className="ink-pad-actions">
        <button type="button" className="btn secondary small" onClick={clear}>Löschen</button>
        <div className="ink-pad-actions-end">
          <button type="button" className="btn secondary small" onClick={onCancel}>Abbrechen</button>
          <button type="button" className="btn small" onClick={insert}>Übernehmen</button>
        </div>
      </div>
    </div>
  );
}
