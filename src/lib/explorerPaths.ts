import type { Task } from '../types/entities';

export function normalizeExplorerBasePath(path: string): string {
  return path.trim().replace(/^"|"$/g, '').replace(/[\\/]+$/, '');
}

export function taskExplorerFolderName(task: Pick<Task, 'nr' | 'titel'>): string {
  const title = task.titel.replace(/[<>:"/\\|?*]/g, '-').replace(/[. ]+$/g, '').trim();
  return `ID ${task.nr || 'ohne Nummer'} - ${title || 'Aufgabe'}`;
}

export function taskExplorerPath(basePath: string, task: Pick<Task, 'nr' | 'titel'>): string {
  const base = normalizeExplorerBasePath(basePath);
  return base ? `${base}\\${taskExplorerFolderName(task)}` : '';
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
