/** Normalisiert Freitext-Eingaben ("AFN 1234", "afn-1234", "1234") auf eine vergleichbare AFN-Nummer. */
export function normalizeAfn(value: string): string {
  return value.trim().replace(/^AFN[\s:#-]*/i, '').trim().toLocaleUpperCase('de');
}
