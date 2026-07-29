import { defLevel, toLetter, toRoman } from './format';
import type { DocSectionDef } from '../types/entities';

export function computeDocLabels(defs: DocSectionDef[]): Record<string, string> {
  const labels: Record<string, string> = {};
  let c1 = 0, c2 = 0, c3 = 0;
  (defs || []).forEach((d) => {
    const lvl = defLevel(d.level);
    if (lvl === 1) {
      c1++; c2 = 0; c3 = 0;
      labels[d.id] = c1 + '.';
    } else if (lvl === 2) {
      c2++; c3 = 0;
      labels[d.id] = toLetter(c2) + '.';
    } else {
      c3++;
      labels[d.id] = toRoman(c3) + '.';
    }
  });
  return labels;
}

/** A "subtree" starting at index is the element itself plus all directly-following deeper-level elements. */
export function subtreeEnd(defs: DocSectionDef[], index: number): number {
  const baseLevel = defLevel(defs[index].level);
  let end = index + 1;
  while (end < defs.length && defLevel(defs[end].level) > baseLevel) end++;
  return end;
}

export function getSubtreeIds(defs: DocSectionDef[], defId: string): string[] {
  const idx = defs.findIndex((d) => d.id === defId);
  if (idx < 0) return [defId];
  const end = subtreeEnd(defs, idx);
  return defs.slice(idx, end).map((d) => d.id);
}

/**
 * Moves the whole subtree of sourceId to sit directly before targetId (placeAfter=false)
 * or directly after targetId's own subtree (placeAfter=true). Returns a new array, or the
 * original defs array unchanged if the move is a no-op (dropping onto itself/its own subtree).
 */
export function moveSubtreeTo(
  defs: DocSectionDef[],
  sourceId: string,
  targetId: string,
  placeAfter: boolean,
): DocSectionDef[] {
  const srcIdx = defs.findIndex((d) => d.id === sourceId);
  if (srcIdx < 0 || sourceId === targetId) return defs;
  const srcEnd = subtreeEnd(defs, srcIdx);
  const block = defs.slice(srcIdx, srcEnd);
  if (block.some((d) => d.id === targetId)) return defs;
  const rest = [...defs.slice(0, srcIdx), ...defs.slice(srcEnd)];
  const targetIdx = rest.findIndex((d) => d.id === targetId);
  if (targetIdx < 0) return defs;
  const insertAt = placeAfter ? subtreeEnd(rest, targetIdx) : targetIdx;
  return [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)];
}
