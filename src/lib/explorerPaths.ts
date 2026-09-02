import type { Task } from '../types/entities';

/** Voreingestellter globaler Ordner, unter dem pro Aufgaben-ID ein Unterordner liegt. */
export const DEFAULT_EXPLORER_BASE_PATH = 'C:\\Users\\f.quante\\Documents\\Global\\13_Projektzentrale';

export function normalizeExplorerBasePath(path: string): string {
  return path.trim().replace(/^"|"$/g, '').replace(/[\\/]+$/, '');
}

/** Der Unterordner einer Aufgabe entspricht exakt ihrer ID (Aufgabennummer). */
export function taskExplorerFolderName(task: Pick<Task, 'nr'>): string {
  return task.nr ? String(task.nr) : '';
}

export function taskExplorerPath(basePath: string, task: Pick<Task, 'nr'>): string {
  const base = normalizeExplorerBasePath(basePath);
  const folder = taskExplorerFolderName(task);
  return base && folder ? `${base}\\${folder}` : '';
}

/** Wandelt einen Windows-Pfad (lokal oder UNC) in eine file://-URL um, mit denen sich ein Ordner per Klick öffnen lässt. */
export function toFileUrl(path: string): string | null {
  const trimmed = normalizeExplorerBasePath(path);
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\\/g, '/');
  const driveMatch = normalized.match(/^([a-zA-Z]:)\/(.*)$/);
  if (driveMatch) {
    const [, drive, rest] = driveMatch;
    const segments = rest.split('/').filter(Boolean).map(encodeURIComponent);
    return `file:///${drive}/${segments.join('/')}`;
  }
  if (normalized.startsWith('//')) {
    const segments = normalized.slice(2).split('/').filter(Boolean).map(encodeURIComponent);
    return segments.length ? `file://${segments.join('/')}` : null;
  }
  return null;
}

export async function copyPathToClipboard(path: string): Promise<boolean> {
  if (!path) return false;
  try {
    await navigator.clipboard.writeText(path);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = path;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  }
}
