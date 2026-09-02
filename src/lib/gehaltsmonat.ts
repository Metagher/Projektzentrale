/** Der Gehaltsmonat wird intern als YYYY-MM gespeichert (sortierbar), aber als MM/YYYY erfasst/angezeigt. */

/** YYYY-MM-DD -> YYYY-MM */
export function gehaltsMonatFromDate(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** YYYY-MM -> "MM/YYYY" */
export function formatGehaltsMonat(value: string | undefined): string {
  if (!value) return '';
  const [year, month] = value.split('-');
  if (!year || !month) return value;
  return `${month}/${year}`;
}

/** "MM/YYYY" (auch "M/YYYY") -> YYYY-MM, oder '' bei ungültiger Eingabe. */
export function parseGehaltsMonatInput(value: string): string {
  const match = value.trim().match(/^(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  const month = Number(match[1]);
  if (month < 1 || month > 12) return '';
  return `${match[2]}-${String(month).padStart(2, '0')}`;
}
