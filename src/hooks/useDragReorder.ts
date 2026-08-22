import { useState, type DragEvent } from 'react';

interface Options {
  disabled?: boolean;
  getGroupKey?: (id: string) => string;
  onDrop: (sourceId: string, targetId: string, placeAfter: boolean) => void;
}

/** Native HTML5 drag-and-drop single-axis reorder, optionally scoped to same-group items. */
export function useDragReorder({ disabled, getGroupKey, onDrop }: Options) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overAfter, setOverAfter] = useState(false);

  function getItemProps(id: string) {
    if (disabled) return {};
    return {
      draggable: true,
      onDragStart: (e: DragEvent) => {
        setDragId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
      },
      onDragEnd: () => {
        setDragId(null);
        setOverId(null);
      },
      onDragOver: (e: DragEvent) => {
        if (!dragId || dragId === id) return;
        if (getGroupKey && getGroupKey(dragId) !== getGroupKey(id)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = e.currentTarget.getBoundingClientRect();
        const after = e.clientY - rect.top > rect.height / 2;
        setOverId(id);
        setOverAfter(after);
      },
      onDragLeave: () => setOverId((o) => (o === id ? null : o)),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        if (dragId && dragId !== id && (!getGroupKey || getGroupKey(dragId) === getGroupKey(id))) onDrop(dragId, id, overAfter);
        setDragId(null);
        setOverId(null);
      },
      className: [dragId === id ? 'dragging' : '', overId === id ? (overAfter ? 'drag-over-bottom' : 'drag-over-top') : '']
        .filter(Boolean)
        .join(' '),
    };
  }

  return { getItemProps };
}
