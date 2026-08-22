export function formatDuration(totalMinutes: number): string {
  if (totalMinutes > 0 && totalMinutes < 1) return `${Math.max(1, Math.round(totalMinutes * 60))} Sek.`;
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}:${String(rest).padStart(2, '0')} h` : `${rest} min`;
}

export function runningMinutes(startedAt: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(startedAt)) / 60000));
}

export function formatRunningDuration(startedAt: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${hours ? `${hours}:` : ''}${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function formatTimeStamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '–' : new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'medium' }).format(date);
}
