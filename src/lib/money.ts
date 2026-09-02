/** Formatiert Cent-Beträge als deutsche Euro-Anzeige, z. B. 123456 -> "1.234,56 €". */
export function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

/** Wandelt eine Nutzereingabe (Komma oder Punkt als Dezimaltrennzeichen) in Cent um. */
export function euroInputToCents(value: string): number {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

/** Wandelt Cent zurück in eine für ein Zahlenfeld editierbare Dezimalzeichenkette, z. B. 123456 -> "1234.56". */
export function centsToEuroInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Wandelt den Wert eines `<input type="number">` in Cent um. Der DOM-Wert eines number-Inputs ist
 * immer mit Punkt als Dezimaltrennzeichen normiert (nie mit Tausenderpunkt) – anders als bei
 * `euroInputToCents`, das für frei getippten Text mit deutschem Zahlenformat gedacht ist. Beide
 * Funktionen hier zu verwechseln, lässt Punkte im Wert fälschlich als Tausendertrennzeichen wegfallen.
 */
export function numberInputToCents(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}
