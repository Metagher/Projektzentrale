import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

interface Props {
  onInsert: (dataUrl: string, width: number) => void;
  onCancel: () => void;
}

/** Freehand drawing surface for Apple-Pencil / Touch / Maus. Anders als ein contentEditable-Feld
 * wird ein <canvas> von iPadOS Scribble nicht angefasst — das Geschriebene bleibt exakt die
 * gezeichnete Linie, statt in Buchstaben erkannt zu werden. */
export default function InkPad({ onInsert, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const hasDrawn = useRef(false);

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
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1c1c1c';
    ctx.lineWidth = 2.4;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, rect.width, rect.height);
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

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    hasDrawn.current = false;
  }

  function insert() {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn.current) { onCancel(); return; }
    onInsert(canvas.toDataURL('image/png'), canvas.clientWidth);
  }

  return (
    <div className="ink-pad">
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
